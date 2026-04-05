"""Shared pytest fixtures for all backend tests."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_shell():
    """Patch shell.run and shell.run_async so no real system commands are executed."""
    with (
        patch("app.utils.shell.run", return_value=MagicMock(returncode=0)) as mock_run,
        patch("app.utils.shell.run_async", new_callable=AsyncMock, return_value=MagicMock(returncode=0)) as mock_async,
    ):
        yield {"run": mock_run, "run_async": mock_async}


@pytest.fixture
def client():
    """FastAPI TestClient."""

    from main import app

    with TestClient(app) as c:
        yield c
