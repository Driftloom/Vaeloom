import pytest
from api.services.file_security_service import file_security_service, EICAR_TEST_STRING


class TestFileSecurity:
    def test_sanitize_filename(self):
        assert file_security_service.sanitize_filename("valid_doc.pdf") == "valid_doc.pdf"
        assert file_security_service.sanitize_filename("../../etc/passwd.pdf") == "etc/passwd.pdf"
        assert file_security_service.sanitize_filename("..\\..\\windows\\system32.exe") == "windows/system32.exe"
        assert file_security_service.sanitize_filename("bad\x00file.txt") == "badfile.txt"
        assert file_security_service.sanitize_filename("") == "untitled"

    def test_valid_pdf_inspection(self):
        pdf_content = b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj"
        verdict = file_security_service.inspect_file("report.pdf", pdf_content, "application/pdf")
        assert verdict.is_safe is True
        assert verdict.scan_status == "CLEAN"
        assert verdict.detected_mime == "application/pdf"

    def test_disallowed_extension_rejection(self):
        verdict = file_security_service.inspect_file("payload.bat", b"@echo off\nexit", "text/plain")
        assert verdict.is_safe is False
        assert verdict.scan_status == "REJECTED"
        assert "Extension '.bat' is not permitted" in verdict.rejection_reason

    def test_spoofed_pdf_with_executable_payload(self):
        # Disguised as .pdf but contains Windows PE executable header 'MZ'
        fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
        verdict = file_security_service.inspect_file("innocent.pdf", fake_pdf, "application/pdf")
        assert verdict.is_safe is False
        assert verdict.scan_status == "REJECTED"
        assert "Executable format detected" in verdict.rejection_reason

    def test_eicar_malware_quarantine(self):
        eicar_bytes = EICAR_TEST_STRING.encode("ascii")
        verdict = file_security_service.inspect_file("eicar.txt", eicar_bytes, "text/plain")
        assert verdict.is_safe is False
        assert verdict.scan_status == "MALICIOUS"
        assert "EICAR" in verdict.rejection_reason

    def test_valid_png_and_jpeg_magic_bytes(self):
        png_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        verdict = file_security_service.inspect_file("image.png", png_content, "image/png")
        assert verdict.is_safe is True
        assert verdict.detected_mime == "image/png"

        jpeg_content = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        verdict_jpg = file_security_service.inspect_file("photo.jpg", jpeg_content, "image/jpeg")
        assert verdict_jpg.is_safe is True
        assert verdict_jpg.detected_mime == "image/jpeg"

    def test_valid_text_and_markdown(self):
        txt_content = b"Hello, world! This is a plain text file."
        verdict = file_security_service.inspect_file("notes.txt", txt_content, "text/plain")
        assert verdict.is_safe is True
        assert verdict.detected_mime == "text/plain"

        md_content = b"# Architecture Design\n\n- PostgreSQL RLS\n- Fail closed tenancy"
        verdict_md = file_security_service.inspect_file("README.md", md_content, "text/markdown")
        assert verdict_md.is_safe is True
        assert verdict_md.detected_mime == "text/markdown"
