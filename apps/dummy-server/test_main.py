import asyncio
import json
from typing import Any

import main


class FakeConnection:
    closed = False

    async def fetchval(self, query: str) -> int:
        assert query == "SELECT 1"
        return 1

    async def close(self, *, timeout: float) -> None:
        assert timeout == 3
        self.closed = True


class FakeSecretCache:
    def get_secret_string(self, _arn: str) -> str:
        return json.dumps({"username": "kiana_admin", "password": "secret"})


def test_database_check_uses_secret_and_environment(monkeypatch: Any) -> None:
    monkeypatch.setenv("DB_SECRET_ARN", "arn:aws:secretsmanager:example")
    monkeypatch.setenv("DB_HOST", "database.example")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "kiana")
    monkeypatch.setattr(main, "get_secret_cache", FakeSecretCache)
    connection_arguments: dict[str, object] = {}
    connection = FakeConnection()

    async def connect(**kwargs: object) -> FakeConnection:
        connection_arguments.update(kwargs)
        return connection

    monkeypatch.setattr(main.asyncpg, "connect", connect)

    asyncio.get_event_loop().run_until_complete(main.check_database_connection())

    assert connection_arguments == {
        "host": "database.example",
        "port": 5432,
        "database": "kiana",
        "user": "kiana_admin",
        "password": "secret",
        "timeout": 3,
        "command_timeout": 3,
        "ssl": "require",
    }
    assert connection.closed
