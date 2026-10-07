import pytest
from unittest.mock import AsyncMock, patch
from httpx import Response

from api.services.github_skills_sync import (
    parse_remote_skill_md,
    sync_skills_from_github,
    RemoteSkillSummary,
    GitHubSkillSyncResult,
)


def test_parse_remote_skill_md_valid():
    content = """---
name: sample-career-coach
description: Test career coaching skill
tags:
  - Career
  - Coaching
required_scope: memory.read
autonomy: suggest
trust_class: community
triggers:
  - career advice
version: 1.0.0
author: Vaeloom Community
---

# Sample Career Coach

## Mission
Provide evidence-grounded career coaching guidance.

## Operating Rules
1. Never fabricate accomplishments or experience.
2. Ground all advice on documented user experience.
3. Suggest concrete action steps with milestones.
4. Highlight transferable skills across domains.
5. Challenge assumptions with constructive questions.
6. Provide structured follow-up recommendations.

## Triggers
career advice, career transition, coaching.

## Output Contract
Markdown report with strategic recommendations. Scope: `memory.read`.
"""
    result = parse_remote_skill_md(content, default_slug="fallback-slug")
    assert result.slug == "sample-career-coach"
    assert result.name == "sample-career-coach"
    assert result.required_scope == "memory.read"
    assert result.valid is True
    assert result.validation_status == "success"
    assert len(result.violations) == 0


def test_parse_remote_skill_md_prohibited_domain():
    content = """---
name: alphafold
description: Protein structure prediction
tags:
  - Biology
required_scope: memory.read
---

# AlphaFold Predictor

## Mission
Predict protein folds.

## Operating Rules
1. Process PDB files.
2. Run predictions.
3. Check residue contacts.
4. Output fold coordinates.
5. Benchmark against CASP.
6. Return structure.

## Triggers
alphafold, protein fold.

## Output Contract
Coordinates. Scope: `memory.read`.
"""
    result = parse_remote_skill_md(content, default_slug="alphafold")
    assert result.valid is False
    assert result.validation_status == "error"
    assert any("Domain exclusion" in v for v in result.violations)


def test_parse_remote_skill_md_invalid_scope():
    content = """---
name: rogue-skill
description: Unauthorized scope skill
tags:
  - Career
required_scope: system.root.destroy
---

# Rogue Skill

## Mission
Attempt root access.

## Operating Rules
1. Rule one.
2. Rule two.
3. Rule three.
4. Rule four.
5. Rule five.
6. Rule six.

## Triggers
rogue, destroy.

## Output Contract
Result. Scope: `system.root.destroy`.
"""
    result = parse_remote_skill_md(content, default_slug="rogue-skill")
    assert result.valid is False
    assert result.validation_status == "error"
    assert any("Scope vocabulary" in v for v in result.violations)


@pytest.mark.asyncio
async def test_sync_skills_from_github_mocked():
    tree_payload = {
        "tree": [
            {"path": "skills/ats-audit/SKILL.md", "type": "blob"},
            {"path": "README.md", "type": "blob"},
            {"path": "skills/bad-domain/SKILL.md", "type": "blob"},
        ]
    }

    valid_md = """---
name: ats-audit
description: ATS parseability audit
tags:
  - Career
required_scope: memory.read
---

# ATS Audit

## Mission
Audit resume formatting and keywords.

## Operating Rules
1. Check standard fonts and headers.
2. Verify contact info parsing.
3. Check chronological ordering.
4. Audit keyword density against target role.
5. Disallow graphics, multi-column tables, text boxes.
6. Compute match percentage.

## Triggers
ats audit, ats check.

## Output Contract
Audit score card. Scope: `memory.read`.
"""

    bad_domain_md = """---
name: chembl
description: Chemical bioactivity
tags:
  - Chemistry
required_scope: memory.read
---

# ChEMBL Database

## Mission
Bioactivity searches.

## Operating Rules
1. Rule one.
2. Rule two.
3. Rule three.
4. Rule four.
5. Rule five.
6. Rule six.

## Triggers
chembl.

## Output Contract
Compounds. Scope: `memory.read`.
"""

    async def mock_get(url, *args, **kwargs):
        if "git/trees" in url:
            return Response(200, json=tree_payload)
        elif "ats-audit" in url:
            return Response(200, text=valid_md)
        elif "bad-domain" in url:
            return Response(200, text=bad_domain_md)
        return Response(404)

    with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=mock_get)):
        result = await sync_skills_from_github("Driftloom/vaeloom-skills", "master")
        assert result.repository == "Driftloom/vaeloom-skills"
        assert result.skills_discovered == 2
        assert result.skills_valid == 1
        assert result.skills_rejected == 1
        assert len(result.skills) == 2


@pytest.mark.asyncio
async def test_sync_github_skills_endpoint_unauthenticated(client):
    res = await client.post("/api/v1/capabilities/sync-github", json={})
    assert res.status_code == 401


async def _signup_with_workspace(client, prefix: str):
    """Create a user plus a workspace, returning (token, workspace_id)."""
    import uuid

    email = f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Password123!", "name": "Sync Tester"},
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]

    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": f"{prefix} Space"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ws_res.status_code == 201
    return token, ws_res.json()["id"]


@pytest.mark.asyncio
async def test_sync_github_skills_endpoint_authenticated(client):
    token, workspace_id = await _signup_with_workspace(client, "sync")
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Workspace-Id": workspace_id,
    }

    mock_sync_result = GitHubSkillSyncResult(
        repository="Driftloom/vaeloom-skills",
        ref="master",
        skills_discovered=8,
        skills_valid=8,
        skills_rejected=0,
        skills=[],
        errors=[],
    )

    with patch(
        "api.services.github_skills_sync.sync_skills_from_github",
        new=AsyncMock(return_value=mock_sync_result),
    ):
        res = await client.post(
            "/api/v1/capabilities/sync-github",
            json={"repository": "Driftloom/vaeloom-skills", "ref": "master"},
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["repository"] == "Driftloom/vaeloom-skills"
        assert data["skills_discovered"] == 8
        assert data["skills_valid"] == 8


# --------------------------------------------------------------------------
# Tenant isolation.
#
# Precision note: cross-workspace denial is enforced by TenantMiddleware
# (middleware/tenant.py::check_user_workspace_access), which is the
# authoritative boundary for every route. Removing the route-level
# _verify_workspace_access call does NOT make this endpoint cross-tenant
# reachable -- verified by removing the guard and re-running. This test
# therefore pins the middleware guarantee, not the route guard.
#
# The route guard added to /sync-github is defence in depth: it makes this
# endpoint consistent with the other capability routes, and it keeps the
# authorisation requirement visible at the endpoint rather than depending on
# middleware ordering to be remembered.
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sync_github_rejects_other_users_workspace(client):
    """User B's workspace id must be refused for user A's token."""
    token_a, workspace_a = await _signup_with_workspace(client, "alpha")
    _token_b, workspace_b = await _signup_with_workspace(client, "beta")
    assert workspace_a != workspace_b

    mock_result = GitHubSkillSyncResult(repository="Driftloom/vaeloom-skills", ref="master")
    with patch(
        "api.services.github_skills_sync.sync_skills_from_github",
        new=AsyncMock(return_value=mock_result),
    ) as mocked:
        res = await client.post(
            "/api/v1/capabilities/sync-github",
            json={"repository": "Driftloom/vaeloom-skills"},
            headers={"Authorization": f"Bearer {token_a}", "X-Workspace-Id": workspace_b},
        )
    assert res.status_code == 403
    # TenantMiddleware rejects the mismatched X-Workspace-Id before the route
    # body runs, so the router's own message is not what surfaces here. Assert the
    # denial, not which layer produced it.
    assert "workspace" in res.json()["detail"].lower()
    # The denial must happen before any outbound GitHub fetch is attempted.
    mocked.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_github_falls_back_to_the_users_own_workspace(client):
    """No X-Workspace-Id: the route resolves the caller's own first workspace.

    Signup provisions a workspace, so the fallback succeeds rather than erroring.
    This test documents that behaviour so a future change to the guard is
    visible here.
    """
    import uuid

    email = f"nows_{uuid.uuid4().hex[:8]}@test.com"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "Password123!", "name": "No Header"},
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]

    mock_result = GitHubSkillSyncResult(repository="Driftloom/vaeloom-skills", ref="master")
    with patch(
        "api.services.github_skills_sync.sync_skills_from_github",
        new=AsyncMock(return_value=mock_result),
    ):
        res = await client.post(
            "/api/v1/capabilities/sync-github",
            json={"repository": "Driftloom/vaeloom-skills"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert res.status_code == 200
    assert res.json()["persisted"] is False


@pytest.mark.asyncio
async def test_sync_github_rejects_malformed_repository(client):
    """A non-slug repository is a 422 at the edge, before any network use."""
    token, workspace_id = await _signup_with_workspace(client, "malformed")
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}

    mock_result = GitHubSkillSyncResult(repository="x/y", ref="master")
    with patch(
        "api.services.github_skills_sync.sync_skills_from_github",
        new=AsyncMock(return_value=mock_result),
    ) as mocked:
        for bad in ["not-a-slug", "https://github.com/Driftloom/vaeloom-skills", "../../etc"]:
            res = await client.post(
                "/api/v1/capabilities/sync-github",
                json={"repository": bad},
                headers=headers,
            )
            assert res.status_code == 422, bad
    mocked.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_github_does_not_accept_a_token_in_the_body(client):
    """Credentials belong in a header; a body-borne secret leaks into logs.

    Asserts two things: the body field is rejected by the schema, and the
    published OpenAPI no longer advertises it.
    """
    token, workspace_id = await _signup_with_workspace(client, "leaky")
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}

    mock_result = GitHubSkillSyncResult(repository="Driftloom/vaeloom-skills", ref="master")
    with patch(
        "api.services.github_skills_sync.sync_skills_from_github",
        new=AsyncMock(return_value=mock_result),
    ) as mocked:
        res = await client.post(
            "/api/v1/capabilities/sync-github",
            json={"repository": "Driftloom/vaeloom-skills", "auth_token": "ghp_secret"},
            headers=headers,
        )
        assert res.status_code == 422
    mocked.assert_not_awaited()

    # /openapi.json is authenticated under zero-trust, so read the schema off the
    # app object rather than over HTTP (same approach as test_contract_validation).
    import api.main

    schema = api.main.app.openapi()
    ref = (
        schema["paths"]["/api/v1/capabilities/sync-github"]["post"]["requestBody"]
        ["content"]["application/json"]["schema"]["$ref"]
    )
    props = schema["components"]["schemas"][ref.split("/")[-1]]["properties"]
    assert "auth_token" not in props, props.keys()
    assert set(props) == {"repository", "ref"}


@pytest.mark.asyncio
async def test_sync_github_declares_it_does_not_persist(client):
    """The response contract must state that nothing was written."""
    token, workspace_id = await _signup_with_workspace(client, "nopersist")
    headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": workspace_id}

    mock_result = GitHubSkillSyncResult(repository="Driftloom/vaeloom-skills", ref="master")
    with patch(
        "api.services.github_skills_sync.sync_skills_from_github",
        new=AsyncMock(return_value=mock_result),
    ):
        res = await client.post("/api/v1/capabilities/sync-github", json={}, headers=headers)
        assert res.status_code == 200
        assert res.json()["persisted"] is False


@pytest.mark.asyncio
async def test_sync_github_never_writes_capability_rows():
    """Structural guard: the engine must stay free of any DB dependency.

    Inspects the AST rather than the raw text, so the module's own docstring
    (which names these symbols in order to disclaim them) does not trip the
    check. If someone later wires persistence in here, this fails and forces a
    sanitisation review, because remote markdown becomes agent prompt text.
    """
    import ast
    import inspect

    from api.services import github_skills_sync as mod

    tree = ast.parse(inspect.getsource(mod))

    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(a.name.split(".")[-1] for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            imported.update(a.name for a in node.names)
            if node.module:
                imported.add(node.module.split(".")[-1])

    banned_imports = {"AsyncSession", "get_db", "WorkspaceCapability", "sqlalchemy", "Session"}
    assert not (imported & banned_imports), (
        f"github_skills_sync.py now imports {sorted(imported & banned_imports)}. "
        f"Persisting remote skill markdown requires a sanitisation review first."
    )

    # A db-taking parameter would be the other way persistence sneaks in.
    for fn in [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
        arg_names = {a.arg for a in fn.args.args + fn.args.kwonlyargs}
        assert not (arg_names & {"db", "session"}), (
            f"{fn.name}() takes a database argument; this engine is validate-only."
        )


# --------------------------------------------------------------------------
# Bounded-work limits
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sync_truncates_at_the_skill_cap(client):
    """A pathologically large repo must not become thousands of fetches."""
    from api.services.github_skills_sync import MAX_SKILLS_PER_SYNC

    tree = {
        "tree": [
            {"type": "blob", "path": f"skills/s{i}/SKILL.md"}
            for i in range(MAX_SKILLS_PER_SYNC + 25)
        ]
    }
    fetch_count = {"n": 0}

    async def mock_get(url, *args, **kwargs):
        if "git/trees" in url:
            return Response(200, json=tree)
        fetch_count["n"] += 1
        return Response(200, text="---\nname: s\ndescription: x\n---\n\n## Mission\nm\n")

    with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=mock_get)):
        result = await sync_skills_from_github("big/repo", "master")

    assert result.skills_truncated is True
    assert result.skills_discovered == MAX_SKILLS_PER_SYNC
    assert fetch_count["n"] == MAX_SKILLS_PER_SYNC
    assert any("set-skipped" in e for e in result.errors), result.errors


@pytest.mark.asyncio
async def test_sync_skips_oversized_documents():
    """An oversized SKILL.md is skipped and counted, not silently truncated."""
    from api.services.github_skills_sync import MAX_DOC_BYTES

    tree = {"tree": [{"type": "blob", "path": "skills/huge/SKILL.md"}]}
    oversized = "x" * (MAX_DOC_BYTES + 1)

    async def mock_get(url, *args, **kwargs):
        if "git/trees" in url:
            return Response(200, json=tree)
        return Response(200, content=oversized.encode("utf-8"))

    with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=mock_get)):
        result = await sync_skills_from_github("big/repo", "master")

    assert result.skills == []
    assert result.skills_rejected == 1
    assert any("byte per-document limit" in e for e in result.errors), result.errors


def test_sync_result_defaults_to_not_persisted():
    assert GitHubSkillSyncResult(repository="a/b", ref="main").persisted is False

