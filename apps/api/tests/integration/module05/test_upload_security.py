"""Integration tests: Module 05 Upload Security.

Verifies upload security controls through the full HTTP router + file_security_service.
Run: uv run python -m pytest tests/integration/module05/test_upload_security.py -v -o addopts=""
"""
import pytest
from httpx import ASGITransport, AsyncClient

from api.services.file_security_service import EICAR_SIGNATURE

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_html_upload_blocked(authenticated_context):
    """P0-01: HTML upload must be rejected to prevent Stored XSS."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    files = {"file": ("malicious.html", b"<script>alert(document.domain)</script>", "text/html")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 400, f"Expected 400 for HTML upload, got {res.status_code}: {res.text}"
    assert "blocked for security reasons" in res.text.lower() or "xss" in res.text.lower()


@pytest.mark.asyncio
async def test_svg_upload_blocked(authenticated_context):
    """P0-01: SVG upload must be rejected because SVGs execute JavaScript."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    svg_payload = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    files = {"file": ("vector.svg", svg_payload, "image/svg+xml")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 400, f"Expected 400 for SVG upload, got {res.status_code}: {res.text}"
    assert "blocked for security reasons" in res.text.lower()


@pytest.mark.asyncio
async def test_eicar_malware_blocked_at_http(authenticated_context):
    """EICAR anti-malware test signature must be quarantined and rejected with 400."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    files = {"file": ("eicar.txt", EICAR_SIGNATURE, "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 400, f"Expected 400 for malware upload, got {res.status_code}: {res.text}"
    assert "malware signature" in res.text.lower() or "eicar" in res.text.lower()


@pytest.mark.asyncio
async def test_oversized_file_rejected_at_router(authenticated_context):
    """P0-05: Files exceeding 25MB must be rejected with 413 before memory exhaustion."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    oversized_payload = b"0" * (26 * 1024 * 1024)  # 26 MB
    files = {"file": ("large_archive.txt", oversized_payload, "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 413, f"Expected 413 for oversized file, got {res.status_code}: {res.text}"


@pytest.mark.asyncio
async def test_disguised_executable_rejected(authenticated_context):
    """Executable disguised as .txt must be caught by magic byte detection."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    pe_bytes = b"MZ" + b"\x90" * 200
    files = {"file": ("innocent.txt", pe_bytes, "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 400, f"Expected 400 for disguised executable, got {res.status_code}: {res.text}"
    assert "executable format detected" in res.text.lower()


@pytest.mark.asyncio
async def test_valid_pdf_upload_allowed(authenticated_context):
    """Valid PDF must upload successfully, create v1, and return 201."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    pdf_bytes = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    files = {"file": ("report.pdf", pdf_bytes, "application/pdf")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 201, f"Expected 201 for valid PDF, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["path"] == "report.pdf"
    assert data["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_path_traversal_sanitized(authenticated_context):
    """Path traversal filename must be sanitized so directory escapes are eliminated."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    payload = b"Plain document content"
    files = {"file": ("../../../../etc/passwd.txt", payload, "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)

    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    sanitized_path = res.json()["path"]
    assert "../" not in sanitized_path
    assert "etc" not in sanitized_path or sanitized_path.endswith("passwd.txt")


@pytest.mark.asyncio
async def test_unauthenticated_upload_denied(authenticated_context):
    """Upload without Authorization header must return 401."""
    client = authenticated_context["client"]
    ws_id = authenticated_context["workspace_id"]

    files = {"file": ("doc.txt", b"secret", "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files)
    assert res.status_code == 401
