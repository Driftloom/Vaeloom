"""Draft validation for UNSAVED capabilities.

Every assertion here is an exact status code, an exact rule id or an exact
message. ``assert res.status_code in (200, 400, 401)`` is banned by the repo, and a
count-only assertion would not pin the behaviour this endpoint exists to give.
"""

import json
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from api.models.schema import WorkspaceCapability

pytestmark = pytest.mark.asyncio

VALIDATE_URL = "/api/v1/capabilities/validate"

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

# CATEGORY-VALID + NAME-PATTERN + NAME-COLLISION + AUTONOMY-ENUM + the 8 shared
# skill rules + SKILL-TRUST-CLASS. Asserted literally so a rule that silently
# stopped running is a failure rather than a smaller number nobody notices.
VALID_SKILL_RULES_CHECKED = 13


async def _signup_workspace(client: AsyncClient, label: str) -> tuple[dict, str]:
    email = f"draftval_{label}_{uuid.uuid4().hex[:8]}@test.com"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPassword123!", "name": f"{label} Author"},
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
    return {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}, workspace_id


async def _validate(client: AsyncClient, headers: dict, **draft) -> dict:
    res = await client.post(VALIDATE_URL, json=draft, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


async def _capability_count(db) -> int:
    result = await db.execute(select(func.count()).select_from(WorkspaceCapability))
    return int(result.scalar_one())


def _skill_draft(name: str, **config_overrides) -> dict:
    return {
        "name": name,
        "category": "skill",
        "description": "Draft skill under construction",
        "config": {**VALID_SKILL_CONFIG, **config_overrides},
    }


def _rules(body: dict) -> list[str]:
    return [v["rule"] for v in body["violations"]]


def _messages(body: dict) -> list[str]:
    return [v["message"] for v in body["violations"]]


class TestValidSkillDraft:
    async def test_valid_draft_is_success_with_a_real_rule_count(self, client: AsyncClient):
        headers, workspace_id = await _signup_workspace(client, "valid")

        body = await _validate(
            client,
            headers,
            **_skill_draft("contract-reviewer"),
            trust_class="community",
        )

        assert body["status"] == "success"
        assert body["violations"] == []
        assert body["executed"] is False
        assert body["category"] == "skill"
        assert body["validated_source"] == "draft"
        assert body["catalog_slug"] is None
        assert body["rules_checked"] == VALID_SKILL_RULES_CHECKED
        assert body["rules_checked"] > 0
        assert workspace_id not in body["detail"]
        assert "contract-reviewer" not in body["detail"]

    async def test_rules_checked_tracks_the_rules_that_actually_ran(
        self, client: AsyncClient
    ):
        """The count must move with the input, which a hardcoded total cannot do."""
        headers, _ = await _signup_workspace(client, "counting")

        with_autonomy = await _validate(client, headers, **_skill_draft("counted-skill"))
        without_autonomy = await _validate(
            client,
            headers,
            name="counted-skill",
            category="skill",
            description="Draft skill under construction",
            config={
                key: value
                for key, value in VALID_SKILL_CONFIG.items()
                if key != "autonomy"
            },
        )
        assert with_autonomy["rules_checked"] - without_autonomy["rules_checked"] == 1
        assert "AUTONOMY-ENUM" not in _rules(with_autonomy)
        assert without_autonomy["rules_checked"] < with_autonomy["rules_checked"]

        tool_body = await _validate(
            client,
            headers,
            name="counted-tool",
            category="tool",
            description="Draft tool",
            config={"parameters": {"type": "object", "properties": {}}},
        )
        assert tool_body["rules_checked"] != with_autonomy["rules_checked"]

    async def test_status_never_claims_a_live_run(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "executed")

        for draft in (
            _skill_draft("executed-skill"),
            {
                "name": "executed-mcp",
                "category": "mcp",
                "description": "Draft mcp",
                "config": {"transport": "stdio", "command": "mcp-server", "args": []},
            },
            {
                "name": "executed-connector",
                "category": "connector",
                "description": "Draft connector",
                "config": {"type": "smtp"},
            },
        ):
            body = await _validate(client, headers, **draft)
            assert body["executed"] is False, draft["name"]


class TestCatalogSourceIsReported:
    async def test_a_nameless_markdown_draft_falls_back_to_the_catalog_document(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "catalogsrc")

        body = await _validate(
            client,
            headers,
            name="agent-building",
            category="skill",
            description="Editing a copy of a bundled skill",
            config={},
        )

        assert body["status"] == "success"
        assert body["violations"] == []
        assert body["validated_source"] == "catalog"
        assert body["catalog_slug"] == "agent-building"
        # 3 shared rules + 8 shared skill rules + the catalog self-check + the
        # trust-class rule (which runs for every skill draft, absent value or not).
        assert body["rules_checked"] == 13

    async def test_supplied_markdown_wins_over_the_catalog_document(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "catalogoverride")

        body = await _validate(client, headers, **_skill_draft("agent-building"))

        assert body["status"] == "success"
        assert body["validated_source"] == "draft"
        assert body["catalog_slug"] is None
        # One more than an unrelated name: the bundled skill's self-check still
        # applies to a copy of that skill, which is a real ninth rule.
        assert body["rules_checked"] == VALID_SKILL_RULES_CHECKED + 1


class TestSkillDocumentViolations:
    async def test_todo_placeholder_is_reported_with_its_line(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "todo")
        doc = VALID_SKILL_DOC.replace(
            "1. Every finding names both conflicting clauses by identifier.",
            "1. Every finding names both conflicting clauses by identifier. TODO expand",
        )

        body = await _validate(
            client, headers, **_skill_draft("todo-skill", markdown_doc=doc)
        )

        assert body["status"] == "error"
        assert _rules(body) == ["SKILL-PLACEHOLDER"]
        violation = body["violations"][0]
        assert violation["line"] == 8
        assert violation["severity"] == "hard"
        assert violation["message"] == "Unresolved placeholder TODO on line 8"

    async def test_scope_outside_the_real_vocabulary_is_reported(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "scope")

        body = await _validate(
            client, headers, **_skill_draft("bogus-scope-skill", required_scope="system.observe")
        )

        assert body["status"] == "error"
        assert _rules(body) == ["SKILL-SCOPE-VOCABULARY"]
        assert body["violations"][0]["line"] is None
        assert body["violations"][0]["severity"] == "hard"
        assert "system.observe" in body["violations"][0]["message"]
        assert "tool scope vocabulary" in body["violations"][0]["message"]

    async def test_exact_violation_list_for_a_known_bad_skill_draft(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "knownbad")
        doc = "\n".join(
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

        body = await _validate(
            client,
            headers,
            **_skill_draft("broken-skill", markdown_doc=doc, required_scope="system.observe", tags=[]),
        )

        assert body["status"] == "error"
        assert [(v["rule"], v["line"], v["severity"]) for v in body["violations"]] == [
            ("SKILL-DOC-MISSION", None, "hard"),
            ("SKILL-DOC-OUTPUT-CONTRACT", None, "soft"),
            ("SKILL-TAGS-PRESENT", None, "hard"),
            ("SKILL-SCOPE-VOCABULARY", None, "hard"),
            ("SKILL-PLACEHOLDER", 4, "hard"),
            ("SKILL-PLACEHOLDER", 5, "hard"),
        ]
        assert body["violations"][3]["message"].startswith(
            "required_scope 'system.observe' is not in the tool scope vocabulary"
        )
        assert body["violations"][4]["message"] == "Unresolved placeholder TODO on line 4"
        assert body["violations"][5]["message"] == "Unresolved placeholder {{ on line 5"

    async def test_soft_only_violations_yield_warning(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "soft")
        doc = VALID_SKILL_DOC.replace("## Output Contract", "## Notes")

        body = await _validate(
            client, headers, **_skill_draft("soft-skill", markdown_doc=doc)
        )

        assert body["status"] == "warning"
        assert _rules(body) == ["SKILL-DOC-OUTPUT-CONTRACT"]
        assert body["violations"][0]["severity"] == "soft"

    async def test_unknown_trust_class_is_a_soft_violation(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "trust")

        body = await _validate(
            client, headers, **_skill_draft("trusty-skill"), trust_class="first_party"
        )

        assert body["status"] == "warning"
        assert _rules(body) == ["SKILL-TRUST-CLASS"]
        assert body["violations"][0]["severity"] == "soft"
        assert body["violations"][0]["message"] == (
            "trust_class 'first_party' is not one of ['community', 'core_trusted']; "
            "the skill catalog can only emit those values"
        )


class TestMcpDraft:
    async def test_invalid_transport_is_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "transport")

        body = await _validate(
            client,
            headers,
            name="sse-transport",
            category="mcp",
            description="Draft mcp",
            config={"transport": "sse", "url": "https://mcp.example.com/sse"},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["MCP-TRANSPORT-SET", "MCP-CONFIG-VALIDATOR"]
        assert body["violations"][0]["message"] == (
            "transport 'sse' is not in the real transport set ('stdio' | 'http')"
        )
        # The shared validator's own clause message, surfaced verbatim.
        assert body["violations"][1]["message"] == (
            "mcp config requires transport: 'stdio' | 'http'"
        )

    async def test_unsubstituted_variable_is_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "var")

        body = await _validate(
            client,
            headers,
            name="token-mcp",
            category="mcp",
            description="Draft mcp",
            config={
                "transport": "http",
                "url": "https://mcp.example.com/sse",
                "headers": {"Authorization": "Bearer ${MCP_TOKEN}"},
            },
        )

        assert body["status"] == "error"
        assert _rules(body) == ["MCP-UNSUBSTITUTED-VAR"]
        assert body["violations"][0]["message"] == (
            "Unsubstituted ${VAR} placeholders remain in header/env values: "
            "['headers.Authorization=${MCP_TOKEN}']"
        )
        assert body["violations"][0]["severity"] == "hard"

    async def test_a_missing_endpoint_is_reported_and_never_invented(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "noendpoint")

        body = await _validate(
            client,
            headers,
            name="endpoint-less-mcp",
            category="mcp",
            description="Draft mcp",
            config={"transport": "stdio"},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["MCP-ENDPOINT-DECLARED", "MCP-CONFIG-VALIDATOR"]
        assert body["violations"][0]["message"] == (
            "MCP draft declares neither 'command' nor 'url'; there is no endpoint to "
            "validate and none is invented"
        )
        assert body["violations"][1]["message"] == (
            "stdio transport requires a 'command' string"
        )

    async def test_a_valid_mcp_draft_is_success(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "mcpok")

        body = await _validate(
            client,
            headers,
            name="filesystem-mcp",
            category="mcp",
            description="Draft mcp",
            config={"transport": "stdio", "command": "mcp-server-filesystem", "args": ["--root", "/tmp"]},
        )

        assert body["status"] == "success"
        assert body["violations"] == []
        assert body["rules_checked"] == 7
        assert body["validated_source"] == "delegated"
        assert "validate_mcp_config" in body["detail"]


class TestToolDraft:
    async def test_invalid_json_schema_reports_the_exact_violations(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "badschema")

        body = await _validate(
            client,
            headers,
            name="broken-tool",
            category="tool",
            description="Draft tool",
            config={
                "parameters": {
                    "type": "array",
                    "properties": {"limit": {}, "name": {"type": "string"}},
                    "required": ["missing"],
                }
            },
        )

        assert body["status"] == "error"
        assert _rules(body) == [
            "TOOL-SCHEMA-OBJECT",
            "TOOL-PROPERTY-TYPE",
            "TOOL-REQUIRED-RESOLVED",
        ]
        assert _messages(body) == [
            "config.parameters must declare type 'object', got 'array'",
            "Property 'limit' declares no 'type'; an untyped property cannot be "
            "validated against caller arguments",
            "config.parameters.required names properties that are not declared: "
            "['missing']",
        ]

    async def test_duplicate_property_names_are_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "dupes")

        body = await _validate(
            client,
            headers,
            name="duplicate-tool",
            category="tool",
            description="Draft tool",
            config={
                "parameters": (
                    '{"type": "object", "properties": '
                    '{"limit": {"type": "string"}, "limit": {"type": "integer"}}}'
                )
            },
        )

        assert body["status"] == "error"
        assert _rules(body) == ["TOOL-SCHEMA-DUPLICATE-KEY"]
        assert body["violations"][0]["message"] == (
            "config.parameters declares duplicate JSON keys: ['limit']"
        )

    async def test_unparsable_schema_reports_the_json_error(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "jsonerr")

        body = await _validate(
            client,
            headers,
            name="stringy-tool",
            category="tool",
            description="Draft tool",
            config={"parameters": "{not json"},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["TOOL-SCHEMA-JSON", "TOOL-SCHEMA-OBJECT"]
        assert "not valid JSON:" in body["violations"][0]["message"]
        assert body["violations"][1]["message"] == (
            "config.parameters must be a JSON Schema object, got NoneType"
        )

    async def test_a_missing_parameters_schema_is_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "noschema")

        body = await _validate(
            client,
            headers,
            name="schemaless-tool",
            category="tool",
            description="Draft tool",
            config={},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["TOOL-SCHEMA-PRESENT"]
        assert body["rules_checked"] == 4

    async def test_a_valid_tool_draft_is_success_and_registrable(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "toolok")

        body = await _validate(
            client,
            headers,
            name="summarise-text",
            category="tool",
            description="Summarise text",
            config={
                "parameters": {
                    "type": "object",
                    "properties": {"text": {"type": "string"}},
                    "required": ["text"],
                },
                "returns": {"type": "object", "properties": {}},
            },
        )

        assert body["status"] == "success"
        assert body["violations"] == []
        assert body["validated_source"] == "delegated"
        assert "ToolDefinition" in body["detail"]


class TestAgentDraft:
    async def test_unresolvable_tool_ids_are_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "agenttools")

        body = await _validate(
            client,
            headers,
            name="draft-agent",
            category="agent",
            description="A drafting agent",
            config={"mission": "Draft documents", "tools": ["search_documents", "no_such_tool"]},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["AGENT-TOOL-RESOLVABLE"]
        assert "['no_such_tool']" in body["violations"][0]["message"]

    async def test_an_unknown_autonomy_value_is_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "agentautonomy")

        body = await _validate(
            client,
            headers,
            name="autonomy-agent",
            category="agent",
            description="An agent",
            config={"autonomy": "yolo"},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["AUTONOMY-ENUM"]
        assert body["violations"][0]["message"] == (
            "autonomy 'yolo' is not one of the real autonomy values "
            "['approval_required', 'autonomous', 'suggest']"
        )

    async def test_a_missing_mission_is_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "agentmission")

        body = await _validate(
            client, headers, name="mute-agent", category="agent", config={}
        )

        assert body["status"] == "error"
        assert _rules(body) == ["AGENT-FIELD-PRESENT"]
        assert "neither a 'mission' in config nor a description" in (
            body["violations"][0]["message"]
        )


class TestConnectorAndPluginDraft:
    async def test_a_connector_type_with_no_validator_is_not_validated(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "unknownconn")

        body = await _validate(
            client,
            headers,
            name="smtp-connector",
            category="connector",
            description="Draft connector",
            config={"type": "smtp"},
        )

        assert body["status"] == "not_validated"
        assert body["violations"] == []
        assert body["validated_source"] == "none"
        assert body["rules_checked"] == 4
        assert body["detail"].startswith("No validator exists for category 'connector'")
        assert "not approved for anything, only measured" in body["detail"]

    async def test_a_rest_connector_without_a_url_is_reported_by_the_real_validator(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "restconn")

        body = await _validate(
            client,
            headers,
            name="rest-connector",
            category="connector",
            description="Draft connector",
            config={"type": "rest"},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["CONNECTOR-CONFIG-VALIDATOR"]
        assert body["violations"][0]["message"] == "URL is required for rest connectors"
        assert body["validated_source"] == "delegated"
        assert "connector_ext_service._validate_config" in body["detail"]

    async def test_a_plugin_manifest_must_be_valid_json(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "pluginjson")

        body = await _validate(
            client,
            headers,
            name="manifest-plugin",
            category="plugin",
            description="Draft plugin",
            config={"manifest": "{not json"},
        )

        assert body["status"] == "error"
        assert _rules(body) == [
            "PLUGIN-MANIFEST-JSON",
            "PLUGIN-ENTRYPOINT-PRESENT",
            "PLUGIN-MANIFEST-CONTRACT",
        ]
        assert "not valid JSON:" in body["violations"][0]["message"]
        assert body["violations"][1]["message"] == (
            "Plugin manifest declares no non-empty 'entry_point'; nothing would load"
        )

    async def test_a_complete_plugin_manifest_is_success(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "pluginok")

        body = await _validate(
            client,
            headers,
            name="complete-plugin",
            category="plugin",
            description="Draft plugin",
            config={
                "manifest": (
                    '{"version": "1.0.0", "author": "Author", "license": "MIT", '
                    '"min_app_version": "0.1.0", "entry_point": "main.py", '
                    '"tags": ["demo"], "permissions": {}}'
                )
            },
        )

        assert body["status"] == "success"
        assert body["violations"] == []
        assert "RegisterPluginRequest" in body["detail"]


class TestNameAndCollisionAgainstTheRealWorkspace:
    async def test_a_duplicate_in_the_same_workspace_and_category_is_reported(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "dupcreate")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "existing-skill",
                "category": "skill",
                "description": "Already saved",
                "config": dict(VALID_SKILL_CONFIG),
            },
            headers=headers,
        )
        assert create.status_code == 201

        body = await _validate(client, headers, **_skill_draft("existing-skill"))

        assert body["status"] == "error"
        assert _rules(body) == ["NAME-COLLISION"]
        assert body["violations"][0]["message"] == (
            "A capability named 'existing-skill' already exists in category 'skill' "
            "for this workspace; the create path returns 409."
        )
        # The rule mirrors the real create path rather than predicting it.
        again = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "existing-skill",
                "category": "skill",
                "description": "Already saved",
                "config": dict(VALID_SKILL_CONFIG),
            },
            headers=headers,
        )
        assert again.status_code == 409

    async def test_the_same_name_in_another_category_is_not_a_collision(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "crosscat")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "shared-name",
                "category": "skill",
                "description": "Saved as a skill",
                "config": dict(VALID_SKILL_CONFIG),
            },
            headers=headers,
        )
        assert create.status_code == 201

        body = await _validate(
            client,
            headers,
            name="shared-name",
            category="tool",
            description="Draft tool",
            config={"parameters": {"type": "object", "properties": {}}},
        )

        assert "NAME-COLLISION" not in _rules(body)

    async def test_an_invalid_name_is_reported(self, client: AsyncClient):
        headers, _ = await _signup_workspace(client, "badname")

        body = await _validate(client, headers, **_skill_draft("bad name!"))

        assert body["status"] == "error"
        assert _rules(body) == ["NAME-PATTERN"]
        assert body["violations"][0]["message"] == (
            "Capability name contains invalid characters. Use alphanumeric, dashes, "
            "dots, or underscores."
        )
        # The collision query is skipped when the name can never match a row.
        assert body["rules_checked"] == 12

    async def test_a_name_free_in_another_workspace_collides_nowhere(
        self, client: AsyncClient
    ):
        owner_headers, _ = await _signup_workspace(client, "collowner")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "someone-elses-name",
                "category": "skill",
                "description": "Saved elsewhere",
                "config": dict(VALID_SKILL_CONFIG),
            },
            headers=owner_headers,
        )
        assert create.status_code == 201
        mine_headers, _ = await _signup_workspace(client, "collmine")

        body = await _validate(client, mine_headers, **_skill_draft("someone-elses-name"))

        assert "NAME-COLLISION" not in _rules(body)
        assert body["status"] == "success"


class TestNoValidatorIsReportedAsSuch:
    async def test_an_unknown_category_is_an_error_not_a_pass(
        self, client: AsyncClient
    ):
        headers, _ = await _signup_workspace(client, "badcat")

        body = await _validate(
            client,
            headers,
            name="widget-capability",
            category="widget",
            description="Not a Vaeloom category",
            config={},
        )

        assert body["status"] == "error"
        assert _rules(body) == ["CATEGORY-VALID"]
        assert "['agent', 'connector', 'mcp', 'plugin', 'skill', 'tool']" in (
            body["violations"][0]["message"]
        )
        # CATEGORY-VALID and NAME-PATTERN only: an unknown category has no table
        # to collide against, so the duplicate query is never issued.
        assert body["rules_checked"] == 2
        assert body["validated_source"] == "none"


class TestAuthorization:
    async def test_an_unauthenticated_call_is_401(self, client: AsyncClient):
        res = await client.post(
            VALIDATE_URL,
            json={"name": "anon-skill", "category": "skill", "config": {}},
        )

        assert res.status_code == 401
        assert res.json()["detail"] == "Not authenticated"
        assert "rules_checked" not in res.text

    async def test_an_authenticated_non_member_is_403(self, client: AsyncClient):
        _, owner_ws = await _signup_workspace(client, "authowner")
        outsider_headers, _ = await _signup_workspace(client, "authoutsider")
        hostile = {**outsider_headers, "X-Workspace-Id": owner_ws}

        res = await client.post(
            VALIDATE_URL,
            json={"name": "owner-secret", "category": "skill", "config": {}},
            headers=hostile,
        )

        assert res.status_code == 403
        # TenantMiddleware denies a workspace the caller is not a member of before
        # the route body runs; either way the answer is 403 and no verdict leaks.
        assert res.json()["detail"] == "Forbidden: Access to specified workspace denied"
        assert "rules_checked" not in res.text
        assert owner_ws not in res.text

    async def test_a_name_held_by_another_workspace_is_not_disclosed(
        self, client: AsyncClient
    ):
        """Anti-enumeration: an occupied foreign name answers exactly like a free one."""
        owner_headers, _ = await _signup_workspace(client, "enumenowner")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "hidden-skill",
                "category": "skill",
                "description": "Private to another workspace",
                "config": dict(VALID_SKILL_CONFIG),
            },
            headers=owner_headers,
        )
        assert create.status_code == 201
        mine_headers, _ = await _signup_workspace(client, "enumenmine")

        occupied = await _validate(client, mine_headers, **_skill_draft("hidden-skill"))
        free = await _validate(client, mine_headers, **_skill_draft("definitely-free-skill"))

        assert occupied["status"] == free["status"] == "success"
        assert occupied["violations"] == free["violations"] == []
        assert occupied["rules_checked"] == free["rules_checked"]
        assert occupied == free
        assert "hidden-skill" not in json.dumps(occupied)


class TestNothingIsPersisted:
    async def test_every_category_leaves_the_capability_table_untouched(
        self, client: AsyncClient, db_session
    ):
        headers, _ = await _signup_workspace(client, "nopersist")

        drafts = [
            _skill_draft("persist-skill"),
            {
                "name": "persist-mcp",
                "category": "mcp",
                "description": "Draft mcp",
                "config": {"transport": "sse"},
            },
            {
                "name": "persist-tool",
                "category": "tool",
                "description": "Draft tool",
                "config": {"parameters": {"type": "array"}},
            },
            {
                "name": "persist-agent",
                "category": "agent",
                "description": "",
                "config": {"tools": ["nope"]},
            },
            {
                "name": "persist-connector",
                "category": "connector",
                "description": "Draft connector",
                "config": {"type": "rest"},
            },
            {
                "name": "persist-plugin",
                "category": "plugin",
                "description": "Draft plugin",
                "config": {"manifest": "{"},
            },
        ]

        for draft in drafts:
            before = await _capability_count(db_session)
            body = await _validate(client, headers, **draft)
            after = await _capability_count(db_session)
            assert after == before, f"{draft['name']} changed the capability count"

        assert await _capability_count(db_session) == 0
        assert body["executed"] is False

    async def test_a_failed_validation_still_persists_nothing(
        self, client: AsyncClient, db_session
    ):
        headers, _ = await _signup_workspace(client, "nopersist2")
        before = await _capability_count(db_session)

        body = await _validate(
            client, headers, **_skill_draft("doomed-skill", required_scope="system.observe")
        )

        assert body["status"] == "error"
        assert await _capability_count(db_session) == before

    async def test_a_saved_capability_row_is_untouched_by_validation(
        self, client: AsyncClient, db_session
    ):
        headers, _ = await _signup_workspace(client, "untouched")
        create = await client.post(
            "/api/v1/capabilities",
            json={
                "name": "saved-skill",
                "category": "skill",
                "description": "Saved",
                "config": dict(VALID_SKILL_CONFIG),
            },
            headers=headers,
        )
        assert create.status_code == 201
        cap_id = create.json()["id"]
        before = await _capability_count(db_session)

        body = await _validate(client, headers, **_skill_draft("saved-skill"))

        assert _rules(body) == ["NAME-COLLISION"]
        assert await _capability_count(db_session) == before
        fetched = await client.get(f"/api/v1/capabilities/{cap_id}", headers=headers)
        assert fetched.status_code == 200
        assert fetched.json()["usage_count"] == 0
        assert fetched.json()["last_used_at"] is None
