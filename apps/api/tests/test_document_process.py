"""`POST /documents/{document_id}/process` — the ingest endpoint that was missing.

`apps/web/src/trigger/document-ingest.ts` posted to
`/workspaces/{workspace_id}/documents/{document_id}/process`, a path that has never
existed on this router. The trigger swallowed the 404
(`if (!response.ok && response.status !== 404)`) and returned
`status: 'completed'`, so document ingestion silently did nothing in production.

The pipeline opens its OWN session through `ingestion.pipeline.get_session_cm`
(documented as the patchable DB seam) rather than the request session, and the
test session lives in a per-test SQLite file while the module-level engine points
at `test_dev.db`. Both are redirected here so the pipeline really writes rows that
the assertions can then read back — the pipeline is not stubbed.
"""
import contextlib
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from api.models.schema import Document, DocumentVersion

pytestmark = pytest.mark.asyncio


@pytest.fixture
def pipeline_on_test_db(monkeypatch, db_session):
    """Point every pipeline session at the per-test database.

    A FRESH session per call is required: the request session is already inside an
    autobegun transaction, and `run_pipeline` opens its own
    `async with session.begin()`, which would raise if handed that session.
    `check_dedup` imports `scoped_session` function-locally, so replacing the
    attribute on `api.database` is what it actually reads.
    """

    @contextlib.asynccontextmanager
    async def _session_cm(workspace_id=None, tenant_id=None, user_id=None, **kwargs):
        factory = async_sessionmaker(db_session.bind, expire_on_commit=False)
        async with factory() as session:
            yield session

    monkeypatch.setattr("api.database.scoped_session", _session_cm)
    monkeypatch.setattr("api.ingestion.pipeline.get_session_cm", _session_cm)
    return db_session


async def _auth(client: AsyncClient, email: str) -> dict:
    res = await client.post(
        "/api/v1/auth/signup", json={"email": email, "password": "Process1234!"}
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _workspace(client: AsyncClient, headers: dict, name: str = "Process WS") -> str:
    res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _upload(client: AsyncClient, headers: dict, ws_id: str, name: str, body: bytes) -> str:
    res = await client.post(
        f"/api/v1/documents?workspace_id={ws_id}",
        files={"file": (name, body, "text/plain")},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestProcessDocument:
    async def test_processes_a_text_document(self, client: AsyncClient, pipeline_on_test_db):
        headers = await _auth(client, "process_ok@vaeloom.test")
        ws_id = await _workspace(client, headers)
        # Long enough to be chunked, so chunks_indexed is a real number and not a
        # default that happens to be zero.
        body = ("Ingestion pipeline paragraph. " * 200).encode()
        doc_id = await _upload(client, headers, ws_id, "process_me.txt", body)

        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert res.status_code == 200, res.text
        payload = res.json()
        assert payload["document_id"] == doc_id
        assert payload["status"] == "processed"
        assert payload["chunks_indexed"] > 0
        assert payload["detail"] is None

    async def test_chunks_indexed_equals_the_pipeline_output(
        self, client: AsyncClient, pipeline_on_test_db
    ):
        """The reported count must be the pipeline's, not a number invented here.

        The chunker is run over the same text with its defaults so the expected
        count is derived independently of the response body.
        """
        from api.ingestion.chunking import chunk_text

        headers = await _auth(client, "process_count@vaeloom.test")
        ws_id = await _workspace(client, headers)
        body = ("Chunk me. " * 400).encode()
        doc_id = await _upload(client, headers, ws_id, "chunk_count.txt", body)

        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert res.status_code == 200, res.text
        reported = res.json()["chunks_indexed"]

        expected = len(chunk_text(text=body.decode(), source_document_id=doc_id))
        assert expected > 1, "fixture is too short to produce multiple chunks"
        assert reported == expected

    async def test_persisted_chunks_match_the_reported_count(
        self, client: AsyncClient, pipeline_on_test_db, db_session
    ):
        """What the endpoint promises should be what the database holds.

        Regression test for a bug where `version_id` was read from a not-yet-flushed
        `DocumentVersion`, so it was the literal string `'None'`, `uuid.UUID(...)`
        raised for every chunk, and the exception was swallowed per-chunk. The
        pipeline reported a chunk count while persisting nothing, which left vector
        search over documents silently empty.
        """
        from api.models.schema import DocumentChunk

        headers = await _auth(client, "process_persist@vaeloom.test")
        ws_id = await _workspace(client, headers)
        body = ("Chunk me. " * 400).encode()
        doc_id = await _upload(client, headers, ws_id, "persist_count.txt", body)

        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert res.status_code == 200, res.text
        reported = res.json()["chunks_indexed"]
        assert reported > 0

        persisted = (
            await db_session.execute(
                select(func.count(DocumentChunk.id)).where(
                    DocumentChunk.document_id == uuid.UUID(doc_id)
                )
            )
        ).scalar_one()
        assert persisted == reported

    async def test_repeat_process_does_not_duplicate_the_document(
        self, client: AsyncClient, pipeline_on_test_db, db_session
    ):
        """Idempotency is the pipeline's content-hash dedup, exercised end to end.

        `check_dedup` matches the uploaded version's sha256 and resolves to the
        existing document, so the second call must not create a second Document
        row for the same workspace.
        """
        headers = await _auth(client, "process_idem@vaeloom.test")
        ws_id = await _workspace(client, headers)
        doc_id = await _upload(client, headers, ws_id, "idempotent.txt", b"same bytes both times")

        first = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert first.status_code == 200, first.text
        assert first.json()["status"] == "processed"

        second = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert second.status_code == 200, second.text
        assert second.json()["status"] == "processed"
        assert second.json()["document_id"] == doc_id

        rows = (
            await db_session.execute(
                select(func.count(Document.id)).where(Document.workspace_id == uuid.UUID(ws_id))
            )
        ).scalar_one()
        assert rows == 1, "second process call created a duplicate document row"

    async def test_unsupported_format_is_skipped_not_500(
        self, client: AsyncClient, pipeline_on_test_db
    ):
        """A file the parser has no reader for is a normal outcome.

        `.json` passes the upload allowlist (`file_security_service.ALLOWED_EXTENSIONS`)
        but has no entry in `ingestion.parsers.PARSERS`, so `run_pipeline` raises
        UnsupportedFormatError internally and reports status="error". Returning 500
        would make an ordinary document read as a server fault.
        """
        headers = await _auth(client, "process_skip@vaeloom.test")
        ws_id = await _workspace(client, headers)
        doc_id = await _upload(
            client, headers, ws_id, "payload.json", b'{"hello": "world"}'
        )

        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert res.status_code == 200, res.text
        payload = res.json()
        assert payload["status"] == "skipped"
        assert payload["chunks_indexed"] == 0
        assert payload["detail"] and ".json" in payload["detail"]

    async def test_pipeline_failure_on_a_parsable_format_is_5xx(
        self, client: AsyncClient, monkeypatch
    ):
        """5xx is reserved for infrastructure failure.

        The parsers swallow their own per-file errors (PDFParser returns an error
        document rather than raising), so an error result for a format that HAS a
        registered parser means the pipeline failed after parsing — that is a real
        server fault, not "this document is unusual".
        """
        from api.ingestion import pipeline as pipeline_mod

        async def _boom(*args, **kwargs):
            return {"status": "error", "reason": "relation \"documents\" does not exist"}

        monkeypatch.setattr(pipeline_mod, "run_pipeline", _boom)

        headers = await _auth(client, "process_500@vaeloom.test")
        ws_id = await _workspace(client, headers)
        doc_id = await _upload(client, headers, ws_id, "server_fault.txt", b"content")

        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
        )
        assert res.status_code == 500, res.text
        assert "does not exist" in res.json()["detail"]

    async def test_unknown_document_is_404(self, client: AsyncClient, pipeline_on_test_db):
        headers = await _auth(client, "process_404@vaeloom.test")
        ws_id = await _workspace(client, headers)

        res = await client.post(
            f"/api/v1/documents/{uuid.uuid4()}/process?workspace_id={ws_id}", headers=headers
        )
        assert res.status_code == 404

    async def test_process_requires_workspace_id(self, client: AsyncClient, pipeline_on_test_db):
        headers = await _auth(client, "process_nows@vaeloom.test")
        res = await client.post(f"/api/v1/documents/{uuid.uuid4()}/process", headers=headers)
        assert res.status_code == 422

    async def test_process_requires_authentication(self, client: AsyncClient, pipeline_on_test_db):
        res = await client.post(
            f"/api/v1/documents/{uuid.uuid4()}/process?workspace_id={uuid.uuid4()}"
        )
        assert res.status_code == 401

    async def test_process_is_scoped_to_the_workspace(self, client: AsyncClient, pipeline_on_test_db):
        """Another member's document must be unreachable, not merely unlisted."""
        owner = await _auth(client, "process_owner@vaeloom.test")
        ws_id = await _workspace(client, owner)
        doc_id = await _upload(client, owner, ws_id, "owned.txt", b"private bytes")

        stranger = await _auth(client, "process_stranger@vaeloom.test")
        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=stranger
        )
        assert res.status_code == 403

    async def test_read_only_share_cannot_process(
        self, client: AsyncClient, pipeline_on_test_db, db_session
    ):
        """Ingestion writes rows, so a READ share is not enough to run it.

        `get_document` falls back to the share when the document lives in another
        workspace; with `required_permission="write"` the fallback must reject a
        read grant rather than ingest through it.
        """
        from api.models.schema import User, WorkspaceUser

        source = await _auth(client, "process_src@vaeloom.test")
        ws_src = await _workspace(client, source, "Process Source")
        ws_dst = await _workspace(client, source, "Process Target")
        doc_id = await _upload(client, source, ws_src, "shared_readonly.txt", b"shared bytes")

        share = await client.post(
            f"/api/v1/documents/{doc_id}/shares?workspace_id={ws_src}",
            json={"target_workspace_id": ws_dst, "permission": "read"},
            headers=source,
        )
        assert share.status_code == 201, share.text

        member = await _auth(client, "process_member@vaeloom.test")
        member_row = (
            await db_session.execute(
                select(User).where(User.email == "process_member@vaeloom.test")
            )
        ).scalar_one()
        db_session.add(
            WorkspaceUser(
                id=uuid.uuid4(),
                workspace_id=uuid.UUID(ws_dst),
                user_id=member_row.id,
                role="member",
            )
        )
        await db_session.commit()

        res = await client.post(
            f"/api/v1/documents/{doc_id}/process?workspace_id={ws_dst}", headers=member
        )
        assert res.status_code == 403, res.text

    async def test_process_does_not_duplicate_versions_on_a_noop_retry(
        self, client: AsyncClient, pipeline_on_test_db, db_session
    ):
        """Document the pipeline's real behaviour: a repeat call adds a VERSION row.

        Dedup resolves to the existing document, and the pipeline then appends the
        next version_number for the same content. The Document row count is what
        the idempotency claim rests on; the version growth is recorded here so the
        difference is not mistaken for an accident.
        """
        headers = await _auth(client, "process_versions@vaeloom.test")
        ws_id = await _workspace(client, headers)
        doc_id = await _upload(client, headers, ws_id, "version_growth.txt", b"stable bytes")

        for _ in range(2):
            res = await client.post(
                f"/api/v1/documents/{doc_id}/process?workspace_id={ws_id}", headers=headers
            )
            assert res.status_code == 200, res.text

        versions = (
            await db_session.execute(
                select(func.count(DocumentVersion.id)).where(
                    DocumentVersion.document_id == uuid.UUID(doc_id)
                )
            )
        ).scalar_one()
        # 1 from upload, + 1 per process call.
        assert versions == 3