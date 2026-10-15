import hashlib
import os
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import SessionLocal, get_db
from src.core.security import CurrentUser, get_chat_user
from src.features.documents.ingestion import run_ingestion

router = APIRouter()
settings = get_settings()

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

CHAT_USER_DEPENDENCY = Depends(get_chat_user)
DB_DEPENDENCY = Depends(get_db)


def _hash_file(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    file_hash = _hash_file(content)

    # Dedup check: same user + same content hash
    from src.features.documents.models import Document
    from sqlalchemy import select

    result = await db.execute(
        select(Document).where(
            Document.user_id == current_user.id,
            Document.content_hash == file_hash,
        )
    )
    existing = result.scalar_one_or_none()
    if existing and existing.status == "ready":
        return {"message": "File already exists", "document_id": existing.id}

    doc_id = str(uuid4())
    safe_name = f"{doc_id}_{file.filename}"
    file_path = UPLOAD_DIR / current_user.id.replace(":", "_") / safe_name
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(content)

    # Create DB row
    doc = Document(
        id=doc_id,
        user_id=current_user.id,
        filename=file.filename,
        content_hash=file_hash,
        file_path=str(file_path),
        status="pending",
    )
    db.add(doc)
    await db.commit()

    # Background ingestion
    background_tasks.add_task(run_ingestion, doc_id, str(file_path), current_user.id)

    return {
        "message": "File uploaded, indexing started",
        "document_id": doc_id,
        "status": "pending",
    }