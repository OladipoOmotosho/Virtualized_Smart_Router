"""Unit tests for the logs service."""

import pytest

from app.schemas.logs import LogPurgeResponse


class TestLogsService:
    def test_purge_response_model(self):
        """LogPurgeResponse serialises correctly."""
        resp = LogPurgeResponse(deleted_count=5, message="Deleted 5 records older than 30 days")
        assert resp.deleted_count == 5
        assert "30" in resp.message

    def test_purge_response_zero_deleted(self):
        resp = LogPurgeResponse(deleted_count=0, message="Deleted 0 records older than 30 days")
        assert resp.deleted_count == 0
