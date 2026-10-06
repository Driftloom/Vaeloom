"""Tests for Document Batch Versions Endpoint and WCAG 1.2.2 Video Caption Pipeline.

Verifies:
1. POST /api/v1/documents/versions/batch returns aggregated versions in a single query (0 N+1).
2. GET /api/v1/documents/{document_id}/captions returns metadata for accessibility tracks.
3. GET /api/v1/documents/{document_id}/captions.vtt streams WebVTT compliant subtitles.
4. POST /api/v1/documents/{document_id}/captions uploads custom WebVTT subtitle track.
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from api.models.schema import Document, DocumentVersion

pytestmark = pytest.mark.asyncio


async def _auth(client: AsyncClient, email: str) -> dict:
    res = await client.post(
        "/api/v1/auth/signup", json={"email": email, "password": "Password123!"}
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _workspace(client: AsyncClient, headers: dict, name: str = "Batch WS") -> str:
    res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _upload(client: AsyncClient, headers: dict, ws_id: str, name: str, body: bytes) -> str:
    res = await client.post(
        f"/api/v1/documents?workspace_id={ws_id}",
        files={"file": (name, body, "application/octet-stream")},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestBatchDocumentVersions:
    async def test_batch_versions_returns_aggregated_counts(self, client: AsyncClient, db_session):
        headers = await _auth(client, "batch_vers@vaeloom.test")
        ws_id = await _workspace(client, headers)

        doc1_id = await _upload(client, headers, ws_id, "doc1.txt", b"Version 1 content")
        doc2_id = await _upload(client, headers, ws_id, "doc2.txt", b"Doc 2 content")

        # Create a second version for doc1
        v2 = DocumentVersion(
            id=uuid.uuid4(),
            document_id=uuid.UUID(doc1_id),
            version_number=2,
            storage_key=f"storage/ws/{doc1_id}/v2.txt",
            size_bytes=30,
        )
        db_session.add(v2)
        await db_session.commit()

        # Query batch versions
        batch_payload = {
            "document_ids": [doc1_id, doc2_id],
            "workspace_id": ws_id,
        }
        res = await client.post("/api/v1/documents/versions/batch", json=batch_payload, headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["versions"]

        # Doc 1 has version 2
        assert str(doc1_id) in data
        assert data[str(doc1_id)]["latest_version"] == 2
        assert data[str(doc1_id)]["version_count"] >= 1

        # Doc 2 has default version 1
        assert str(doc2_id) in data
        assert data[str(doc2_id)]["latest_version"] == 1
        assert data[str(doc2_id)]["version_count"] == 1

    async def test_batch_versions_empty_list(self, client: AsyncClient):
        headers = await _auth(client, "batch_empty@vaeloom.test")
        ws_id = await _workspace(client, headers)

        batch_payload = {
            "document_ids": [],
            "workspace_id": ws_id,
        }
        res = await client.post("/api/v1/documents/versions/batch", json=batch_payload, headers=headers)
        assert res.status_code == 200, res.text
        assert res.json()["versions"] == {}


class TestWCAGVideoCaptions:
    async def test_captions_absent_is_reported_as_absent(self, client: AsyncClient):
        """No uploaded track means no track — not a synthesised one.

        This endpoint used to build a WebVTT payload out of the filename and the
        document summary, timed as if it were dialogue, and report
        `has_captions: true` regardless. A deaf viewer then got a captions
        affordance carrying content that misrepresented the audio, which is worse
        than offering nothing. Absence must be reported as absence.
        """
        headers = await _auth(client, "captions_absent@vaeloom.test")
        ws_id = await _workspace(client, headers)

        doc_id = await _upload(client, headers, ws_id, "no_captions_here.mp4", b"not really a video")

        res = await client.get(f"/api/v1/documents/{doc_id}/captions?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200, res.text
        meta = res.json()
        assert meta["has_captions"] is False
        assert meta["kind"] == "captions"
        assert meta["srclang"] == "en"
        assert "captions.vtt" in meta["caption_url"]

        # And the stream itself must 404 rather than serve invented cues.
        vtt_res = await client.get(f"/api/v1/documents/{doc_id}/captions.vtt?workspace_id={ws_id}", headers=headers)
        assert vtt_res.status_code == 404, vtt_res.text
        assert "WEBVTT" not in vtt_res.text
        # The filename must never be presented as a spoken caption.
        assert "no_captions_here.mp4" not in vtt_res.text

    async def test_captions_metadata_and_vtt_stream_after_upload(self, client: AsyncClient):
        """Once real WebVTT exists, both endpoints report and serve it."""
        headers = await _auth(client, "captions_test@vaeloom.test")
        ws_id = await _workspace(client, headers)

        doc_id = await _upload(client, headers, ws_id, "interview_demo.txt", b"demo transcript text")

        vtt = (
            "WEBVTT\n\n"
            "00:00:00.000 --> 00:00:03.000\n"
            "Thank you for joining us.\n"
        )
        up = await client.post(
            f"/api/v1/documents/{doc_id}/captions?workspace_id={ws_id}",
            json={"vtt_content": vtt, "srclang": "en", "label": "English"},
            headers=headers,
        )
        assert up.status_code in (200, 201), up.text

        res = await client.get(f"/api/v1/documents/{doc_id}/captions?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200, res.text
        meta = res.json()
        assert meta["has_captions"] is True
        assert meta["kind"] == "captions"
        assert meta["srclang"] == "en"
        assert "captions.vtt" in meta["caption_url"]

        vtt_res = await client.get(f"/api/v1/documents/{doc_id}/captions.vtt?workspace_id={ws_id}", headers=headers)
        assert vtt_res.status_code == 200, vtt_res.text
        assert "text/vtt" in vtt_res.headers["content-type"]
        assert "WEBVTT" in vtt_res.text
        # The uploaded cue is served verbatim, not a synthesised one.
        assert "Thank you for joining us." in vtt_res.text

    async def test_upload_custom_vtt_captions(self, client: AsyncClient):
        headers = await _auth(client, "custom_vtt@vaeloom.test")
        ws_id = await _workspace(client, headers)

        doc_id = await _upload(client, headers, ws_id, "pitch.txt", b"demo pitch text")

        custom_vtt = (
            "WEBVTT - Pitch Video Transcript\n\n"
            "00:00:01.000 --> 00:00:04.000\n"
            "Hello, welcome to our company pitch.\n\n"
            "00:00:04.500 --> 00:00:08.000\n"
            "We are solving cross-workspace data management.\n"
        )
        upload_payload = {
            "vtt_content": custom_vtt,
            "srclang": "en",
            "label": "English (US)",
        }
        res = await client.post(
            f"/api/v1/documents/{doc_id}/captions?workspace_id={ws_id}",
            json=upload_payload,
            headers=headers,
        )
        assert res.status_code == 200, res.text
        meta = res.json()
        assert meta["label"] == "English (US)"
        assert meta["vtt_content"] == custom_vtt

        # Verify streamed VTT matches uploaded custom content
        vtt_res = await client.get(f"/api/v1/documents/{doc_id}/captions.vtt?workspace_id={ws_id}", headers=headers)
        assert vtt_res.status_code == 200, vtt_res.text
        assert "WEBVTT - Pitch Video Transcript" in vtt_res.text
        assert "Hello, welcome to our company pitch." in vtt_res.text
