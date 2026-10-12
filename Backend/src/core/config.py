from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from llama_index.llms.groq import Groq


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "RAG Backend"

    # Database
    DATABASE_URL: str
    USE_LOCAL_DB: bool = False
    LOCAL_DATABASE_URL: str = "sqlite+aiosqlite:///./local.db"
    sql_echo: bool = False

    # Auth (Auth.js v5 / NextAuth encrypted session token)
    auth_secret: str = Field(
        validation_alias=AliasChoices("AUTH_SECRET", "NEXTAUTH_SECRET", "SECRET_KEY")
    )
    auth_cookie_salts: list[str] = [
        "authjs.session-token",
        "__Secure-authjs.session-token",
    ]

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # OpenAI
    LLM_API_KEY: str

    # LLM selection and configuration
    llm_model_name: str = "qwen/qwen3.8-27b"
    # llm_model_name: str = "openai/gpt-oss-20b"


    llm_model_temperature: float = 0.3

    # ChromaDB
    chroma_path: str = "./chroma_db"
    chroma_collection: str = "rag_documents"

    # A. Ingestion / chunking
    chunk_size: int = 200
    chunk_overlap: int = 20

    # B. Embeddings
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"


    # C. Generation
    # llm_model: Groq = Groq(model="qwen/qwen3.8-27b", temperature=0.3)
    temperature: float = 0.3
    max_tokens: int = 400


    similarity_top_k: int = 3
    history_message_limit: int = 20
    max_upload_mb: int = 25


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore


# settings = get_settings()  # type: ignore
