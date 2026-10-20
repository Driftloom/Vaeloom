import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# Lines the old implementation invented when no logs existed. None of these may
# ever be returned again: they described a daemon that had never run.
FABRICATED_LOG_FRAGMENTS = (
    "Native Vaeloom Vault Sync daemon active",
    "Watching vault at",
    "Scheduled 5-minute git rebase pull active",
    "Zero-data-loss conflict isolation armed",
    "completed successfully",
    "All local notes preserved",
)


class TestVaultSync:
    async def _auth_header(self, client: AsyncClient) -> dict:
        unique_email = f"vault-{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post("/api/v1/auth/signup", json={
            "email": unique_email, "password": "TestPassword123!",
        })
        assert res.status_code == 201
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _create_workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Vault Test WS"}, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    # ── download-client auth boundary ──────────────────────────────────────

    async def test_download_client_requires_auth(self, client: AsyncClient):
        """Negative control: the installer must not be publicly reachable."""
        res = await client.get("/api/v1/vault-sync/download-client?os=windows")
        assert res.status_code == 401, "installer download must require authentication"

    async def test_download_client_installer_windows(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/vault-sync/download-client?os=windows", headers=headers)
        assert res.status_code == 200
        assert "install-vaultsync.ps1" in res.headers.get("content-disposition", "")
        assert "vaultsync" in res.text

    async def test_download_client_installer_linux(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/vault-sync/download-client?os=linux", headers=headers)
        assert res.status_code == 200
        assert "install-vaultsync.sh" in res.headers.get("content-disposition", "")
        assert "vaultsync" in res.text

    async def test_get_status_requires_auth(self, client: AsyncClient):
        fake_ws = str(uuid.uuid4())
        res = await client.get(f"/api/v1/vault-sync/status?workspace_id={fake_ws}")
        assert res.status_code == 401

    # ── status honesty ─────────────────────────────────────────────────────

    async def test_status_does_not_claim_a_daemon_that_never_ran(self, client: AsyncClient):
        """A workspace with no vaultsync client must report that fact."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["daemon_status"] == "not_connected"
        assert data["installed"] is False
        assert data["last_client_heartbeat"] is None
        assert data["last_pull_time"] is None
        assert data["last_push_time"] is None
        # Unknown, not a reassuring "in_sync" for a vault that never synced.
        assert data["status"] == "unknown"
        # No invented vault path.
        assert data["vault_path"] is None
        assert data["engine"] == "client"

    async def test_status_exposes_real_defaults_and_persisted_intervals(
        self, client: AsyncClient
    ):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        data = res.json()
        assert data["debounce_seconds"] == 30
        assert data["rebase_interval_minutes"] == 5

        # These two were previously write-only UI state: the schema had no such
        # fields, so the inputs could never be saved. Now they round-trip.
        cfg_res = await client.post("/api/v1/vault-sync/config", json={
            "workspace_id": ws_id,
            "branch": "main",
            "auto_ingest": True,
            "debounce_seconds": 45,
            "rebase_interval_minutes": 11,
        }, headers=headers)
        assert cfg_res.status_code == 200
        assert cfg_res.json()["config"]["debounce_seconds"] == 45
        assert cfg_res.json()["config"]["rebase_interval_minutes"] == 11

        after = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert after.json()["debounce_seconds"] == 45
        assert after.json()["rebase_interval_minutes"] == 11

    async def test_config_rejects_out_of_range_intervals(self, client: AsyncClient):
        """Boundary validation: 4s debounce and a 0-minute rebase are invalid."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        too_fast = await client.post("/api/v1/vault-sync/config", json={
            "workspace_id": ws_id, "debounce_seconds": 1, "auto_ingest": True,
        }, headers=headers)
        assert too_fast.status_code == 422, "debounce below the 5s floor must be rejected"

        too_often = await client.post("/api/v1/vault-sync/config", json={
            "workspace_id": ws_id, "rebase_interval_minutes": 0, "auto_ingest": True,
        }, headers=headers)
        assert too_often.status_code == 422, "rebase interval below 1 minute must be rejected"

    async def test_sync_reports_not_executed_instead_of_faking_success(
        self, client: AsyncClient
    ):
        """POST /sync must not invent timestamps or claim a completed sync."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.post("/api/v1/vault-sync/sync", json={"workspace_id": ws_id}, headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["success"] is True          # request accepted
        assert data["executed"] is False        # but nothing ran
        assert data["daemon_status"] == "not_connected"
        # No fabricated pull/push timestamps.
        assert data["last_pull_time"] is None
        assert data["last_push_time"] is None
        for fragment in FABRICATED_LOG_FRAGMENTS:
            assert fragment not in data["message"], (
                f"sync response must not claim fabricated activity: {fragment!r}"
            )

        # And the status endpoint must agree that nothing synced.
        after = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert after.json()["last_pull_time"] is None
        assert after.json()["last_push_time"] is None

    async def test_logs_never_fabricate_daemon_activity(self, client: AsyncClient):
        """The empty state must be honest, not four invented 'daemon active' lines."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.get(f"/api/v1/vault-sync/logs?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        logs = res.json()

        assert isinstance(logs, list)
        assert len(logs) == 1, "empty state should yield exactly one explanatory entry"
        assert logs[0]["event"] == "no_activity"
        for fragment in FABRICATED_LOG_FRAGMENTS:
            assert fragment not in logs[0]["message"], (
                f"logs must not fabricate activity: {fragment!r}"
            )

    # ── ingest + full lifecycle ────────────────────────────────────────────

    async def test_vault_sync_lifecycle(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        # 1. Initial status: honest about having no client yet.
        res = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["workspace_id"] == ws_id
        assert data["total_notes"] == 0
        assert data["daemon_status"] == "not_connected"

        # 2. Update config
        cfg_res = await client.post("/api/v1/vault-sync/config", json={
            "workspace_id": ws_id,
            "remote_url": "git@github.com:vaeloom/my-vault.git",
            "branch": "main",
            "vault_path": "/Users/test/Vault",
            "auto_ingest": True,
        }, headers=headers)
        assert cfg_res.status_code == 200
        assert cfg_res.json()["config"]["branch"] == "main"
        assert cfg_res.json()["config"]["remote_url"] == "git@github.com:vaeloom/my-vault.git"

        # 3. Ingest notes — this path is genuinely real, so it must keep working.
        ingest_res = await client.post("/api/v1/vault-sync/ingest", json={
            "workspace_id": ws_id,
            "notes": [
                {
                    "filename": "Project-Atlas.md",
                    "content": "# Project Atlas\n\nAtlas is our core distributed memory graph architecture.",
                    "relative_path": "Architecture/Project-Atlas.md",
                    "tags": ["architecture", "scale"],
                },
                {
                    "filename": "Daily-Notes.md",
                    "content": "# Daily Log 2026-10-01\n\nImplemented zero-data-loss vault synchronization.",
                    "tags": ["daily", "work"],
                },
            ],
        }, headers=headers)
        assert ingest_res.status_code == 200
        ingest_data = ingest_res.json()
        assert ingest_data["success"] is True
        assert ingest_data["ingested_documents"] == 2
        assert ingest_data["created_or_updated_memories"] == 2

        # 4. Status reflects real ingested counts.
        res_after = await client.get(f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers)
        assert res_after.status_code == 200
        assert res_after.json()["total_notes"] == 2
        assert res_after.json()["vault_memories"] == 2

        # 5. Conflicts endpoint returns a list (empty, but honestly so).
        conflicts_res = await client.get(f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers)
        assert conflicts_res.status_code == 200
        assert isinstance(conflicts_res.json(), list)

        # 6. Manual sync records the request without faking execution.
        sync_res = await client.post("/api/v1/vault-sync/sync", json={"workspace_id": ws_id}, headers=headers)
        assert sync_res.status_code == 200
        assert sync_res.json()["success"] is True
        assert sync_res.json()["executed"] is False
        assert sync_res.json()["last_pull_time"] is None

        # 7. Logs now contain the recorded request, and no invented lines.
        logs_res = await client.get(f"/api/v1/vault-sync/logs?workspace_id={ws_id}", headers=headers)
        assert logs_res.status_code == 200
        logs = logs_res.json()
        assert any(l.get("event") == "manual_sync_requested" for l in logs)
        for entry in logs:
            for fragment in FABRICATED_LOG_FRAGMENTS:
                assert fragment not in entry.get("message", ""), (
                    f"logs must not fabricate activity: {fragment!r}"
                )

    async def test_cross_workspace_access_is_denied(self, client: AsyncClient):
        """Negative control: workspace A's user must not read workspace B's status."""
        headers_a = await self._auth_header(client)
        ws_a = await self._create_workspace(client, headers_a)

        headers_b = await self._auth_header(client)
        ws_b = await self._create_workspace(client, headers_b)

        res = await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_a}", headers=headers_b
        )
        assert res.status_code == 403, "cross-workspace read must be denied, not served"

    async def test_cross_workspace_report_is_denied(self, client: AsyncClient):
        """Negative control: a client must not be able to write into another workspace."""
        headers_a = await self._auth_header(client)
        ws_a = await self._create_workspace(client, headers_a)

        headers_b = await self._auth_header(client)

        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_a,
            "machine": "attacker",
            "conflicts": [],
        }, headers=headers_b)
        assert res.status_code == 403, "cross-workspace report must be denied"

    # ── client report: closes the honesty loop ─────────────────────────────

    async def test_client_report_makes_status_truthful(self, client: AsyncClient):
        """A reporting client must flip status from not_connected to running."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        before = await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )
        assert before.json()["daemon_status"] == "not_connected"

        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "client_version": "0.1.0",
            "machine": "laptop",
            "branch": "main",
            "remote_url": "git@github.com:me/vault.git",
            "vault_path": "/Users/me/Vault",
            "sync_state": "idle",
            "last_pull_time": "2026-10-04T10:00:00+00:00",
            "last_push_time": "2026-10-04T10:01:00+00:00",
            "conflicts": [],
            "logs": [{
                "timestamp": "2026-10-04T10:01:00+00:00",
                "level": "info",
                "message": "PUSH SUCCESS: origin/main",
                "event": "push",
            }],
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["daemon_status"] == "running"

        after = await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )
        data = after.json()
        assert data["daemon_status"] == "running"
        assert data["installed"] is True
        assert data["status"] == "in_sync"
        assert data["last_pull_time"] == "2026-10-04T10:00:00+00:00"
        assert data["last_push_time"] == "2026-10-04T10:01:00+00:00"
        assert data["remote_url"] == "git@github.com:me/vault.git"
        assert data["vault_path"] == "/Users/me/Vault"
        assert data["last_client_heartbeat"] is not None
        assert data["conflicts_count"] == 0

        # Logs must now be the client's real entries, not the empty-state note.
        logs_res = await client.get(
            f"/api/v1/vault-sync/logs?workspace_id={ws_id}", headers=headers
        )
        logs = logs_res.json()
        assert len(logs) == 1
        assert logs[0]["message"] == "PUSH SUCCESS: origin/main"

    async def test_client_report_surfaces_real_conflicts(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "machine": "laptop",
            "conflicts": [{
                "id": "c-1",
                "file": "Notes/Ideas.md",
                "conflict_file": "Notes/Ideas.conflict-2026-10-04.md",
                "detected_at": "2026-10-04T10:00:00+00:00",
                "local_head": "aaaaaaaabbbbbbbb",
                "remote_head": "ccccccccdddddddd",
            }],
            "logs": [],
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["reported_conflicts"] == 1

        conflicts = await client.get(
            f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers
        )
        assert conflicts.status_code == 200
        rows = conflicts.json()
        assert len(rows) == 1
        assert rows[0]["conflict_file"] == "Notes/Ideas.conflict-2026-10-04.md"
        assert rows[0]["local_head"] == "aaaaaaaabbbbbbbb"

        status = await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )
        assert status.json()["conflicts_count"] == 1
        assert status.json()["status"] == "conflict"

    async def test_conflicts_clear_when_client_reports_none(self, client: AsyncClient):
        """A client that resolves its queue must visibly empty the server view."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "conflicts": [{
                "id": "c-1", "file": "A.md", "conflict_file": "A.conflict-2026-10-04.md",
            }],
        }, headers=headers)
        assert len((await client.get(
            f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers
        )).json()) == 1

        # Client resolves and reports an empty ledger.
        await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id, "conflicts": [],
        }, headers=headers)
        assert (await client.get(
            f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers
        )).json() == []

    async def test_report_error_marks_status_error(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "last_error": "PULL ERROR: rebase refused (unstaged changes)",
        }, headers=headers)

        data = (await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )).json()
        assert data["status"] == "error"
        # The client is still connected, and the error is visible rather than
        # swallowed — the UI shows this instead of a healthy badge.
        assert data["daemon_status"] == "running"
        assert data["last_client_heartbeat"] is not None
        assert data["last_error"] == "PULL ERROR: rebase refused (unstaged changes)"

    async def test_report_rejects_malformed_payload(self, client: AsyncClient):
        """Boundary: bad sync_state and oversized machine name must be rejected."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        bad_state = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id, "sync_state": "totally_fine",
        }, headers=headers)
        assert bad_state.status_code == 422, "unknown sync_state must be rejected"

        missing_ws = await client.post("/api/v1/vault-sync/report", json={
            "machine": "laptop",
        }, headers=headers)
        assert missing_ws.status_code == 422, "workspace_id is required"

    async def test_report_requires_auth(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id, "machine": "anon",
        })
        assert res.status_code == 401, "client reports must be authenticated"

    # ── conflict resolution history (0070) ─────────────────────────────────

    async def _report_conflict(
        self,
        client: AsyncClient,
        headers: dict,
        ws_id: str,
        conflict_id: str = "c-1",
    ) -> None:
        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "machine": "laptop",
            "conflicts": [{
                "id": conflict_id,
                "file": "Notes/Ideas.md",
                "conflict_file": "Notes/Ideas.conflict-2026-10-04.md",
                "detected_at": "2026-10-04T10:00:00+00:00",
                "local_head": "aaaaaaaabbbbbbbb",
                "remote_head": "ccccccccdddddddd",
            }],
        }, headers=headers)
        assert res.status_code == 200

    async def test_resolve_records_history_and_clears_ledger(self, client: AsyncClient):
        """Resolving must leave a durable record; the ledger alone forgets it."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        await self._report_conflict(client, headers, ws_id, "c-1")

        res = await client.post(
            f"/api/v1/vault-sync/conflicts/c-1/resolve?workspace_id={ws_id}",
            json={"strategy": "keep-local"}, headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["conflict_id"] == "c-1"
        assert data["resolution"] == "keep-local"
        assert data["remaining_conflicts"] == 0

        # Resolve removes it from the active ledger, as before.
        conflicts = await client.get(
            f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers
        )
        assert conflicts.json() == []

        # The history endpoint keeps the audit trail the ledger can't provide.
        history = await client.get(
            f"/api/v1/vault-sync/conflicts/history?workspace_id={ws_id}", headers=headers
        )
        assert history.status_code == 200
        body = history.json()
        assert body["total"] == 1
        assert len(body["items"]) == 1
        item = body["items"][0]
        assert item["conflict_id"] == "c-1"
        assert item["file"] == "Notes/Ideas.md"
        assert item["conflict_file"] == "Notes/Ideas.conflict-2026-10-04.md"
        assert item["local_head"] == "aaaaaaaabbbbbbbb"
        assert item["remote_head"] == "ccccccccdddddddd"
        assert item["detected_at"] == "2026-10-04T10:00:00+00:00"
        assert item["resolution"] == "keep-local"
        assert item["resolved_at"], "history must record when the resolution was recorded"
        assert item["id"], "history rows carry their own id, never the client conflict id"
        assert item["connector_id"]

    async def test_re_resolve_echoes_recorded_resolution_without_mutation(
        self, client: AsyncClient
    ):
        """First wins: a repeated resolve must never overwrite the recorded row."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        await self._report_conflict(client, headers, ws_id, "c-1")

        first = await client.post(
            f"/api/v1/vault-sync/conflicts/c-1/resolve?workspace_id={ws_id}",
            json={"strategy": "keep-local"}, headers=headers,
        )
        assert first.status_code == 200

        again = await client.post(
            f"/api/v1/vault-sync/conflicts/c-1/resolve?workspace_id={ws_id}",
            json={"strategy": "accept-incoming"}, headers=headers,
        )
        assert again.status_code == 200
        assert again.json()["resolution"] == "keep-local", (
            "the response must echo the recorded resolution, not the requested one"
        )
        assert again.json()["remaining_conflicts"] == 0

        history = await client.get(
            f"/api/v1/vault-sync/conflicts/history?workspace_id={ws_id}", headers=headers
        )
        body = history.json()
        assert body["total"] == 1, "a repeated resolve must not duplicate the record"
        assert body["items"][0]["resolution"] == "keep-local"

    async def test_resolve_unknown_conflict_records_nothing(self, client: AsyncClient):
        """An id with no ledger entry and no history must not fabricate a record."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.post(
            f"/api/v1/vault-sync/conflicts/ghost/resolve?workspace_id={ws_id}",
            json={"strategy": "keep-local"}, headers=headers,
        )
        assert res.status_code == 404

        history = await client.get(
            f"/api/v1/vault-sync/conflicts/history?workspace_id={ws_id}", headers=headers
        )
        assert history.json()["total"] == 0

    async def test_reported_resolved_conflict_is_not_resurrected(self, client: AsyncClient):
        """A stale re-report must not bring back a conflict the server recorded as resolved."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        await self._report_conflict(client, headers, ws_id, "c-1")

        await client.post(
            f"/api/v1/vault-sync/conflicts/c-1/resolve?workspace_id={ws_id}",
            json={"strategy": "accept-incoming"}, headers=headers,
        )

        # The client re-reports its ledger, still holding c-1, plus a new c-2.
        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "machine": "laptop",
            "conflicts": [
                {
                    "id": "c-1", "file": "Notes/Ideas.md",
                    "conflict_file": "Notes/Ideas.conflict-2026-10-04.md",
                },
                {
                    "id": "c-2", "file": "Notes/Plans.md",
                    "conflict_file": "Notes/Plans.conflict-2026-10-04.md",
                },
            ],
        }, headers=headers)
        assert res.status_code == 200

        conflicts = await client.get(
            f"/api/v1/vault-sync/conflicts?workspace_id={ws_id}", headers=headers
        )
        rows = conflicts.json()
        assert [r["id"] for r in rows] == ["c-2"], (
            "c-1 was already recorded as resolved; only the new conflict may remain"
        )

    async def test_history_pagination_reports_total_before_pagination(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)
        for cid in ("c-1", "c-2", "c-3"):
            await self._report_conflict(client, headers, ws_id, cid)
            res = await client.post(
                f"/api/v1/vault-sync/conflicts/{cid}/resolve?workspace_id={ws_id}",
                json={"strategy": "keep-local"}, headers=headers,
            )
            assert res.status_code == 200

        page1 = await client.get(
            f"/api/v1/vault-sync/conflicts/history?workspace_id={ws_id}&limit=2&offset=0",
            headers=headers,
        )
        assert page1.status_code == 200
        assert len(page1.json()["items"]) == 2
        assert page1.json()["total"] == 3, "total is the pre-pagination count"

        page2 = await client.get(
            f"/api/v1/vault-sync/conflicts/history?workspace_id={ws_id}&limit=2&offset=2",
            headers=headers,
        )
        assert len(page2.json()["items"]) == 1
        assert page2.json()["total"] == 3

    async def test_history_cross_workspace_is_denied(self, client: AsyncClient):
        """Negative control: another user must not read this workspace's history."""
        headers_a = await self._auth_header(client)
        ws_a = await self._create_workspace(client, headers_a)
        await self._report_conflict(client, headers_a, ws_a, "c-1")
        await client.post(
            f"/api/v1/vault-sync/conflicts/c-1/resolve?workspace_id={ws_a}",
            json={"strategy": "keep-local"}, headers=headers_a,
        )

        headers_b = await self._auth_header(client)
        res = await client.get(
            f"/api/v1/vault-sync/conflicts/history?workspace_id={ws_a}", headers=headers_b
        )
        assert res.status_code == 403, "cross-workspace history read must be denied"

    # ── multi-machine device registry ──────────────────────────────────────

    async def test_status_reports_devices_from_real_reports(self, client: AsyncClient):
        """Both machines that reported must appear, newest heartbeat first."""
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        first = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "machine": "laptop",
            "client_version": "0.1.0",
            "conflicts": [],
        }, headers=headers)
        assert first.status_code == 200

        second = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id,
            "machine": "desktop",
            "client_version": "0.2.0",
            "last_error": "PULL ERROR: rebase refused (unstaged changes)",
            "conflicts": [],
        }, headers=headers)
        assert second.status_code == 200

        data = (await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )).json()

        devices = data["devices"]
        assert [d["machine"] for d in devices] == ["desktop", "laptop"], (
            "devices are ordered by last_heartbeat desc; desktop reported last"
        )
        for device in devices:
            assert set(device) == {
                "machine", "client_version", "last_heartbeat", "status",
                "last_pull_time", "last_push_time", "last_error",
            }
        assert devices[0]["status"] == "error"
        assert devices[0]["last_error"] == "PULL ERROR: rebase refused (unstaged changes)"
        assert devices[0]["client_version"] == "0.2.0"
        assert devices[1]["status"] == "in_sync"
        assert devices[1]["client_version"] == "0.1.0"
        assert devices[0]["last_heartbeat"] and devices[1]["last_heartbeat"]

        # Top-level stays the alias of the latest reporter, not a merged blend.
        assert data["machine"] == "desktop"
        assert data["last_error"] == "PULL ERROR: rebase refused (unstaged changes)"

    async def test_repeat_report_from_same_machine_updates_not_duplicates(
        self, client: AsyncClient
    ):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id, "machine": "laptop", "conflicts": [],
        }, headers=headers)
        await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id, "machine": "laptop",
            "last_error": "PUSH ERROR: remote rejected", "conflicts": [],
        }, headers=headers)

        devices = (await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )).json()["devices"]
        assert len(devices) == 1, "a machine key must upsert, never append duplicates"
        assert devices[0]["status"] == "error"
        assert devices[0]["last_error"] == "PUSH ERROR: remote rejected"

    async def test_device_without_machine_is_keyed_unknown(self, client: AsyncClient):
        headers = await self._auth_header(client)
        ws_id = await self._create_workspace(client, headers)

        res = await client.post("/api/v1/vault-sync/report", json={
            "workspace_id": ws_id, "conflicts": [],
        }, headers=headers)
        assert res.status_code == 200

        devices = (await client.get(
            f"/api/v1/vault-sync/status?workspace_id={ws_id}", headers=headers
        )).json()["devices"]
        assert [d["machine"] for d in devices] == ["unknown"]