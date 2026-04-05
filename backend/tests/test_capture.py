"""Unit tests for the packet capture service."""

import pytest

from app.services.capture import delete_pcap_file


class TestCaptureService:
    @pytest.mark.asyncio
    async def test_delete_nonexistent_file_returns_false(self):
        """Deleting a file that does not exist returns False."""
        result = await delete_pcap_file("nonexistent_file.pcap")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_rejects_path_traversal(self):
        """Filenames containing path separators are rejected for safety."""
        result = await delete_pcap_file("../etc/passwd")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_rejects_dotdot(self):
        result = await delete_pcap_file("..%2Fetc%2Fpasswd")
        assert result is False
