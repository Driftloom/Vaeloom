import uuid

import pytest
from httpx import AsyncClient

from api.services.skill_catalog_service import (
    CATALOG_BY_SLUG,
    SKILL_CATALOG,
    TRUST_CLASSES,
    get_catalog_entry,
    tool_scope_vocabulary,
    validate_skill_document,
)

VALID_SKILL_DOC = """# Contract Reviewer

## Mission
Check a workspace contract for internal contradictions and report each one with
the clause that contradicts which other clause.

## Operating Rules
1. Every finding names both conflicting clauses by identifier.
2. Never infer a clause that is not in the document.
3. Report at least the sections the caller named, then the rest in document order.

## Triggers
contract review, find contradictions.

## Output Contract
Markdown table: clause A / clause B / contradiction / severity. Scope for this
skill is `memory.read`.
"""

VALID_SKILL_CONFIG = {
    "tags": ["Review", "Contracts"],
    "required_scope": "memory.read",
    "markdown_doc": VALID_SKILL_DOC,
    "autonomy": "suggest",
}


async def _signup_workspace(client: AsyncClient, label: str) -> tuple[dict, str]:
    email = f"skillcat_{label}_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPassword123!", "name": f"{label} Tester"},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    ws = await client.post(
        "/api/v1/workspaces",
        json={"name": f"{label} Workspace"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ws.status_code == 201, ws.text
    workspace_id = ws.json()["id"]
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}
    return headers, workspace_id


async def _create_skill(client: AsyncClient, headers: dict, name: str, config: dict) -> str:
    res = await client.post(
        "/api/v1/capabilities",
        json={
            "name": name,
            "category": "skill",
            "description": f"Skill {name}",
            "version": "1.0.0",
            "config": config,
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestCatalogIntegrity:
    """Unit-level guarantees about the catalog itself, no HTTP involved."""

    def test_catalog_has_twelve_bundled_skills(self):
        assert len(SKILL_CATALOG) == 12
        assert all(e.bundled is True for e in SKILL_CATALOG)

    def test_slugs_are_unique_and_non_empty(self):
        slugs = [e.slug for e in SKILL_CATALOG]
        assert len(set(slugs)) == len(slugs)
        assert all(s.strip() for s in slugs)

    def test_every_entry_has_a_non_empty_markdown_doc_with_mission(self):
        for entry in SKILL_CATALOG:
            assert entry.markdown_doc.strip(), entry.slug
            assert "## Mission" in entry.markdown_doc, entry.slug
            assert "## Operating Rules" in entry.markdown_doc, entry.slug

    def test_every_required_scope_is_in_the_real_tool_vocabulary(self):
        vocab = tool_scope_vocabulary()
        assert len(vocab) >= 20
        for entry in SKILL_CATALOG:
            assert entry.required_scope in vocab, (entry.slug, entry.required_scope)

    def test_no_fabricated_scopes(self):
        """Scopes that never existed in the tool registry must not come back."""
        forbidden = {
            "system.observe",
            "browser.scrape",
            "plugin.execute",
            "connector.mcp.execute",
            "mcp.read",
            "mcp.workspace.write",
            "resumes.write",
            "document.compile",
            "ats.analyze",
            "system.execute",
            "telemetry.read",
            "prompts.write",
            "application.draft",
            "approval.create",
            "memory.read,memory.write",
        }
        vocab = tool_scope_vocabulary()
        for entry in SKILL_CATALOG:
            assert entry.required_scope not in forbidden, entry.slug
            assert "," not in entry.required_scope, entry.slug
            assert entry.required_scope in vocab, entry.slug

    def test_trust_class_is_core_trusted_or_community_only(self):
        allowed = {"core_trusted", "community"}
        assert set(TRUST_CLASSES) == allowed
        for entry in SKILL_CATALOG:
            assert entry.trust_class in allowed, entry.slug
            assert entry.trust_class != "first_party", entry.slug

    def test_authors_are_real_vaeloom_attributions(self):
        fabricated = {
            "Antigravity Knowledge Base",
            "GStack Engine",
            "Design Intelligence Engine",
            "Design Lead Studio",
            "Vaeloom Labs",
            "Vaeloom Career Suite",
            "Vaeloom Infra",
        }
        for entry in SKILL_CATALOG:
            assert entry.author == "Vaeloom Core Team", entry.slug
            assert entry.author not in fabricated, entry.slug

    def test_catalog_entry_has_no_usage_count_attribute(self):
        for entry in SKILL_CATALOG:
            assert not hasattr(entry, "usage_count"), entry.slug
            assert "usage_count" not in entry.model_dump(), entry.slug

    def test_every_catalog_entry_passes_its_own_validator(self):
        for entry in SKILL_CATALOG:
            result = validate_skill_document(
                markdown_doc=entry.markdown_doc,
                required_scope=entry.required_scope,
                tags=entry.tags,
                entry=entry,
            )
            assert result.violations == [], (entry.slug, [v.model_dump() for v in result.violations])
            assert result.status == "success", entry.slug
            assert result.from_catalog is True

    def test_self_check_violation_is_reported(self):
        """A catalog entry whose doc no longer satisfies its own self-check fails."""
        entry = CATALOG_BY_SLUG["acceptance-criteria-review"]
        assert entry.self_check == "triggers-echoed"
        stripped = entry.markdown_doc.replace("audit requirements", "")
        result = validate_skill_document(
            markdown_doc=stripped,
            required_scope=entry.required_scope,
            tags=entry.tags,
            entry=entry,
        )
        assert result.status == "warning"
        assert [v.rule for v in result.violations] == ["SKILL-CATALOG-SELFCHECK"]
        assert "audit requirements" in result.violations[0].message


class TestSkillValidator:
    """Direct validator tests, including an exact violation list."""

    def test_valid_document_is_success_with_no_violations(self):
        result = validate_skill_document(
            markdown_doc=VALID_SKILL_DOC,
            required_scope="memory.read",
            tags=["Review"],
        )
        assert result.status == "success"
        assert result.violations == []
        assert result.rules_checked == 8
        assert result.from_catalog is False

    def test_exact_violation_list_for_a_known_bad_document(self):
        bad = "\n".join(
            [
                "# Broken Skill",
                "",
                "## Operating Rules",
                "1. Do the thing. TODO write the rest",
                "2. Also {{placeholder}} the other thing",
                "",
                "## Triggers",
                "nothing",
            ]
        )
        result = validate_skill_document(
            markdown_doc=bad,
            required_scope="system.observe",
            tags=[],
        )
        assert result.status == "error"
        assert [(v.rule, v.line, v.severity) for v in result.violations] == [
            ("SKILL-DOC-MISSION", None, "hard"),
            ("SKILL-DOC-OUTPUT-CONTRACT", None, "soft"),
            ("SKILL-TAGS-PRESENT", None, "hard"),
            ("SKILL-SCOPE-VOCABULARY", None, "hard"),
            ("SKILL-PLACEHOLDER", 4, "hard"),
            ("SKILL-PLACEHOLDER", 5, "hard"),
        ]
        assert "system.observe" in result.violations[3].message

    def test_empty_document_reports_presence_rule(self):
        result = validate_skill_document(markdown_doc="   ", required_scope="memory.read", tags=["x"])
        assert result.status == "error"
        assert "SKILL-DOC-PRESENT" in [v.rule for v in result.violations]

    def test_missing_mission_is_a_violation(self):
        doc = VALID_SKILL_DOC.replace("## Mission", "## Purpose")
        result = validate_skill_document(markdown_doc=doc, required_scope="memory.read", tags=["x"])
        assert result.status == "error"
        assert "SKILL-DOC-MISSION" in [v.rule for v in result.violations]

    def test_soft_only_violation_yields_warning(self):
        doc = VALID_SKILL_DOC.replace("## Output Contract", "## Notes")
        result = validate_skill_document(markdown_doc=doc, required_scope="memory.read", tags=["x"])
        assert result.status == "warning"
        assert [v.rule for v in result.violations] == ["SKILL-DOC-OUTPUT-CONTRACT"]
        assert result.violations[0].severity == "soft"

    def test_catalog_self_check_adds_a_ninth_rule(self):
        entry = get_catalog_entry("agent-building")
        result = validate_skill_document(
            markdown_doc=entry.markdown_doc,
            required_scope=entry.required_scope,
            tags=entry.tags,
            entry=entry,
        )
        assert result.rules_checked == 9


class TestCatalogEndpoint:
    async def test_catalog_requires_authentication(self, client: AsyncClient):
        res = await client.get("/api/v1/capabilities/catalog")
        assert res.status_code == 401

    async def test_catalog_returns_at_least_twelve_skills(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "catalog")
        res = await client.get("/api/v1/capabilities/catalog", headers=headers)
        assert res.status_code == 200
        entries = res.json()
        assert len(entries) == 12
        assert len(entries) >= 12
        assert {e["slug"] for e in entries} == {e.slug for e in SKILL_CATALOG}

    async def test_catalog_is_not_swallowed_by_the_cap_id_route(self, client: AsyncClient):
        """`catalog` must never be parsed as a capability UUID."""
        headers, _ = await _signup_workspace(client, "route")
        res = await client.get("/api/v1/capabilities/catalog", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_catalog_entries_expose_the_documented_wire_shape(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "wire")
        res = await client.get("/api/v1/capabilities/catalog?category=skill", headers=headers)
        assert res.status_code == 200
        expected_keys = {
            "slug", "name", "description", "tags", "version", "author",
            "required_scope", "autonomy", "trust_class", "triggers",
            "markdown_doc", "bundled", "self_check",
        }
        for entry in res.json():
            assert set(entry.keys()) == expected_keys
            assert "usage_count" not in entry
            assert "## Mission" in entry["markdown_doc"]

    async def test_catalog_rejects_an_unknown_category(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "unknowncat")
        res = await client.get("/api/v1/capabilities/catalog?category=plugin", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

    async def test_merged_list_marks_uninstalled_catalog_entries(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "merged")
        await _create_skill(client, headers, "agent-building", dict(VALID_SKILL_CONFIG))

        res = await client.get(
            "/api/v1/capabilities?category=skill&include_catalog=true", headers=headers
        )
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 12

        installed = [i for i in items if i["installed"]]
        browsable = [i for i in items if not i["installed"]]
        assert len(installed) == 1
        assert len(browsable) == 11

        row = installed[0]
        assert row["name"] == "agent-building"
        assert row["id"] is not None
        assert row["workspace_id"] == workspace_id
        assert row["enabled"] is True
        assert row["usage_count"] == 0
        assert row["last_used_at"] is None
        assert row["trust_class"] == "core_trusted"
        assert "## Mission" in row["markdown_doc"]

        for item in browsable:
            assert item["id"] is None
            assert item["workspace_id"] is None
            assert item["enabled"] is False
            assert item["installed"] is False
            assert item["usage_count"] == 0
            assert item["trust_class"] in TRUST_CLASSES

    async def test_merged_list_is_disabled_without_include_catalog(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "noinclude")
        res = await client.get("/api/v1/capabilities?category=skill", headers=headers)
        assert res.status_code == 200
        assert res.json() == []

    async def test_merged_list_ignores_catalog_for_non_skill_categories(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "nonskill")
        res = await client.get(
            "/api/v1/capabilities?category=tool&include_catalog=true", headers=headers
        )
        assert res.status_code == 200
        assert res.json() == []


class TestSkillTestEndpoint:
    async def _test_skill(self, client: AsyncClient, headers: dict, workspace_id: str, name: str):
        return await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": name,
                "category": "skill",
                "input_payload": {},
            },
            headers=headers,
        )

    async def test_valid_skill_returns_success_with_no_violations(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "valid")
        await _create_skill(client, headers, "contract-reviewer", dict(VALID_SKILL_CONFIG))

        res = await self._test_skill(client, headers, workspace_id, "contract-reviewer")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "success"
        assert body["executed"] is False
        assert body["validation_errors"] == []
        assert body["result"]["violations"] == []
        assert body["result"]["rules_checked"] == 8
        assert body["result"]["source"] == "workspace"
        assert body["result"]["installed"] is True

    async def test_skill_with_todo_placeholder_is_flagged_with_a_line_number(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "todo")
        config = dict(VALID_SKILL_CONFIG)
        config["markdown_doc"] = VALID_SKILL_DOC.replace(
            "1. Every finding names both conflicting clauses by identifier.",
            "1. Every finding names both conflicting clauses by identifier. TODO expand",
        )
        await _create_skill(client, headers, "todo-skill", config)

        res = await self._test_skill(client, headers, workspace_id, "todo-skill")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "error"
        placeholder = [v for v in body["result"]["violations"] if v["rule"] == "SKILL-PLACEHOLDER"]
        assert len(placeholder) == 1
        assert placeholder[0]["line"] == 8
        assert placeholder[0]["severity"] == "hard"
        assert "line 8" in placeholder[0]["message"]

    async def test_bogus_required_scope_is_flagged(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "bogusscope")
        config = dict(VALID_SKILL_CONFIG)
        config["required_scope"] = "system.observe"
        await _create_skill(client, headers, "bogus-scope-skill", config)

        res = await self._test_skill(client, headers, workspace_id, "bogus-scope-skill")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "error"
        violations = body["result"]["violations"]
        assert [v["rule"] for v in violations] == ["SKILL-SCOPE-VOCABULARY"]
        assert "system.observe" in violations[0]["message"]
        assert violations[0]["severity"] == "hard"
        assert violations[0]["line"] is None

    async def test_missing_mission_section_is_flagged(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "nomission")
        config = dict(VALID_SKILL_CONFIG)
        config["markdown_doc"] = VALID_SKILL_DOC.replace("## Mission", "## Purpose")
        await _create_skill(client, headers, "no-mission-skill", config)

        res = await self._test_skill(client, headers, workspace_id, "no-mission-skill")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "error"
        assert [v["rule"] for v in body["result"]["violations"]] == ["SKILL-DOC-MISSION"]

    async def test_catalog_skill_validates_against_the_catalog_document(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "catskill")
        await _create_skill(client, headers, "agent-building", {})

        res = await self._test_skill(client, headers, workspace_id, "agent-building")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "success"
        assert body["result"]["source"] == "catalog"
        assert body["result"]["from_catalog"] is True
        assert body["result"]["rules_checked"] == 9
        assert body["result"]["violations"] == []
        assert body["result"]["required_scope"] == "agent.spawn"

    async def test_uninstalled_skill_is_validated_but_records_no_usage(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "uninstalled")
        res = await self._test_skill(client, headers, workspace_id, "system-design")
        assert res.status_code == 200
        body = res.json()
        assert body["result"]["installed"] is False
        assert body["result"]["usage_recorded"] is False
        assert body["result"]["source"] == "catalog"
        assert body["result"]["violations"] == []

    async def test_usage_count_increments_zero_one_two(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "usage")
        await _create_skill(client, headers, "usage-skill", dict(VALID_SKILL_CONFIG))

        listing = await client.get("/api/v1/capabilities?category=skill", headers=headers)
        assert listing.status_code == 200
        assert listing.json()[0]["usage_count"] == 0
        assert listing.json()[0]["last_used_at"] is None

        for expected in (1, 2):
            res = await self._test_skill(client, headers, workspace_id, "usage-skill")
            assert res.status_code == 200
            assert res.json()["result"]["usage_recorded"] is True

            listing = await client.get("/api/v1/capabilities?category=skill", headers=headers)
            assert listing.status_code == 200
            row = listing.json()[0]
            assert row["usage_count"] == expected
            assert row["last_used_at"] is not None

    async def test_capability_test_endpoint_also_records_usage(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "usage2")
        cap_id = await _create_skill(client, headers, "usage-skill-2", dict(VALID_SKILL_CONFIG))

        res = await client.post(f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["executed"] is False
        assert body["output"]["detail"] == (
            "This category has no executable runtime; only its configuration was validated."
        )
        assert "verified" not in body["output"]

        listing = await client.get("/api/v1/capabilities?category=skill", headers=headers)
        assert listing.json()[0]["usage_count"] == 1


class TestHonestTestEndpointShapes:
    async def test_mcp_skipped_reports_no_tools_count(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "mcpskip")
        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "no-endpoint-mcp",
                "category": "mcp",
                "description": "MCP capability with no endpoint",
                "config": {"transport": "stdio"},
            },
            headers=headers,
        )
        assert res.status_code == 201
        cap_id = res.json()["id"]

        res = await client.post(f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "skipped"
        assert body["executed"] is False
        assert body["output"]["detail"] == "No MCP endpoint configured; nothing was contacted."
        assert "tools_count" not in body["output"]
        assert "tools" not in body["output"]

        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": "no-endpoint-mcp",
                "category": "mcp",
                "input_payload": {},
            },
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "skipped"
        assert body["executed"] is False
        assert "tools_count" not in body["result"]
        assert body["result"]["detail"] == "No MCP endpoint configured; nothing was contacted."

    async def test_tool_branch_says_it_did_not_execute(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "toolbranch")
        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": "search_documents",
                "category": "tools",
                "input_payload": {"query": "hello"},
            },
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["executed"] is False
        result = body["result"]
        assert result["validated_params"] == {"query": "hello"}
        assert "simulated_output" not in result
        assert "The tool was NOT executed" in result["detail"]
        assert result["required_scope"] == "memory.read"

    async def test_tool_branch_flags_missing_required_parameters(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "toolmissing")
        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": "search_documents",
                "category": "tools",
                "input_payload": {},
            },
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "warning"
        assert body["validation_errors"] == ["Missing required parameter 'query' in input payload"]
        assert body["result"]["validation"] == "failed"

    async def test_agent_branch_reports_the_live_registry_contract(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "agentbranch")
        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": "organization",
                "category": "agents",
                "input_payload": {},
            },
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["executed"] is False
        result = body["result"]
        assert result["registered"] is True
        assert result["class_name"] == "OrganizationAgent"
        assert result["mission"]
        assert result["plan_proposal"] is None
        assert "No planning or execution run occurred" in result["detail"]
        assert isinstance(result["required_scopes"], list)
        for scope in result["required_scopes"]:
            assert scope in tool_scope_vocabulary()

    async def test_plugin_branch_validates_a_manifest(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "pluginbranch")
        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "manifest-plugin",
                "category": "plugin",
                "description": "Plugin capability",
                "config": {"entry_point": "", "name": "manifest-plugin"},
            },
            headers=headers,
        )
        assert res.status_code == 201

        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": "manifest-plugin",
                "category": "plugins",
                "input_payload": {},
            },
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "warning"
        assert body["executed"] is False
        messages = " ".join(body["validation_errors"])
        assert "entry_point" in messages
        assert "tags" in messages
        assert "permissions" in messages
        assert "version" in messages
        assert body["result"]["detail"] == (
            "This category has no executable runtime; only its configuration was validated."
        )

    async def test_unsupported_category_is_rejected(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "badcat")
        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": workspace_id,
                "capability_name": "whatever",
                "category": "wat",
                "input_payload": {},
            },
            headers=headers,
        )
        assert res.status_code == 400
        assert "Unsupported category" in res.json()["detail"]


class TestCapabilityMutationContract:
    async def test_patch_persists_autonomy_and_required_scope(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "patchok")
        cap_id = await _create_skill(client, headers, "patchable-skill", dict(VALID_SKILL_CONFIG))

        res = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={
                "autonomy": "approval_required",
                "required_scope": "memory.write",
                "workspace_id": workspace_id,
            },
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["config"]["autonomy"] == "approval_required"
        assert body["config"]["required_scope"] == "memory.write"

        listing = await client.get("/api/v1/capabilities?category=skill", headers=headers)
        assert listing.json()[0]["autonomy"] == "approval_required"
        assert listing.json()[0]["required_scope"] == "memory.write"

    async def test_patch_rejects_an_invalid_autonomy_value(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "badauto")
        cap_id = await _create_skill(client, headers, "bad-autonomy-skill", dict(VALID_SKILL_CONFIG))

        res = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"autonomy": "yolo"},
            headers=headers,
        )
        assert res.status_code == 422
        body = res.json()
        assert "autonomy" in res.text

    async def test_patch_rejects_a_mismatched_workspace_id(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "wrongws")
        other_headers, other_ws = await _signup_workspace(client, "otherws")
        cap_id = await _create_skill(client, headers, "wrong-ws-skill", dict(VALID_SKILL_CONFIG))
        assert other_headers

        res = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"workspace_id": other_ws, "autonomy": "suggest"},
            headers=headers,
        )
        assert res.status_code == 400
        assert "does not match the verified workspace" in res.json()["detail"]

    async def test_patch_cannot_widen_authorization_via_workspace_id(self, client: AsyncClient):
        """A body workspace_id must never grant access the header did not."""
        victim_headers, victim_ws = await _signup_workspace(client, "victim")
        attacker_headers, _ = await _signup_workspace(client, "attacker")
        cap_id = await _create_skill(client, victim_headers, "victim-skill", dict(VALID_SKILL_CONFIG))

        res = await client.patch(
            f"/api/v1/capabilities/{cap_id}",
            json={"workspace_id": victim_ws, "enabled": False},
            headers=attacker_headers,
        )
        assert res.status_code == 404
        assert "victim-skill" not in res.text

    async def test_delete_of_a_bundled_catalog_skill_returns_409(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "bundled")
        cap_id = await _create_skill(client, headers, "agent-building", dict(VALID_SKILL_CONFIG))

        res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert res.status_code == 409
        detail = res.json()["detail"]
        assert "bundled Vaeloom skill" in detail
        assert "PATCH enabled=false" in detail

        still_there = await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert still_there.status_code == 200

    async def test_disabling_a_bundled_skill_is_the_supported_action(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "disable")
        cap_id = await _create_skill(client, headers, "agent-building", dict(VALID_SKILL_CONFIG))

        res = await client.patch(
            f"/api/v1/capabilities/{cap_id}", json={"enabled": False}, headers=headers
        )
        assert res.status_code == 200
        assert res.json()["enabled"] is False

    async def test_delete_of_a_non_custom_capability_returns_409(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "noncustom")
        res = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "platform-owned-thing",
                "category": "connector",
                "description": "not custom",
                "type": "platform",
                "config": {"type": "gmail"},
            },
            headers=headers,
        )
        assert res.status_code == 201
        cap_id = res.json()["id"]

        res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert res.status_code == 409
        assert "not deletable" in res.json()["detail"]

    async def test_delete_of_a_custom_capability_still_succeeds(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "customdel")
        cap_id = await _create_skill(client, headers, "mine", dict(VALID_SKILL_CONFIG))

        res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert res.status_code == 204
        gone = await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert gone.status_code == 404


class TestCrossWorkspaceNegativeControl:
    """Negative control: workspace B must never touch workspace A's capability."""

    async def _seed(self, client: AsyncClient):
        owner_headers, owner_ws = await _signup_workspace(client, "owner")
        cap_id = await _create_skill(client, owner_headers, "owner-secret-skill", dict(VALID_SKILL_CONFIG))
        outsider_headers, _ = await _signup_workspace(client, "outsider")
        return cap_id, owner_ws, owner_headers, outsider_headers

    async def test_targeting_a_foreign_capability_from_own_workspace_is_404(self, client: AsyncClient):
        cap_id, owner_ws, _, headers = await self._seed(client)

        get_res = await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)
        patch_res = await client.patch(
            f"/api/v1/capabilities/{cap_id}", json={"enabled": False}, headers=headers
        )
        delete_res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=headers)
        test_res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=headers
        )

        assert get_res.status_code == 404
        assert patch_res.status_code == 404
        assert delete_res.status_code == 404
        assert test_res.status_code == 404
        for res in (get_res, patch_res, delete_res, test_res):
            assert "owner-secret-skill" not in res.text
            assert owner_ws not in res.text

    async def test_using_the_foreign_workspace_header_is_403(self, client: AsyncClient):
        cap_id, owner_ws, _, headers = await self._seed(client)
        hostile = {**headers, "X-Workspace-Id": owner_ws}

        get_res = await client.get(f"/api/v1/capabilities/{cap_id}", headers=hostile)
        patch_res = await client.patch(
            f"/api/v1/capabilities/{cap_id}", json={"enabled": False}, headers=hostile
        )
        delete_res = await client.delete(f"/api/v1/capabilities/{cap_id}", headers=hostile)
        test_res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=hostile
        )

        assert get_res.status_code == 403
        assert patch_res.status_code == 403
        assert delete_res.status_code == 403
        assert test_res.status_code == 403
        for res in (get_res, patch_res, delete_res, test_res):
            assert "owner-secret-skill" not in res.text

    async def test_catalog_does_not_leak_the_other_workspaces_usage(self, client: AsyncClient):
        cap_id, owner_ws, owner_headers, outsider_headers = await self._seed(client)

        res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=owner_headers
        )
        assert res.status_code == 200

        owner_listing = await client.get(
            "/api/v1/capabilities?category=skill", headers=owner_headers
        )
        assert owner_listing.json()[0]["usage_count"] == 1

        outsider_listing = await client.get(
            "/api/v1/capabilities?category=skill", headers=outsider_headers
        )
        assert outsider_listing.status_code == 200
        assert outsider_listing.json() == []
        assert owner_ws

    async def test_agents_test_endpoint_denies_a_foreign_workspace(self, client: AsyncClient):
        owner_headers, owner_ws = await _signup_workspace(client, "agentowner")
        await _create_skill(client, owner_headers, "agent-owner-skill", dict(VALID_SKILL_CONFIG))
        outsider_headers, _ = await _signup_workspace(client, "agentoutsider")

        res = await client.post(
            "/api/v1/agents/capabilities/test",
            json={
                "workspace_id": owner_ws,
                "capability_name": "agent-owner-skill",
                "category": "skill",
                "input_payload": {},
            },
            headers=outsider_headers,
        )
        assert res.status_code == 404
        assert "agent-owner-skill" not in res.text


class TestDynamicToolWorkspaceScoping:
    async def test_a_foreign_dynamic_tool_is_never_executed(self, client: AsyncClient):
        """Workspace B must not be able to run workspace A's dynamic tool."""
        owner_headers, owner_ws = await _signup_workspace(client, "dynowner")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "workspace_a_secret_tool",
                "category": "tool",
                "description": "Only workspace A may run this",
                "config": {"parameters": {"type": "object", "properties": {}}},
            },
            headers=owner_headers,
        )
        assert create.status_code == 201
        cap_id = create.json()["id"]

        outsider_headers, _ = await _signup_workspace(client, "dynoutsider")
        res = await client.post(
            f"/api/v1/capabilities/{cap_id}/test",
            json={"input": {"x": 1}},
            headers=outsider_headers,
        )
        assert res.status_code == 404
        assert "workspace_a_secret_tool" not in res.text
        assert owner_ws

    async def test_the_process_global_handler_map_is_never_a_fallback(self):
        """The reported leak: a tool registered without a workspace must not be reachable.

        ``register_dynamic_tool(td, handler)`` with no ``workspace_id`` puts the
        tool in the process-global map only. Before the fix,
        ``get_tool_definition(name)`` found it for *every* workspace, so workspace
        B executed workspace A's handler. The capability surface must resolve
        from the workspace's own partition and nothing else.
        """
        from api.routers.capabilities import _workspace_dynamic_definitions
        from api.tools.definitions import ToolDefinition
        from api.tools.executor import DYNAMIC_HANDLERS, register_dynamic_tool

        tool_a_ws = str(uuid.uuid4())
        tool_b_ws = str(uuid.uuid4())

        td_a = ToolDefinition(
            name="workspace_a_only_tool",
            description="A's tool",
            category="custom",
            required_scope="tool.workspace_a_only_tool",
            input_schema={"type": "object", "properties": {}},
            output_schema={"type": "object", "properties": {}},
        )

        async def handler_a(args: dict, workspace_id: str | None = None) -> dict:
            return {"owner": "workspace_a"}

        register_dynamic_tool(td_a, handler_a, workspace_id=tool_a_ws)

        # Reproduce the leak condition: the same name also lands in the global map.
        register_dynamic_tool(td_a, handler_a)

        assert "workspace_a_only_tool" in DYNAMIC_HANDLERS
        assert "workspace_a_only_tool" in _workspace_dynamic_definitions(tool_a_ws)
        assert "workspace_a_only_tool" not in _workspace_dynamic_definitions(tool_b_ws)

        from api.tools.executor import unregister_dynamic_tools

        unregister_dynamic_tools("workspace_a_only_tool")
        unregister_dynamic_tools("workspace_a_only_tool", workspace_id=tool_a_ws)

    async def test_a_missing_dynamic_tool_reports_not_registered_not_success(self, client: AsyncClient):
        """A capability row whose process-local handler is gone must not claim success."""
        from api.tools import executor

        headers, _ = await _signup_workspace(client, "dynlost")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "ephemeral_tool",
                "category": "tool",
                "description": "Process-local tool",
                "config": {"parameters": {"type": "object", "properties": {}}},
            },
            headers=headers,
        )
        assert create.status_code == 201
        cap_id = create.json()["id"]

        ok = await client.post(f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=headers)
        assert ok.status_code == 200
        assert ok.json()["status"] == "success"
        assert ok.json()["executed"] is True

        # A restart loses every process-local dynamic registration: both the
        # global maps and the workspace partitions are gone. Restore by mutation,
        # not rebinding — routers hold their own references to these dicts.
        registries = (
            executor.DYNAMIC_HANDLERS,
            executor.DYNAMIC_TOOL_DEFS,
            executor.WORKSPACE_DYNAMIC_HANDLERS,
            executor.WORKSPACE_DYNAMIC_TOOL_DEFS,
        )
        saved = [
            {k: v for k, v in reg.items()}
            for reg in registries
        ]
        try:
            for reg in registries:
                reg.clear()

            lost = await client.post(
                f"/api/v1/capabilities/{cap_id}/test", json={"input": {}}, headers=headers
            )
            assert lost.status_code == 200
            body = lost.json()
            assert body["status"] == "not_registered"
            assert body["executed"] is False
            assert "process-local" in body["error"]
            assert "lost on restart" in body["error"]
        finally:
            for reg, snapshot in zip(registries, saved):
                reg.update(snapshot)