"""Unit tests for the device schema validators."""

import pytest
from pydantic import ValidationError

from app.schemas.device import DeviceCreate


class TestDeviceSchema:
    def test_device_create_accepts_valid_mac_and_ipv4(self):
        device = DeviceCreate(mac="AA-BB-CC-DD-EE-FF", ip="192.168.1.10")

        assert device.mac == "aa:bb:cc:dd:ee:ff"
        assert device.ip == "192.168.1.10"

    @pytest.mark.parametrize(
        "mac, expected",
        [
            ("001122334455", "00:11:22:33:44:55"),
            ("aa:bb:cc:dd:ee:ff", "aa:bb:cc:dd:ee:ff"),
            ("AA-BB-CC-DD-EE-FF", "aa:bb:cc:dd:ee:ff"),
        ],
    )
    def test_device_create_accepts_supported_mac_formats(self, mac, expected):
        device = DeviceCreate(mac=mac, ip="10.0.0.5")

        assert device.mac == expected

    @pytest.mark.parametrize("mac", ["00:11:22:33:44", "zz:11:22:33:44:55", "0011-2233-4455"])
    def test_device_create_rejects_invalid_mac(self, mac):
        with pytest.raises(ValidationError):
            DeviceCreate(mac=mac, ip="192.168.1.10")

    @pytest.mark.parametrize("ip", ["256.1.1.1", "2001:db8::1", "not-an-ip"])
    def test_device_create_rejects_invalid_ipv4(self, ip):
        with pytest.raises(ValidationError):
            DeviceCreate(mac="00:11:22:33:44:55", ip=ip)