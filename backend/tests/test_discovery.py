"""Unit tests for device discovery service."""

import pytest

from app.services.discovery import _read_arp_table, _lookup_vendor


class TestArpParsing:
    def test_read_arp_table_returns_list(self):
        """_read_arp_table returns a list (may be empty if not on Linux)."""
        result = _read_arp_table()
        assert isinstance(result, list)

    def test_lookup_vendor_returns_none_for_unknown_oui(self):
        """Unknown OUI returns None without raising."""
        result = _lookup_vendor("aa:bb:cc:dd:ee:ff")
        assert result is None

    def test_lookup_vendor_accepts_various_formats(self):
        """Vendor lookup should not crash on valid MAC formats."""
        assert _lookup_vendor("00:1A:2B:3C:4D:5E") is None
