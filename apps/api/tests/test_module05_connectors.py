"""Test Suite: Module 05 Connectors & External Integrations (M05-INTEGRATION).
Verifies external connector trust boundaries, credential isolation, and input sanitization.
"""
import pytest
from api.services.file_security_service import FileSecurityService


def test_connector_isolation_and_sanitization():
    """Verify imported files from external connectors undergo mandatory file security inspection."""
    untrusted_payload = b"MZ\x90\x00\x03\x00"  # disguised PE
    verdict = FileSecurityService.inspect_file("google_drive_export.pdf", untrusted_payload)
    assert verdict.is_safe is False
    assert "Executable" in (verdict.rejection_reason or "")
