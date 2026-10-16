import logging
from pathlib import Path

from llama_index.core import SimpleDirectoryReader, StorageContext
from llama_index.core.ingestion import DocstoreStrategy, IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

from src.core.config import get_settings
from src.core.vectorStoreIndex import _get_chroma_collection

logger = logging.getLogger(__name__)
settings = get_settings()

# Persist docstore so dedup survives restarts
PIPELINE_DIR = Path("./pipeline_storage")
PIPELINE_DIR.mkdir(exist_ok=True)


def _get_docstore() -> SimpleDocumentStore:
    path = PIPELINE_DIR / "docstore.json"
    if path.exists():
        return SimpleDocumentStore.from_persist_path(str(path))
    return SimpleDocumentStore()


def _save_docstore(docstore: SimpleDocumentStore) -> None:
    docstore.persist(str(PIPELINE_DIR / "docstore.json"))


def _build_pipeline() -> IngestionPipeline:
    """Standard LlamaIndex ingestion pipeline with Chroma + docstore dedup."""
    collection = _get_chroma_collection()
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    docstore = _get_docstore()

    pipeline = IngestionPipeline(
        transformations=[
            SentenceSplitter(
                chunk_size=settings.chunk_size,
                chunk_overlap=settings.chunk_overlap,
            ),
            HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5"),
        ],
        vector_store=vector_store,
        docstore=docstore,
        docstore_strategy=DocstoreStrategy.UPSERTS,  # skip unchanged, update changed
    )

    return pipeline


async def run_ingestion(document_id: str, file_path: str, user_id: str) -> None:
    """
    Background task: parse -> chunk -> embed -> store in Chroma.
    Updates Document.status in DB.
    """
    from sqlalchemy import select

    from src.core.database import SessionLocal
    from src.features.documents.models import Document

    async with SessionLocal() as db:
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        doc.status = "processing"
        await db.commit()

        try:
            # Load the single file
            reader = SimpleDirectoryReader(input_files=[file_path])
            documents = reader.load_data()

            # Attach per-user metadata for filtering
            for d in documents:
                d.metadata["user_id"] = user_id
                d.metadata["document_id"] = document_id
                d.metadata["filename"] = doc.filename

            # Run pipeline (async)
            pipeline = _build_pipeline()
            nodes = await pipeline.arun(documents=documents, show_progress=False)

            # Persist docstore for future dedup
            if isinstance(pipeline.docstore, SimpleDocumentStore):
                _save_docstore(pipeline.docstore)

            doc.status = "ready"
            await db.commit()
            logger.info("Ingested %d nodes for document %s", len(nodes), document_id)

        except Exception as exc:
            logger.exception("Ingestion failed for %s", document_id)
            doc.status = "failed"
            doc.error = str(exc)
            await db.commit()
