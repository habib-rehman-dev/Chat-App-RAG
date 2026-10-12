# # pylint: disable=invalid-name

# import chromadb
# from llama_index.core import Settings, SimpleDirectoryReader, StorageContext, VectorStoreIndex
# from llama_index.vector_stores.chroma import ChromaVectorStore
# from llama_index.llms.groq import Groq
# from llama_index.embeddings.huggingface import HuggingFaceEmbedding
# from src.core.config import get_settings


# settings = get_settings()

# Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
# Settings.llm = Groq(
#     model=settings.llm_model_name,
#     api_key=settings.LLM_API_KEY,
#     temperature=settings.llm_model_temperature,
# )

# chroma_client = chromadb.PersistentClient(path="./chroma_db")

# chroma_collection = chroma_client.get_or_create_collection(name="my_collection")

# vector_store = ChromaVectorStore(chroma_collection=chroma_collection)

# storage_context = StorageContext.from_defaults(vector_store=vector_store)

# documents = SimpleDirectoryReader(input_dir="data").load_data()

# index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

# # index = VectorStoreIndex.from_vector_store(vector_store)

# query_engine = index.as_query_engine()


# src/core/vectorStoreIndex.py
# pylint: disable=invalid-name

import logging
from functools import lru_cache

import chromadb
from llama_index.core import (
    Settings,
    SimpleDirectoryReader,
    StorageContext,
    VectorStoreIndex,
)
from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.llms.groq import Groq
from llama_index.vector_stores.chroma import ChromaVectorStore

from src.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Configure LlamaIndex globals ONCE at import time.
# These are process-wide singletons inside LlamaIndex, so it's fine here.
Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
Settings.llm = Groq(
    model=settings.llm_model_name,
    api_key=settings.LLM_API_KEY,
    temperature=settings.llm_model_temperature,
)
Settings.chunk_size = settings.chunk_size
Settings.chunk_overlap = settings.chunk_overlap


@lru_cache(maxsize=1)
def _get_chroma_collection() -> chromadb.Collection:
    """Open (or create) the persistent Chroma collection. Cached per-process."""
    client = chromadb.PersistentClient(path=settings.chroma_path)
    return client.get_or_create_collection(name=settings.chroma_collection)


@lru_cache(maxsize=1)
def get_index() -> VectorStoreIndex:
    """
    Build the VectorStoreIndex exactly once per process.

    - If the Chroma collection already has documents, we load from the vector
      store instead of re-embedding every file in `data/`.
    - Otherwise, we ingest `data/` and persist the embeddings to Chroma.

    The `@lru_cache` guarantees this only runs once, no matter how many
    modules import it.
    """
    collection = _get_chroma_collection()
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    # Fast path: collection already has data -> skip re-embedding.
    existing_count = collection.count()
    if existing_count > 0:
        logger.info(
            "Loading existing index from Chroma collection %r (%d vectors)",
            settings.chroma_collection,
            existing_count,
        )
        return VectorStoreIndex.from_vector_store(
            vector_store=vector_store,
            storage_context=storage_context,
        )

    # Cold path: first run (or empty collection) -> ingest `data/`.
    logger.info(
        "Chroma collection %r is empty; ingesting ./data",
        settings.chroma_collection,
    )
    documents = SimpleDirectoryReader(input_dir="./data").load_data()
    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
    )
    logger.info("Ingested %d documents into Chroma", len(documents))
    return index


@lru_cache(maxsize=1)
def get_query_engine() -> BaseQueryEngine:
    """Query engine built on top of the singleton index. Cached."""
    return get_index().as_query_engine(
        similarity_top_k=settings.similarity_top_k,
    )


def warm_up() -> None:
    """
    Force-build the index. Call this from FastAPI lifespan so the first
    request doesn't pay the cost.
    """
    get_index()
    get_query_engine()
