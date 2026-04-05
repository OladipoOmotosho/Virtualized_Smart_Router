"""Shared pytest fixtures for all backend tests."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


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
