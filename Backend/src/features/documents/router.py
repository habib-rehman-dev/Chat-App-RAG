import hashlib
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import get_db
from src.core.security import CurrentUser, get_chat_user
from src.core.vectorStoreIndex import _get_chroma_collection
from src.features.documents.ingestion import run_ingestion
from src.features.documents.models import Document

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# A pending/processing row older than this is assumed dead (e.g. server restarted).
STALE_AFTER = timedelta(minutes=10)

CHAT_USER_DEPENDENCY = Depends(get_chat_user)
DB_DEPENDENCY = Depends(get_db)


def _hash_file(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _purge_storage(doc: Document) -> None:
    """Remove vectors + the file on disk. Never raises: cleanup must not block deletion."""
    try:
        _get_chroma_collection().delete(where={"document_id": doc.id})
    except Exception:
        logger.warning("Could not delete vectors for %s", doc.id, exc_info=True)
    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        logger.warning("Could not delete file for %s", doc.id, exc_info=True)


@router.post("/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File is larger than {settings.max_upload_mb} MB")

    file_hash = _hash_file(content)

    rows = (
        await db.execute(
            select(Document).where(
                Document.user_id == current_user.id,
                Document.content_hash == file_hash,
            )
        )
    ).scalars().all()

    now = datetime.now(timezone.utc)
    for d in rows:
        if d.status == "ready":
            return {"message": "File already exists", "document_id": d.id, "status": "ready"}
        if d.status in ("pending", "processing") and d.created_at and now - d.created_at < STALE_AFTER:
            return {"message": "File is already being indexed", "document_id": d.id, "status": d.status}

    # Whatever is left is failed or stale: clean it up so a retry starts fresh.
    for d in rows:
        await run_in_threadpool(_purge_storage, d)
        await db.delete(d)
    await db.commit()

    doc_id = str(uuid4())
    file_path = UPLOAD_DIR / current_user.id.replace(":", "_") / f"{doc_id}_{file.filename}"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(content)

    db.add(
        Document(
            id=doc_id,
            user_id=current_user.id,
            filename=file.filename or "file",
            content_hash=file_hash,
            file_path=str(file_path),
            status="pending",
        )
    )
    await db.commit()

    background_tasks.add_task(run_ingestion, doc_id, str(file_path), current_user.id)
    return {"message": "File uploaded, indexing started", "document_id": doc_id, "status": "pending"}


@router.get("/documents")
async def list_documents(
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    rows = (
        await db.execute(
            select(Document)
            .where(Document.user_id == current_user.id)
            .order_by(Document.created_at.desc())
        )
    ).scalars().all()

    out = []
    for d in rows:
        p = Path(d.file_path)
        out.append(
            {
                "id": d.id,
                "filename": d.filename,
                "status": d.status,
                "error": d.error,
                "size": p.stat().st_size if p.exists() else 0,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
        )
    return out


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    doc = (
        await db.execute(
            select(Document).where(
                Document.id == document_id,
                Document.user_id == current_user.id,  # ownership check
            )
        )
    ).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await run_in_threadpool(_purge_storage, doc)
    await db.delete(doc)
    await db.commit()
    return {"deleted": True}