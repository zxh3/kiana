from fastapi import FastAPI

app = FastAPI(title="Dummy Server")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Hello from dummy-server!"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
