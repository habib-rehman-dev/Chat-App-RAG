---
name: FastAPI Python project conventions
description: "Use these conventions when editing Python files in this FastAPI RAG application."
applyTo: "**/*.py"
---

# FastAPI Python Conventions

## Project Context

- This is a Python 3.14+ FastAPI chat application with RAG features.
- The project uses a `src/` layout and `uv` for dependency management and commands.
- The FastAPI application is defined in `src/main.py` as `app`.
- Run the application with `uv run fastapi dev src/main.py`.

## Package Boundaries

- Put shared configuration, security, and database infrastructure in `src/core/`.
- Keep chat HTTP routes and domain code in `src/features/chat/`.
- Keep document HTTP routes and domain code in `src/featuresdocuments/upload/`.
- Keep request and response models in each feature's `schemas.py` module.
- Keep ORM models in each feature's `models.py` module.
- Keep feature business logic in each feature's `service.py` module.
- Do not recreate the deleted `src/chat_app_rag/` package or move the startup app without updating imports and `pyproject.toml`.

## Implementation Rules

- Use FastAPI route decorators and typed request/response models.
- Prefer async route handlers when the underlying work is asynchronous.
- Keep route handlers thin; call feature services for business logic.
- Keep authentication and authorization checks in dependencies or security helpers.
- Do not put database access, document processing, or retrieval logic directly in endpoint modules.
- Use environment-backed configuration for secrets and external service settings; never hardcode credentials.
- Add dependencies through `pyproject.toml` and run commands with `uv`.
- Preserve existing public imports and API behavior unless the task explicitly requires a breaking change.
- Add focused tests for new routes, services, and error cases when the test structure is available.

## Validation

After changing Python code, run the narrowest relevant check. For the app entry point, use:

```bash
uv run python -c "from fastapi.testclient import TestClient; from src.main import app; response = TestClient(app).get('/'); assert response.status_code == 200; print(response.status_code, response.json())"
```

For a running development server, use:

```bash
uv run fastapi dev src/main.py
```
