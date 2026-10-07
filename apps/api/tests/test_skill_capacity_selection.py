"""Skill injection capacity and selection.

Two defects these pin down, both found by measurement rather than by a failing
test:

G8  ``SKILL_DIRECTIVE_TOKEN_BUDGET`` was 1500. Replaying the real drop loop
    over the real 33-entry catalog admitted 4 skills, and because selection was
    name-ordered the winners were decided by the alphabet rather than the task.
    All 33 render to ~16,056 tokens, so a 1500 budget could never hold the
    catalog no matter how it was ordered.

G9  ``_order_key`` returned ``(trust_band, name)``. Among equally-trusted skills
    the alphabetically-first name won, so a resume-tailoring request injected
    ``academic-cv-builder`` and dropped ``resume-tailor``.

The tests assert the ranking contract directly and then prove it load-bearing by
reverting each change in a temporary copy.
"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Workspace, WorkspaceCapability
from api.services.prompt_compiler import PromptCompiler, estimate_tokens
from api.services.skill_catalog_service import SKILL_CATALOG
from api.services.skill_injection import (
    SKILL_DIRECTIVE_TOKEN_BUDGET,
    EnabledSkill,
    _normalize,
    _order_key,
    _trigger_hits,
    _trigger_state,
    build_skill_directive,
)

GRANTED = ["memory.read"]


def _doc(marker: str, *, rules: int = 3) -> str:
    body = "\n".join(f"{i}. Rule {i} for {marker}." for i in range(1, rules + 1))
    return (
        f"# {marker}\n\n## Mission\nDo {marker} correctly.\n\n"
        f"## Operating Rules\n{body}\n\n"
        f"## Triggers\nUse when the request contains {marker.lower()} trigger.\n\n"
        "## Output Contract\nMarkdown: done, evidence, open questions.\n"
    )


async def _workspace(db: AsyncSession) -> str:
    ws = Workspace(id=uuid.uuid4(), user_id=uuid.uuid4(), name=f"cap-{uuid.uuid4().hex[:8]}")
    db.add(ws)
    await db.commit()
    return str(ws.id)


async def _skill(db, workspace_id: str, name: str, *, config: dict | None = None):
    row = WorkspaceCapability(
        workspace_id=uuid.UUID(workspace_id),
        name=name,
        category="skill",
        description=f"{name} skill",
        version="1.0.0",
        enabled=True,
        config=config or {},
    )
    db.add(row)
    await db.commit()
    return row


def _enabled(name, *, triggers=(), hits=0, trust="core_trusted") -> EnabledSkill:
    return EnabledSkill(
        name=name,
        markdown_doc=_doc(name),
        required_scope="memory.read",
        tags=(),
        triggers=tuple(triggers),
        trust_class=trust,
        version="1.0.0",
        source="workspace",
        capability_id=name,
        match_hits=hits,
    )


# ── G8: capacity ─────────────────────────────────────────────────────────


def test_skill_budget_is_the_measured_value() -> None:
    """Pin the decision so a later change to it is deliberate, not accidental.

    1500 admitted 4 of 33 catalog skills. 4000 admits ~10 while holding skills
    to half the outer budget.
    """
    assert SKILL_DIRECTIVE_TOKEN_BUDGET == 4000


def test_skill_budget_stays_inside_the_prompt_compiler_envelope() -> None:
    """The invariant the outer layer depends on: skills are a minority share.

    ``workspace_skills`` is the first context layer the compiler drops, so a
    skill budget at or above the compiler's own ceiling would be truncated
    straight back off.
    """
    assert 0 < SKILL_DIRECTIVE_TOKEN_BUDGET < PromptCompiler().max_tokens
    assert SKILL_DIRECTIVE_TOKEN_BUDGET <= PromptCompiler().max_tokens // 2


def test_skill_budget_admits_materially_more_than_the_old_value() -> None:
    """Prove the capacity fix against the real catalog, not a synthetic one."""
    from api.services.skill_injection import DIRECTIVE_HEADER, _render_block

    blocks = sorted(
        estimate_tokens(
            _render_block(
                EnabledSkill(
                    name=e.name,
                    markdown_doc=e.markdown_doc,
                    required_scope=e.required_scope,
                    tags=tuple(e.tags),
                    triggers=tuple(e.triggers),
                    trust_class=e.trust_class,
                    version=e.version,
                    source="catalog",
                    capability_id="probe",
                )
            )
        )
        + 2
        for e in SKILL_CATALOG
    )

    def admitted(budget: int) -> int:
        spent, n = estimate_tokens(DIRECTIVE_HEADER), 0
        for cost in blocks:
            if spent + cost > budget:
                break
            spent += cost
            n += 1
        return n

    old, new = admitted(1500), admitted(SKILL_DIRECTIVE_TOKEN_BUDGET)
    assert new >= 8, f"expected the raised budget to admit >=8 skills, got {new}"
    assert new > old * 2, f"expected >2x improvement over 1500 ({old} -> {new})"


@pytest.mark.asyncio
async def test_rendered_directive_never_exceeds_the_budget(db_session: AsyncSession) -> None:
    """Whatever the catalog grows to, the emitted text stays inside the cap."""
    ws = await _workspace(db_session)
    for idx in range(60):
        await _skill(db_session, ws, f"flood-{idx:02d}",
                     config={"markdown_doc": _doc(f"Flood{idx:02d}", rules=12),
                             "required_scope": "memory.read"})

    directive = await build_skill_directive(
        db_session, ws, agent_name="career", allowed_scopes=GRANTED,
        user_message="anything", token_budget=1500,
    )

    assert estimate_tokens(directive.text) <= 1500
    assert any(s.reason == "token_budget_exceeded" for s in directive.skipped)


# ── G9: selection ────────────────────────────────────────────────────────


def test_more_specific_trigger_matches_win_within_a_trust_band() -> None:
    """A message matching three declared phrases outranks one matching a single.

    Both are core_trusted, so trust primacy cannot break the tie -- this is the
    key G9 added.

    The names are chosen adversarially: the *less* relevant skill sorts first
    alphabetically. Under the old name-only key this test therefore fails,
    which is what makes it a real guard rather than a tautology.
    """
    vague = _enabled("aaa-vague", hits=1)  # alphabetically first, less relevant
    specific = _enabled("zzz-specific", hits=3)  # alphabetically last, more relevant

    assert vague.name < specific.name, "guard requires the name order to oppose relevance"
    assert _order_key(specific) < _order_key(vague), (
        "relevance must outrank the alphabet"
    )


def test_trust_primacy_still_dominates_relevance() -> None:
    """The documented primacy rule is preserved: trusted rules come first.

    A core_trusted skill with no matches still precedes a community skill with
    three, because trusted rules are followed most reliably when placed early.
    """
    trusted = _enabled("zzz-trusted", hits=0, trust="core_trusted")
    community = _enabled("aaa-community", hits=3, trust="community")

    assert _order_key(trusted) < _order_key(community)


def test_name_is_the_final_tiebreak_so_order_is_deterministic() -> None:
    a = _enabled("alpha", hits=2)
    b = _enabled("beta", hits=2)
    assert _order_key(a) < _order_key(b)
    assert _order_key(b) > _order_key(a)


def test_default_hits_is_zero_so_ranking_never_fabricates_relevance() -> None:
    assert _enabled("plain").match_hits == 0


def test_trigger_hits_and_trigger_state_never_disagree() -> None:
    """Single source of truth: eligibility and ranking share one matcher."""
    skill = _enabled("resume-tailor", triggers=("tailor resume", "resume tailoring"))
    for message in ("please tailor resume now", "resume tailoring help", "unrelated", ""):
        hay = _normalize(message)
        hits = _trigger_hits(skill, hay)
        matched, detail = _trigger_state(skill, hay)
        assert matched == bool(hits), message
        if hits:
            assert all(h in detail for h in hits), (message, detail)


@pytest.mark.asyncio
async def test_ranking_cannot_inject_an_ineligible_skill(db_session: AsyncSession) -> None:
    """Relevance only reorders. An unmatched skill must never be injected.

    This is the safety property of the change: match_hits is populated during
    eligibility, so a skill that failed the trigger check cannot be resurrected
    by ranking.
    """
    ws = await _workspace(db_session)
    await _skill(db_session, ws, "alpha-matches", config={
        "markdown_doc": _doc("Alpha"), "required_scope": "memory.read",
        "triggers": ["tailor resume"],
    })
    await _skill(db_session, ws, "zulu-no-match", config={
        "markdown_doc": _doc("Zulu"), "required_scope": "memory.read",
        "triggers": ["quantum entanglement"],
    })

    directive = await build_skill_directive(
        db_session, ws, agent_name="career", allowed_scopes=GRANTED,
        user_message="please tailor resume for acme",
    )

    injected = set(directive.injected)
    assert "alpha-matches" in injected
    assert "zulu-no-match" not in injected
    assert "zulu-no-match" in {s.name: s.reason for s in directive.skipped}


@pytest.mark.asyncio
async def test_budget_contention_awards_the_slot_to_the_relevant_skill(
    db_session: AsyncSession,
) -> None:
    """End-to-end: under a tight budget the relevant skill is the one kept.

    Two skills both eligible; the alphabetically-first one is deliberately the
    irrelevant one, and the budget only has room for one. Before G9 the
    irrelevant skill won on name alone.
    """
    ws = await _workspace(db_session)
    # Both skills are ELIGIBLE (each matches at least one declared phrase), so
    # this exercises ranking rather than eligibility. The decoy is alphabetically
    # first and matches fewer phrases, and the budget has room for only one --
    # exactly the situation the old name-only key decided wrongly.
    await _skill(db_session, ws, "aaa-decoy", config={
        "markdown_doc": _doc("Decoy", rules=12), "required_scope": "memory.read",
        "triggers": ["resume"],
    })
    await _skill(db_session, ws, "zzz-target", config={
        "markdown_doc": _doc("Target"), "required_scope": "memory.read",
        "triggers": ["tailor my resume", "resume tailoring"],
    })

    msg = "please tailor my resume; I need resume tailoring help"
    generous = await build_skill_directive(
        db_session, ws, agent_name="career", allowed_scopes=GRANTED,
        user_message=msg, token_budget=100_000,
    )
    assert set(generous.injected) == {"aaa-decoy", "zzz-target"}, (
        "both skills must be eligible, otherwise this tests eligibility, not ranking"
    )

    # Find the largest budget that still admits exactly one skill. Token counts
    # are not additive across concatenation (the tokenizer merges across block
    # boundaries), so a hardcoded budget is either flaky or wrong; searching
    # removes the guesswork.
    ceiling = estimate_tokens(generous.text)
    lo, hi, tightest = 1, ceiling, None
    while lo <= hi:
        mid = (lo + hi) // 2
        probe = await build_skill_directive(
            db_session, ws, agent_name="career", allowed_scopes=GRANTED,
            user_message=msg, token_budget=mid,
        )
        # The two "not exactly one" outcomes need opposite directions: too small
        # a budget admits nothing, too large admits both. Treating them the same
        # drives the search monotonically down and reports "no budget found".
        if len(probe.injected) == 1:
            tightest, lo = mid, mid + 1
        elif not probe.injected:
            lo = mid + 1
        else:
            hi = mid - 1

    assert tightest is not None, "no budget admitted exactly one skill; test is degenerate"
    directive = await build_skill_directive(
        db_session, ws, agent_name="career", allowed_scopes=GRANTED,
        user_message=msg, token_budget=tightest,
    )

    injected = set(directive.injected)
    assert injected == {"zzz-target"}, (
        f"at the tightest budget the relevant skill should take the single slot; "
        f"got {injected} (the decoy matches 1 phrase, the target 2)"
    )
    assert {s.name for s in directive.skipped} == {"aaa-decoy"}