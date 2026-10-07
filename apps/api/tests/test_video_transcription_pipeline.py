import uuid
import pytest
from httpx import AsyncClient

from api.config import Settings
from api.services.transcription_service import (
    MockTranscriptionProvider,
    TranscriptCue,
    TranscriptionService,
    format_webvtt,
)


class TestTranscriptionUnit:
    def test_cue_formatting(self):
        cue = TranscriptCue(start_seconds=1.5, end_seconds=4.75, text="Hello world")
        vtt = cue.to_vtt()
        assert "00:00:01.500 --> 00:00:04.750" in vtt
        assert "Hello world" in vtt

    def test_webvtt_formatting(self):
        cues = [
            TranscriptCue(0.0, 2.0, "First cue"),
            TranscriptCue(2.0, 5.0, "Second cue"),
        ]
        result = format_webvtt(cues)
        assert result.startswith("WEBVTT\n")
        assert "00:00:00.000 --> 00:00:02.000" in result
        assert "First cue" in result
        assert "Second cue" in result

    @pytest.mark.asyncio
    async def test_mock_transcription_provider(self):
        provider = MockTranscriptionProvider()
        cues = await provider.transcribe(b"fake video payload", "presentation.mp4")
        assert len(cues) >= 2
        assert all(isinstance(c, TranscriptCue) for c in cues)
        assert cues[0].start_seconds == 0.0
        assert cues[0].end_seconds > 0.0

    @pytest.mark.asyncio
    async def test_transcription_service_disabled(self):
        settings = Settings(transcription_enabled=False)
        svc = TranscriptionService(settings=settings)
        res = await svc.transcribe_media(b"video bytes", "demo.mp4")
        assert res is None

    @pytest.mark.asyncio
    async def test_transcription_service_enabled(self):
        settings = Settings(transcription_enabled=True, transcription_provider="mock")
        svc = TranscriptionService(settings=settings)
        res = await svc.transcribe_media(b"video bytes", "demo.mp4")
        assert res is not None
        assert res.startswith("WEBVTT\n")

    @pytest.mark.asyncio
    async def test_mock_provider_is_refused_outside_local(self):
        """Fabricated cues must not reach captions in a deployed environment.

        `mock` builds plausible, correctly-timed cues from the filename and
        duration. Persisting those into `captions_vtt` serves invented dialogue to
        a deaf or hard-of-hearing viewer under an "Auto-transcribed" label that is
        indistinguishable from a real transcript, so the combination is refused
        outside local/test rather than quietly degrading.
        """
        from api.services.transcription_service import TranscriptionNotConfiguredError

        deployed = Settings(
            transcription_enabled=True,
            transcription_provider="mock",
            service_environment="production",
        )
        svc = TranscriptionService(settings=deployed)
        with pytest.raises(TranscriptionNotConfiguredError):
            svc._get_provider()

        # Same config is still fine locally, which is where it is useful.
        local = Settings(
            transcription_enabled=True,
            transcription_provider="mock",
            service_environment="local",
        )
        assert TranscriptionService(settings=local)._get_provider() is not None


async def _auth_header(client: AsyncClient, email: str = "transcription_test@vaeloom.test") -> dict[str, str]:
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Password123!", "name": "Video Tester"},
    )
    if res.status_code == 200:
        token = res.json()["access_token"]
    else:
        login_res = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
        token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _get_ws(client: AsyncClient, headers: dict[str, str]) -> str:
    res = await client.get("/api/v1/workspaces", headers=headers)
    workspaces = res.json()
    if workspaces:
        return workspaces[0]["id"]
    created = await client.post(
        "/api/v1/workspaces",
        json={"name": "Video A11y Workspace"},
        headers=headers,
    )
    return created.json()["id"]


class TestVideoTranscriptionPipelineE2E:
    @pytest.mark.asyncio
    async def test_automated_transcription_on_video_upload(self, client: AsyncClient, monkeypatch):
        from api.config import settings
        monkeypatch.setattr(settings, "transcription_enabled", True)
        monkeypatch.setattr(settings, "transcription_provider", "mock")

        headers = await _auth_header(client, f"video_transcribe_{uuid.uuid4().hex[:6]}@vaeloom.test")
        ws_id = await _get_ws(client, headers)

        # Upload a video file
        upload_res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": ("keynote.mp4", b"synthetic video container content", "video/mp4")},
            headers=headers,
        )
        assert upload_res.status_code in (200, 201), upload_res.text
        doc_id = upload_res.json()["id"]

        # Check captions metadata
        meta_res = await client.get(f"/api/v1/documents/{doc_id}/captions?workspace_id={ws_id}", headers=headers)
        assert meta_res.status_code == 200, meta_res.text
        meta = meta_res.json()
        assert meta["has_captions"] is True
        assert meta["kind"] == "captions"

        # Stream WebVTT
        vtt_res = await client.get(f"/api/v1/documents/{doc_id}/captions.vtt?workspace_id={ws_id}", headers=headers)
        assert vtt_res.status_code == 200, vtt_res.text
        assert "text/vtt" in vtt_res.headers["content-type"]
        assert "WEBVTT" in vtt_res.text
        assert "Welcome to the recorded presentation" in vtt_res.text
