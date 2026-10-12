# AGENTS.md

## Project

This is a Python 3.14+ FastAPI application for a chat app with RAG features.
The project uses a `src/` layout and `uv` for packaging and commands.

## Important Paths

- `src/main.py`: FastAPI application entry point (`app`).
- `src/core/`: application configuration, security, dependencies, and database infrastructure.
- `src/features/chat/`: chat models, schemas, services, and router.
- `src/features/documents/`: document models, schemas, services, and router.
- `pyproject.toml`: project metadata, dependencies, and the `chat-app-rag` command.

## Development Commands

Run the development server from the repository root:

```bash
uv run fastapi dev src/main.py
```

Equivalent commands:

```bash
uv run uvicorn src.main:app --reload
uv run chat-app-rag
```

The application should respond at `/` with a JSON health-check message.

For a quick endpoint check:

```bash
uv run python -c "from fastapi.testclient import TestClient; from src.main import app; response = TestClient(app).get('/'); print(response.status_code, response.json())"
```

No dedicated test, lint, or formatting command is configured yet. Do not claim those checks passed unless they are added and run.

## Coding Guidance

- Keep application startup in `src/main.py`; do not recreate the deleted `src/chat_app_rag/` package.
- Preserve the existing `src/` layout and update imports when moving modules.
- Keep API routing, core utilities, persistence, and feature services in their current boundaries.
- Prefer typed function signatures and small feature-focused modules.
- Add dependencies through `pyproject.toml` and use `uv`; do not modify the environment manually.
- Read nearby code before changing a placeholder module, since many current files are scaffolding.
- Keep changes focused and do not rewrite empty placeholder modules without a concrete requirement.
- Validate changed Python files with diagnostics or a focused `uv run` command.
