# src/main.py
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings
from src.core.vectorStoreIndex import warm_up
from src.features.chat.router import router as chat_router
from src.features.documents.router import router as documents_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    # Warm up the RAG index once at startup so the first chat request is fast.
    # Any exception here means the app is misconfigured, so we let it crash.
    logger.info("Warming up RAG index…")
    warm_up()
    logger.info("RAG index ready.")
    yield
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Chat-Id", "x-vercel-ai-data-stream"],
)

app.include_router(prefix="/api", router=documents_router)
app.include_router(prefix="/api", router=chat_router)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
