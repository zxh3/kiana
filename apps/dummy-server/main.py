import asyncio
import json
import os
from functools import cache
from typing import Any

import asyncpg
from aws_secretsmanager_caching import SecretCache, SecretCacheConfig
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Dummy Server")


class DatabaseUnavailable(Exception):
    """The application could not read the credential or reach PostgreSQL."""


@cache
def get_secret_cache() -> SecretCache:
    """Create the regional AWS client only when the database endpoint is used."""
    return SecretCache(config=SecretCacheConfig(secret_refresh_interval=300))


async def check_database_connection() -> None:
    """Fetch the cached RDS credential and run a minimal PostgreSQL query."""
    connection: asyncpg.Connection | None = None
    try:
        secret_arn = os.environ["DB_SECRET_ARN"]
        secret_string = await asyncio.to_thread(
            get_secret_cache().get_secret_string,
            secret_arn,
        )
        if secret_string is None:
            raise DatabaseUnavailable("database secret contains no string value")

        credential: dict[str, Any] = json.loads(secret_string)
        connection = await asyncpg.connect(
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", "5432")),
            database=os.environ.get("DB_NAME", "postgres"),
            user=credential["username"],
            password=credential["password"],
            timeout=3,
            command_timeout=3,
            ssl="require",
        )
        await connection.fetchval("SELECT 1")
    except DatabaseUnavailable:
        raise
    except (
        BotoCoreError,
        ClientError,
        KeyError,
        OSError,
        TimeoutError,
        TypeError,
        ValueError,
        asyncpg.PostgresError,
    ) as error:
        raise DatabaseUnavailable from error
    finally:
        if connection is not None:
            await connection.close(timeout=3)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Hello from dummy-server!"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/db-health")
async def database_health() -> dict[str, str]:
    try:
        await check_database_connection()
    except DatabaseUnavailable as error:
        raise HTTPException(status_code=503, detail="database unavailable") from error
    return {"status": "ok", "database": "connected"}
