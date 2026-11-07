import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import WorkspaceCapability
from api.routers.capabilities import MARKDOWN_DOC_MAX_CHARS
from api.services.skill_catalog_service import SKILL_CATALOG, tool_scope_vocabulary
from api.services.skill_injection import build_skill_directive

pytestmark = pytest.mark.asyncio


async def _setup_workspace(client: AsyncClient) -> tuple[dict, str]:
    email = f"cap_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "TestPassword123!",
        "name": "Cap Tester",
    })
    assert res.status_code == 201
    token = res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Create workspace
    ws_res = await client.post("/api/v1/workspaces", json={
        "name": "Capabilities Test Space",
    }, headers=auth_headers)
    assert ws_res.status_code == 201
    workspace_id = ws_res.json()["id"]

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Workspace-Id": workspace_id,
    }
    return headers, workspace_id


class TestCapabilitiesE2E:
    async def _setup_auth_and_workspace(self, client: AsyncClient) -> tuple[dict, str]:
        return await _setup_workspace(client)

    async def test_capabilities_crud_and_testing(self, client: AsyncClient):
        headers, workspace_id = await self._setup_auth_and_workspace(client)

        # 1. Initial list should be empty
        list_res = await client.get("/api/v1/capabilities", headers=headers)
        assert list_res.status_code == 200
        assert isinstance(list_res.json(), list)

        # 2. Create custom skill
        skill_payload = {
            "name": "forensic-code-auditor",
            "category": "skill",
            "description": "Performs deep forensic audits on source diffs",
            "version": "1.0.0",
            "config": {
                "tags": ["Security", "Audit"],
                "autonomy": "autonomous",
            },
        }
        create_res = await client.post("/api/v1/capabilities", json=skill_payload, headers=headers)
        assert create_res.status_code == 201
        skill_data = create_res.json()
        assert skill_data["name"] == "forensic-code-auditor"
        assert skill_data["category"] == "skill"
        assert skill_data["enabled"] is True
        skill_id = skill_data["id"]

        # 3. Create custom tool (dynamic tool registration)
        tool_payload = {
            "name": "custom_echo_tool",
            "category": "tool",
            "description": "Echoes back input payload",
            "config": {
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message": {"type": "string"},
                    },
                },
            },
        }
        create_tool_res = await client.post("/api/v1/capabilities", json=tool_payload, headers=headers)
        assert create_tool_res.status_code == 201
        tool_id = create_tool_res.json()["id"]

        # 4. Duplicate prevention (409 Conflict)
        dup_res = await client.post("/api/v1/capabilities", json=skill_payload, headers=headers)
        assert dup_res.status_code == 409

        # 5. Invalid category validation (400 Bad Request)
        bad_cat_payload = {
            "name": "bad-cat",
            "category": "invalid_category",
            "description": "invalid",
        }
        bad_res = await client.post("/api/v1/capabilities", json=bad_cat_payload, headers=headers)
        assert bad_res.status_code == 400

        # 6. Get single capability
        get_res = await client.get(f"/api/v1/capabilities/{skill_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["id"] == skill_id

        # 7. Update / toggle enabled state
        toggle_res = await client.patch(
            f"/api/v1/capabilities/{skill_id}",
            json={"enabled": False},
            headers=headers,
        )
        assert toggle_res.status_code == 200
        assert toggle_res.json()["enabled"] is False

        # 8. Test capability endpoint (real diagnostic execution)
        test_res = await client.post(
            f"/api/v1/capabilities/{tool_id}/test",
            json={"input": {"message": "hello world"}},
            headers=headers,
        )
        assert test_res.status_code == 200
        test_data = test_res.json()
        assert test_data["status"] == "success"
        assert test_data["executed"] is True
        assert "latency_ms" in test_data
        assert test_data["latency_ms"] >= 0.0
        assert test_data["output"]["status"] == "ok"
        assert test_data["output"]["tool"] == "custom_echo_tool"
        assert test_data["output"]["echo"] == {"message": "hello world"}

        # 8b. Test skill capability endpoint (validation only -- nothing is dispatched)
        test_skill_res = await client.post(
            f"/api/v1/capabilities/{skill_id}/test",
            json={"input": {"message": "audit code for security vulnerabilities"}},
            headers=headers,
        )
        assert test_skill_res.status_code == 200
        test_skill_data = test_skill_res.json()
        # The skill branch parses the document, estimates its tokens, checks
        # triggers and quarantines it. It runs no code, so it must not report
        # `executed`. This used to assert True, which contradicted the
        # endpoint's own docstring, the sibling NO_EXECUTABLE_RUNTIME branch,
        # and `agents.py` for the same check.
        assert test_skill_data["executed"] is False
        assert test_skill_data["status"] in ("success", "warning", "error")
        assert "latency_ms" in test_skill_data
        assert "output" in test_skill_data
        assert test_skill_data["output"] is not None, test_skill_data
        assert test_skill_data["output"]["skill_name"] == "forensic-code-auditor", test_skill_data
        assert "violations" in test_skill_data["output"]
        assert test_skill_data["output"]["syntax_valid"] is False
        assert "estimated_tokens" in test_skill_data["output"]

        # 9. Filter capabilities by category
        filter_res = await client.get("/api/v1/capabilities?category=skill", headers=headers)
        assert filter_res.status_code == 200
        skills = filter_res.json()
        assert len(skills) >= 1
        assert all(s["category"] == "skill" for s in skills)
        assert all(s["installed"] is True for s in skills)
        assert all(s["installed_at"] is not None for s in skills)

        # 9b. Telemetry fields and skill metadata are persisted on the row.
        # The skill test call in step 8b carried a message, so it was a dry-run
        # probe: it must NOT have moved usage_count. (A message-less validation
        # call is not a probe and does record; TestSkillProbeDryRun owns that
        # positive control along with the full probe contract.)
        skill_row = next(s for s in skills if s["id"] == skill_id)
        # A skill message-probe is a DRY RUN: the endpoint answers "what would
        # happen on a real turn", so it must not move usage_count. Counting a
        # probe would report usage that never happened.
        assert skill_row["usage_count"] == 0, skill_row
        assert skill_row["last_used_at"] is None, skill_row
        assert skill_row["tags"] == ["Security", "Audit"]
        assert skill_row["autonomy"] == "autonomous"

        # The tool test above really did execute, so the tool's counter moved.
        all_res = await client.get("/api/v1/capabilities", headers=headers)
        assert all_res.status_code == 200
        tool_row = next(s for s in all_res.json() if s["id"] == tool_id)
        assert tool_row["usage_count"] == 1, tool_row
        assert tool_row["last_used_at"] is not None, tool_row

        # 10. Merge the workspace rows with the browsable catalog
        merged_res = await client.get(
            "/api/v1/capabilities?category=skill&include_catalog=true", headers=headers
        )
        assert merged_res.status_code == 200
        merged = merged_res.json()
        browsable = [m for m in merged if not m["installed"]]
        assert len(browsable) == len(SKILL_CATALOG)
        assert all(m["id"] is None and m["enabled"] is False for m in browsable)
        assert all(m["trust_class"] in ("core_trusted", "community") for m in browsable)
        assert all("## Mission" in m["markdown_doc"] for m in browsable)

        # 10b. The catalog route is not swallowed by the {cap_id} route
        catalog_res = await client.get("/api/v1/capabilities/catalog?category=skill", headers=headers)
        assert catalog_res.status_code == 200
        assert len(catalog_res.json()) == len(SKILL_CATALOG)

        # 11. Delete capability
        del_res = await client.delete(f"/api/v1/capabilities/{skill_id}", headers=headers)
        assert del_res.status_code == 204

        # Verify it's gone
        get_after_del = await client.get(f"/api/v1/capabilities/{skill_id}", headers=headers)
        assert get_after_del.status_code == 404


class TestMarkdownDocSizeCap:
    """A document past the cap must fail at write time, on both write paths."""

    async def test_create_refuses_a_document_past_the_cap(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)
        oversized = MARKDOWN_DOC_MAX_CHARS + 1

        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "oversized-doc-skill",
                "category": "skill",
                "description": "d",
                "config": {"markdown_doc": "x" * oversized},
            },
            headers=headers,
        )

        assert res.status_code == 400
        detail = res.json()["detail"]
        assert f"markdown_doc is {oversized} characters" in detail
        assert str(MARKDOWN_DOC_MAX_CHARS) in detail

    async def test_the_cap_boundary_itself_is_accepted(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)

        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "boundary-doc-skill",
                "category": "skill",
                "description": "d",
                "config": {"markdown_doc": "x" * MARKDOWN_DOC_MAX_CHARS},
            },
            headers=headers,
        )

        assert res.status_code == 201

    async def test_update_cannot_smuggle_a_document_past_the_cap(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "smuggler-skill",
                "category": "skill",
                "description": "d",
                "config": {"markdown_doc": "x" * 16},
            },
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        res = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"config": {"markdown_doc": "x" * (MARKDOWN_DOC_MAX_CHARS + 1)}},
            headers=headers,
        )
        assert res.status_code == 400

        # Negative control: the same patch with a small document succeeds.
        ok = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"config": {"markdown_doc": "x" * 17}},
            headers=headers,
        )
        assert ok.status_code == 200


class TestCatalogWireContract:
    """`/catalog` publishes a typed model, not an untyped dict blob."""

    _FIELDS = {
        "slug": str,
        "name": str,
        "description": str,
        "tags": list,
        "version": str,
        "author": str,
        "required_scope": str,
        "autonomy": str,
        "trust_class": str,
        "triggers": list,
        "markdown_doc": str,
        "bundled": bool,
        "self_check": str,
    }

    async def test_rows_carry_exactly_the_declared_fields(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)

        res = await client.get("/api/v1/capabilities/catalog?category=skill", headers=headers)

        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == len(SKILL_CATALOG)
        for row in rows:
            assert set(row) == set(self._FIELDS), row["slug"]
            for key, expected_type in self._FIELDS.items():
                assert isinstance(row[key], expected_type), (row["slug"], key)

    async def test_openapi_declares_the_model(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)

        res = await client.get("/openapi.json", headers=headers)

        assert res.status_code == 200
        schema = res.json()["components"]["schemas"]["CatalogSkillItem"]
        assert set(schema["properties"]) == set(self._FIELDS)


class TestCapabilityListCap:
    """The list endpoint must stay bounded even for pathological workspaces."""

    async def test_the_default_limit_is_500(self):
        import api.routers.capabilities as capabilities

        assert capabilities.CAPABILITY_LIST_LIMIT == 500

    async def test_a_list_past_the_cap_truncates_and_says_so(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        import api.routers.capabilities as capabilities

        monkeypatch.setattr(capabilities, "CAPABILITY_LIST_LIMIT", 2)
        headers, _ = await _setup_workspace(client)
        for idx in range(3):
            created = await client.post(
                "/api/v1/capabilities",
                json={
                    "name": f"capped-skill-{idx}",
                    "category": "skill",
                    "description": "d",
                    "config": {},
                },
                headers=headers,
            )
            assert created.status_code == 201

        res = await client.get("/api/v1/capabilities", headers=headers)

        assert res.status_code == 200
        assert len(res.json()) == 2
        assert res.headers["X-Capabilities-Truncated"] == "true"
        assert res.headers["X-Capabilities-Limit"] == "2"

    async def test_a_list_exactly_at_the_cap_is_not_truncated(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        import api.routers.capabilities as capabilities

        monkeypatch.setattr(capabilities, "CAPABILITY_LIST_LIMIT", 2)
        headers, _ = await _setup_workspace(client)
        for idx in range(2):
            created = await client.post(
                "/api/v1/capabilities",
                json={
                    "name": f"at-cap-skill-{idx}",
                    "category": "skill",
                    "description": "d",
                    "config": {},
                },
                headers=headers,
            )
            assert created.status_code == 201

        res = await client.get("/api/v1/capabilities", headers=headers)

        assert res.status_code == 200
        assert len(res.json()) == 2
        assert "X-Capabilities-Truncated" not in res.headers


_PROBE_DOC = (
    "# probe-fixture\n\n## Mission\nRun the probe fixture correctly.\n\n"
    "## Operating Rules\n1. Stay in order.\n\n"
    "## Triggers\nUse when the request mentions the fixture phrase.\n\n"
    "## Output Contract\nMarkdown: done, evidence, open questions.\n"
)


def _skill_payload(
    name: str,
    *,
    doc: str = _PROBE_DOC,
    scope: str = "memory.read",
    triggers: list[str] | None = None,
) -> dict:
    return {
        "name": name,
        "category": "skill",
        "description": f"{name} fixture",
        "config": {
            "markdown_doc": doc,
            "required_scope": scope,
            "triggers": triggers if triggers is not None else ["audit the fixture"],
        },
    }


async def _workspace_skill_row(client: AsyncClient, headers: dict, cap_id: str) -> dict:
    res = await client.get("/api/v1/capabilities?category=skill", headers=headers)
    assert res.status_code == 200
    return next(row for row in res.json() if row["id"] == cap_id)


class TestSkillProbeDryRun:
    """A skill test call WITH a message is a dry-run probe (H1).

    The probe runs the same ``evaluate_skill_gates`` function production
    injection runs -- one code path, so the verdicts cannot disagree -- reports
    a per-gate verdict, and must not move usage telemetry or execute anything.
    These tests hold it to that contract from the HTTP seam; the pure-function
    gate contract lives in the ``test_skill_*`` suites.
    """

    async def test_message_probe_reports_injection_without_recording_usage(
        self, client: AsyncClient
    ):
        headers, _ = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload("probe-dryrun-usage"),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": "please audit the fixture now"}},
            headers=headers,
        )
        assert probe.status_code == 200
        body = probe.json()
        assert body["recorded_usage"] is False
        assert body["executed"] is False
        assert body["output"]["probe"]["outcome"] == "injected"

        # The probe described what a real turn WOULD do. A dry run that counted
        # would rank skills by how often someone previewed them.
        row = await _workspace_skill_row(client, headers, cap_id)
        assert row["usage_count"] == 0
        assert row["last_used_at"] is None

        # Negative control: a message-less validation call is NOT a probe and
        # still records, so the zero above is the probe path's doing and not
        # usage telemetry being broken outright.
        validation = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {}},
            headers=headers,
        )
        assert validation.status_code == 200
        assert validation.json()["recorded_usage"] is True
        row = await _workspace_skill_row(client, headers, cap_id)
        assert row["usage_count"] == 1
        assert row["last_used_at"] is not None

    async def test_probe_verdict_agrees_with_build_skill_directive(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Structural agreement: the probe's preview is byte-identical to what
        the production wrapper would inject for the same inputs."""
        headers, workspace_id = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload("probe-agreement", triggers=["alignment phrase"]),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        message = "the alignment phrase appears in this sentence"
        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": message}},
            headers=headers,
        )
        assert probe.status_code == 200
        probed = probe.json()["output"]["probe"]
        assert probed["outcome"] == "injected"
        assert probed["scope_context"] == "tool_scope_vocabulary"
        assert probed["granted_scope_count"] == len(tool_scope_vocabulary())
        assert probed["matched_triggers"] == ["alignment phrase"]
        assert probed["match_hits"] == 1
        assert probed["would_inject"] == ["probe-agreement"]
        assert probed["rendered_block"].strip()

        directive = await build_skill_directive(
            db_session,
            workspace_id,
            agent_name="career",
            allowed_scopes=list(tool_scope_vocabulary()),
            user_message=message,
        )
        assert list(directive.injected) == probed["would_inject"]
        assert probed["rendered_block"] in directive.text

    async def test_probe_reports_scope_not_granted_from_a_direct_row(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """``tool.notreal`` cannot be created through the API on purpose, so the
        row is written directly; the probe must still see it and name the gate."""
        headers, workspace_id = await _setup_workspace(client)
        row = WorkspaceCapability(
            workspace_id=uuid.UUID(workspace_id),
            name="probe-unscoped",
            category="skill",
            description="direct row the API would refuse",
            version="1.0.0",
            enabled=True,
            config={
                "markdown_doc": _PROBE_DOC,
                "required_scope": "tool.notreal",
                "triggers": ["unscoped phrase"],
            },
        )
        db_session.add(row)
        await db_session.commit()

        probe = await client.post(
            f"/api/v1/capabilities/{row.id}/test",
            json={"input": {"message": "an unscoped phrase"}},
            headers=headers,
        )
        assert probe.status_code == 200
        probed = probe.json()["output"]["probe"]
        assert probed["outcome"] == "skipped"
        assert probed["skip"]["reason"] == "scope_not_granted"
        assert "tool.notreal" in probed["skip"]["detail"]

        gates = {g["gate"]: g for g in probed["gates"]}
        assert len(probed["gates"]) == 8
        assert gates["enabled"]["verdict"] == "passed"
        assert gates["domain_policy"]["verdict"] == "passed"
        assert gates["required_scope"]["verdict"] == "passed"
        assert gates["scope_granted"]["verdict"] == "failed"
        assert gates["scope_granted"]["reason"] == "scope_not_granted"
        assert gates["markdown_doc"]["verdict"] == "not_evaluated"
        assert gates["pin"]["verdict"] == "not_evaluated"
        assert gates["trigger"]["verdict"] == "not_evaluated"
        assert gates["budget"]["verdict"] == "not_evaluated"

    async def test_probe_reports_budget_exceeded_when_the_directive_fills_up(
        self, client: AsyncClient
    ):
        """quarantine caps a rendered block at ~8KB (~2035 tokens), so a budget
        of 4000 can hold one full block and part of none. Two huge docs make
        the second drop whole -- and the probe must name the gate."""
        headers, _ = await _setup_workspace(client)
        big_doc = "# big\n\n## Mission\n" + ("x" * 60_000)
        for name in ("aaa-budget-fill-1", "aaa-budget-fill-2"):
            filler = await client.post(
                "/api/v1/capabilities",
                json=_skill_payload(name, doc=big_doc, triggers=["filler trigger"]),
                headers=headers,
            )
            assert filler.status_code == 201
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload(
                "probe-budget-hog", doc=big_doc, triggers=["budget trigger"]
            ),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": "say the budget trigger and the filler trigger"}},
            headers=headers,
        )
        assert probe.status_code == 200
        probed = probe.json()["output"]["probe"]
        assert probed["outcome"] == "skipped"
        assert probed["skip"]["reason"] == "token_budget_exceeded"
        # Exactly one of the three equally-relevant blocks fit, and it is the
        # alphabetically-first filler -- name order decides ties, so the row
        # under test loses. This is why the harness asserts the winner's name.
        assert probed["would_inject"] == ["aaa-budget-fill-1"]

        gates = {g["gate"]: g for g in probed["gates"]}
        assert gates["enabled"]["verdict"] == "passed"
        assert gates["trigger"]["verdict"] == "passed"
        assert gates["budget"]["verdict"] == "failed"
        assert gates["budget"]["reason"] == "token_budget_exceeded"

    async def test_a_pin_wins_the_contested_budget(self, client: AsyncClient):
        """The mirror image: same three huge rows, but the row under test is
        pinned, so it sorts first and takes the one block that fits."""
        headers, _ = await _setup_workspace(client)
        big_doc = "# big\n\n## Mission\n" + ("x" * 60_000)
        for name in ("aaa-budget-fill-1", "aaa-budget-fill-2"):
            filler = await client.post(
                "/api/v1/capabilities",
                json=_skill_payload(name, doc=big_doc, triggers=["filler trigger"]),
                headers=headers,
            )
            assert filler.status_code == 201
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload(
                "probe-budget-hog", doc=big_doc, triggers=["budget trigger"]
            ),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={
                "input": {
                    "message": "say the budget trigger and the filler trigger",
                    "pin": "probe-budget-hog",
                }
            },
            headers=headers,
        )
        assert probe.status_code == 200
        probed = probe.json()["output"]["probe"]
        assert probed["outcome"] == "injected"
        assert probed["would_inject"] == ["probe-budget-hog"]
        assert probed["pin_unknown"] is False

        gates = {g["gate"]: g for g in probed["gates"]}
        assert gates["pin"]["verdict"] == "passed"
        assert gates["pin"]["detail"] == "Pin 'probe-budget-hog' matches this skill."
        assert gates["budget"]["verdict"] == "passed"

    async def test_probe_reports_trigger_not_matched(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload("probe-untriggered", triggers=["never-said phrase"]),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": "a completely unrelated sentence"}},
            headers=headers,
        )
        assert probe.status_code == 200
        body = probe.json()
        assert body["output"]["trigger_matched"] is False
        probed = body["output"]["probe"]
        assert probed["outcome"] == "skipped"
        assert probed["skip"]["reason"] == "trigger_not_matched"
        assert "never-said phrase" in probed["skip"]["detail"]
        assert probed["match_hits"] == 0

        gates = {g["gate"]: g for g in probed["gates"]}
        assert gates["enabled"]["verdict"] == "passed"
        assert gates["markdown_doc"]["verdict"] == "passed"
        assert gates["pin"]["verdict"] == "not_supplied"
        assert gates["trigger"]["verdict"] == "failed"
        assert gates["trigger"]["reason"] == "trigger_not_matched"
        assert gates["budget"]["verdict"] == "not_evaluated"

    async def test_probe_rejects_malformed_pins_before_recording(
        self, client: AsyncClient
    ):
        headers, _ = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload("probe-pin-guard"),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        for bad in ("../escape", "Upper"):
            res = await client.post(
                f"/api/v1/capabilities/{cap_id}/test",
                json={"input": {"message": "audit the fixture", "pin": bad}},
                headers=headers,
            )
            assert res.status_code == 400
            assert "input.pin must be a skill slug" in res.json()["detail"]

        # The 400s were raised before record_usage; a rejected request must be
        # free, otherwise anyone can burn a skill's counter with bad input.
        row = await _workspace_skill_row(client, headers, cap_id)
        assert row["usage_count"] == 0

        ok = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": "audit the fixture", "pin": "ok-slug"}},
            headers=headers,
        )
        assert ok.status_code == 200
        probed = ok.json()["output"]["probe"]
        assert probed["pin"] == "ok-slug"
        assert probed["pin_unknown"] is True
        assert probed["outcome"] == "injected"

    async def test_unknown_pin_fails_the_pin_gate_but_still_evaluates_the_row(
        self, client: AsyncClient
    ):
        headers, _ = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload("probe-pin-ghost", triggers=["ghost phrase"]),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]

        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": "say the ghost phrase", "pin": "ghost-skill"}},
            headers=headers,
        )
        assert probe.status_code == 200
        probed = probe.json()["output"]["probe"]
        assert probed["pin"] == "ghost-skill"
        assert probed["pin_unknown"] is True

        gates = {g["gate"]: g for g in probed["gates"]}
        assert gates["pin"]["verdict"] == "failed"
        assert gates["pin"]["reason"] == "pinned_unknown"
        assert gates["pin"]["detail"] == "pin 'ghost-skill' matches no skill in this workspace"
        assert gates["trigger"]["verdict"] == "passed"
        # The unknown pin names nothing, so it cannot suppress real rows.
        assert probed["outcome"] == "injected"
        assert probed["would_inject"] == ["probe-pin-ghost"]

    async def test_probe_reports_a_disabled_row(self, client: AsyncClient):
        headers, _ = await _setup_workspace(client)
        created = await client.post(
            "/api/v1/capabilities",
            json=_skill_payload("probe-disabled"),
            headers=headers,
        )
        assert created.status_code == 201
        cap_id = created.json()["id"]
        paused = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"enabled": False},
            headers=headers,
        )
        assert paused.status_code == 200

        probe = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"message": "audit the fixture"}},
            headers=headers,
        )
        assert probe.status_code == 200
        probed = probe.json()["output"]["probe"]
        assert probed["outcome"] == "skipped"
        assert probed["skip"]["reason"] == "disabled"

        gates = {g["gate"]: g for g in probed["gates"]}
        assert gates["enabled"]["verdict"] == "failed"
        assert gates["enabled"]["reason"] == "disabled"
        assert gates["trigger"]["verdict"] == "not_evaluated"
