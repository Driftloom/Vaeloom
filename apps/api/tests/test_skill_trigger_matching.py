"""Trigger activation: matching must survive ordinary English.

G12. ``_trigger_hits`` originally required contiguous substring containment of a
declared trigger phrase. With a 147-trigger catalog of multi-word English
phrases, a single filler word broke activation, so real requests silently
activated nothing:

    "can you tailor resume for acme?"  -> matched
    "please tailor my resume for acme"  -> no match
    "tailor the resume please"          -> no match

A request that matches no skill has no skill for the capacity or ranking work to
help, so this sat upstream of both.

The rule is now token-set containment. These tests pin the fix and, just as
importantly, pin that it does NOT activate everything: token equality is
retained so ``parse`` still does not match ``parser``.
"""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.skill_catalog_service import SKILL_CATALOG
from api.services.skill_injection import (
    EnabledSkill,
    _normalize,
    _tokenize,
    _trigger_hits,
    _trigger_state,
    build_skill_directive,
)

GRANTED = ["memory.read"]


def _skill(name: str, triggers: tuple[str, ...], *, trust="core_trusted") -> EnabledSkill:
    return EnabledSkill(
        name=name,
        markdown_doc=f"# {name}\n\n## Mission\nDo {name}.\n",
        required_scope="memory.read",
        tags=(),
        triggers=triggers,
        trust_class=trust,
        version="1.0.0",
        source="workspace",
        capability_id=name,
    )


def _eligible_over_catalog(message: str) -> set[str]:
    """Which real catalog skills a message activates."""
    hay = _normalize(message)
    out = set()
    for e in SKILL_CATALOG:
        s = EnabledSkill(
            name=e.name, markdown_doc="", required_scope=e.required_scope, tags=(),
            triggers=tuple(e.triggers), trust_class=e.trust_class, version=e.version,
            source="catalog", capability_id="p",
        )
        if not e.triggers or _trigger_hits(s, hay):
            out.add(e.name)
    return out


# ── the fix ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("can you tailor resume for acme?", "ats-resume-builder"),
        ("please tailor my resume for acme", "ats-resume-builder"),
        ("tailor the resume please", "ats-resume-builder"),
        ("help me tailor my resume for this role", "ats-resume-builder"),
        ("tailor    my     resume", "ats-resume-builder"),
    ],
)
def test_filler_words_between_trigger_tokens_still_match(message, expected) -> None:
    assert expected in _eligible_over_catalog(message), (
        f"{message!r} should activate {expected}"
    )


def test_token_equality_is_retained() -> None:
    """The substring rule's worst failure must not come back.

    ``parse`` matched ``parser`` under substring containment. Token equality
    forbids it, so a phrase of near-miss words does not activate.
    """
    s = _skill("near-miss", ("parse test",))
    assert _trigger_hits(s, _normalize("my parser was misbehaving while testing")) == []
    assert _trigger_hits(s, _normalize("run a parse test")) == ["parse test"]


def test_punctuation_does_not_block_a_match() -> None:
    s = _skill("punctuated", ("tailor resume",))
    assert _trigger_hits(s, _normalize("Please tailor my resume, then send it.")) == [
        "tailor resume"
    ]


def test_case_and_whitespace_are_irrelevant() -> None:
    s = _skill("casing", ("Tailor Resume",))
    assert _trigger_hits(s, _normalize("TAILOR   MY   RESUME")) == ["Tailor Resume"]


# ── what must NOT match ──────────────────────────────────────────────────


def test_unrelated_message_activates_nothing() -> None:
    s = _skill("resume-adjacent", ("tailor resume",))
    assert _trigger_hits(s, _normalize("what is the weather in oslo")) == []


def test_partial_token_coverage_does_not_match() -> None:
    """Every token of the phrase is required, not merely the distinctive one."""
    s = _skill("both-needed", ("resume tailoring",))
    assert _trigger_hits(s, _normalize("please review my resume")) == []
    assert _trigger_hits(s, _normalize("resume tailoring please")) == ["resume tailoring"]


def test_empty_and_punctuation_only_messages_match_nothing() -> None:
    s = _skill("needs-text", ("tailor resume",))
    for message in ("", "   ", "!!! ???"):
        assert _trigger_hits(s, _normalize(message)) == [], message


def test_a_skill_with_no_triggers_scores_zero_hits() -> None:
    s = _skill("no-triggers", ())
    assert _trigger_hits(s, _normalize("anything at all")) == []
    matched, detail = _trigger_state(s, _normalize("anything at all"))
    assert matched is True, "a skill declaring no triggers is always eligible"
    assert detail == ""


def test_unrelated_multi_topic_message_does_not_over_activate() -> None:
    """A message naming every token of a phrase in unrelated places.

    Token-set containment does loosen the rule, so the cost is asserted rather
    than assumed away. The token budget remains the hard cap on damage.
    """
    activated = _eligible_over_catalog(
        "my parser broke, so I wrote a parser test; separately I need to review my offer"
    )
    # The cover-letter phrase's tokens (cover, letter) do appear, and that skill
    # legitimately activates. What must not happen is a broad cascade.
    assert len(activated) <= 2, activated


def test_trigger_hits_and_trigger_state_never_disagree() -> None:
    """Eligibility and ranking must share one matcher."""
    s = _skill("shared", ("tailor resume", "resume tailoring", "cover letter"))
    for message in ("tailor my resume", "cover letter please", "nothing relevant", ""):
        hay = _normalize(message)
        hits = _trigger_hits(s, hay)
        matched, detail = _trigger_state(s, hay)
        assert matched == bool(hits), message
        if hits:
            assert all(h in detail for h in hits), (message, detail)


# ── integration ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_filler_word_message_injects_the_right_skill(db_session: AsyncSession) -> None:
    """End to end: the phrasing that used to match nothing now reaches the prompt."""
    import uuid

    from api.models.schema import Workspace, WorkspaceCapability

    ws = Workspace(id=uuid.uuid4(), user_id=uuid.uuid4(), name="g12")
    db_session.add(ws)
    await db_session.commit()

    db_session.add(
        WorkspaceCapability(
            workspace_id=ws.id,
            name="tailor-helper",
            category="skill",
            description="tailoring helper",
            version="1.0.0",
            enabled=True,
            config={
                "markdown_doc": "# Tailor\n\n## Mission\nTailor resumes.\n\n"
                "## Operating Rules\n1. Never invent metrics.\n2. Cite the source.\n",
                "required_scope": "memory.read",
                "triggers": ["tailor resume"],
            },
        )
    )
    await db_session.commit()

    directive = await build_skill_directive(
        db_session, str(ws.id), agent_name="career", allowed_scopes=GRANTED,
        user_message="please tailor my resume for the acme role",
    )

    assert "tailor-helper" in directive.injected


def test_tokenize_discards_punctuation_and_empty_fragments() -> None:
    assert _tokenize("Hello, world! -- it's fine.") == [
        "hello", "world", "it", "s", "fine"
    ]
    assert _tokenize("") == []
    assert _tokenize("///") == []