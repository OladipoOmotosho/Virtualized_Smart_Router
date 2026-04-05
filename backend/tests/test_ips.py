"""Unit tests for the IPS monitoring service."""

import pytest

from app.services.ips import _read_proc_net_dev, _interface_to_device_id


class TestIpsService:
    def test_read_proc_net_dev_returns_dict(self):
        """_read_proc_net_dev returns a dict (may be empty if not on Linux)."""
        result = _read_proc_net_dev()
        assert isinstance(result, dict)

    def test_interface_to_device_id_maps_veth(self):
        """veth<n> interface names map to device ID n."""
        assert _interface_to_device_id("veth1", {}) == 1
        assert _interface_to_device_id("veth42", {}) == 42

    def test_interface_to_device_id_unknown_returns_none(self):
        """Non-veth interfaces that cannot be mapped return None."""
        assert _interface_to_device_id("eth0", {}) is None
        assert _interface_to_device_id("lo", {}) is None

    def test_interface_to_device_id_invalid_suffix_returns_none(self):
        assert _interface_to_device_id("vethXX", {}) is None
