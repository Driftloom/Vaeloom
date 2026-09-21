"""Test Suite: Module 05 File Security & Malware Scanning (M05-FILE & M05-MALWARE).
Verifies magic-byte inspection, executable/script rejection, directory traversal sanitization, and EICAR quarantine.
"""
import pytest
from api.services.file_security_service import FileSecurityService, EICAR_SIGNATURE


def test_filename_sanitization():
    """Verify filename sanitization strips directory traversal and dangerous characters."""
    sanitized = FileSecurityService.sanitize_filename("../../etc/passwd")
    assert ".." not in sanitized
    assert "passwd" in sanitized

    clean = FileSecurityService.sanitize_filename('nested/path/to/my"file*.pdf')
    assert '"' not in clean
    assert "*" not in clean


def test_magic_bytes_enforcement():
    """Verify executable binaries disguised as documents are rejected."""
    # PE Executable disguised as PDF
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00"
    verdict = FileSecurityService.inspect_file("malicious.pdf", fake_pdf)
    assert verdict.is_safe is False
    assert "Executable" in (verdict.rejection_reason or "")

    # Linux ELF executable disguised as DOCX
    fake_docx = b"\x7fELF\x02\x01\x01\x00"
    verdict_elf = FileSecurityService.inspect_file("report.docx", fake_docx)
    assert verdict_elf.is_safe is False
    assert "ELF" in (verdict_elf.rejection_reason or "")

    # Unix shell script disguised as text
    script_content = b"#!/bin/bash\nrm -rf /"
    verdict_sh = FileSecurityService.inspect_file("notes.txt", script_content)
    assert verdict_sh.is_safe is False


def test_malware_eicar_quarantine():
    """Verify EICAR virus signature triggers quarantine status."""
    verdict = FileSecurityService.inspect_file("test_virus.txt", EICAR_SIGNATURE)
    assert verdict.is_safe is False
    assert verdict.scan_status in ("MALICIOUS", "QUARANTINED")
    assert "EICAR" in (verdict.rejection_reason or "")


def test_valid_document_inspection():
    """Verify legitimate PDF and plain text pass validation."""
    valid_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    verdict = FileSecurityService.inspect_file("legit.pdf", valid_pdf)
    assert verdict.is_safe is True
    assert verdict.scan_status == "CLEAN"
    assert verdict.detected_mime == "application/pdf"

    valid_txt = b"Hello, this is a clean text document."
    verdict_txt = FileSecurityService.inspect_file("clean.txt", valid_txt)
    assert verdict_txt.is_safe is True
    assert verdict_txt.scan_status == "CLEAN"
