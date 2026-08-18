# Dummy Server

A tiny FastAPI service for learning how to deploy applications to Kubernetes.

From the repository root, install dependencies and start the development server:

```bash
uv sync
uv run --package dummy-server uvicorn main:app --app-dir apps/dummy-server --reload
```

Then open <http://localhost:8000> or the interactive API documentation at
<http://localhost:8000/docs>. The health-check endpoint is available at
<http://localhost:8000/health>.
