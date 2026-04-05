"""Unit tests for the firewall service."""

import pytest
from pydantic import ValidationError

from app.schemas.firewall import FirewallRuleCreate
from app.services.firewall import _validate_ip


class TestFirewallService:
    def test_validate_ip_accepts_valid_ipv4(self):
        """Valid IPv4 addresses pass validation unchanged."""
        assert _validate_ip("192.168.1.1") == "192.168.1.1"
        assert _validate_ip("10.0.0.1") == "10.0.0.1"

    def test_validate_ip_rejects_invalid_address(self):
        """Invalid strings raise ValueError."""
        with pytest.raises(ValueError):
            _validate_ip("not-an-ip")

    def test_validate_ip_rejects_partial_address(self):
        """Partial IP strings raise ValueError."""
        with pytest.raises(ValueError):
            _validate_ip("192.168.1")

    def test_validate_ip_rejects_empty_string(self):
        with pytest.raises(ValueError):
            _validate_ip("")

    def test_firewall_rule_create_validates_destination_ip(self):
        rule = FirewallRuleCreate(device_id=1, dest_ip="2001:db8::1", protocol="tcp")
        assert str(rule.dest_ip) == "2001:db8::1"

    def test_firewall_rule_create_rejects_invalid_destination_ip(self):
        with pytest.raises(ValidationError):
            FirewallRuleCreate(device_id=1, dest_ip="not-an-ip", protocol="tcp")
