"""Server-side catalog of Vaeloom's bundled skills.

Why this exists
---------------
Until now the only source of skills was ``apps/web/src/lib/capabilities-data.ts``
— twelve TypeScript literals that shipped to the browser. The API had no catalog,
so a client could not ask "what skills does Vaeloom have?", and the counts shown
against them (``usageCount: 1540``) were fabricated by the frontend.

What a skill actually is
------------------------
A skill is a **markdown instruction document**. Vaeloom agents are prompted with
these; they are not compiled artefacts and there is nothing to import or run. The
catalog therefore ships text, not code, and the only honest "does this work"
question is *is the document well-formed and in the current scope vocabulary* —
which is what :func:`validate_skill_document` checks.

Fabrications this module removes
--------------------------------
* ``author`` values like ``Antigravity Knowledge Base``, ``GStack Engine``,
  ``Design Intelligence Engine`` and ``Design Lead Studio`` are not Vaeloom
  entities. Every entry is authored by ``Vaeloom Core Team``.
* ``trustClass: 'first_party'`` on imported/community content was a security
  mislabel. Entries declare ``core_trusted`` or ``community`` and nothing else;
  ``first_party`` is not a value this catalog can emit.
* ``usageCount`` is absent by construction. Usage is per workspace and lives in
  ``workspace_capabilities.usage_count`` (migration 0062).
* Scopes that never existed in the tool registry (``system.observe``,
  ``browser.scrape``, ``plugin.execute``, ``resumes.write``, ``ats.analyze``,
  ``telemetry.read``, ``prompts.write``, ``application.draft``,
  ``approval.create``) are replaced with the nearest scope that does — each
  substitution is commented at its call site below.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel, Field

TrustClass = Literal["core_trusted", "community"]
Autonomy = Literal["suggest", "autonomous", "approval_required"]

TRUST_CLASSES: frozenset[str] = frozenset({"core_trusted", "community"})
AUTONOMY_VALUES: frozenset[str] = frozenset({"suggest", "autonomous", "approval_required"})

CORE_AUTHOR = "Vaeloom Core Team"

# Catalog self-check identifiers. Each entry declares one; validate_skill_document
# runs it in addition to the shared rule set.
SELF_CHECKS: frozenset[str] = frozenset(
    {"numbered-operating-rules", "triggers-echoed", "scope-cited"}
)

_SECTION_RE = re.compile(r"^\s{0,3}#{2,3}\s+(?P<title>.+?)\s*$")
_NUMBERED_RE = re.compile(r"^\s*(?:\d+[.)]|[-*])\s+\S")
_PLACEHOLDER_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("TODO", re.compile(r"\bTODO\b")),
    ("{{", re.compile(r"\{\{")),
    ("<placeholder>", re.compile(r"<placeholder>", re.IGNORECASE)),
)


class SkillCatalogEntry(BaseModel):
    """One bundled skill: identity plus the markdown the agent is prompted with."""

    slug: str
    name: str
    description: str
    tags: list[str]
    version: str
    author: str
    required_scope: str
    autonomy: Autonomy
    trust_class: TrustClass
    triggers: list[str] = Field(default_factory=list)
    markdown_doc: str
    bundled: bool = True
    self_check: str = "numbered-operating-rules"

    model_config = {"frozen": True}


class SkillViolation(BaseModel):
    rule: str
    message: str
    line: int | None = None
    severity: Literal["hard", "soft"] = "hard"

    model_config = {"frozen": True}


class SkillValidationResult(BaseModel):
    status: Literal["success", "warning", "error"]
    rules_checked: int
    violations: list[SkillViolation] = Field(default_factory=list)
    from_catalog: bool = False
    detail: str = ""

    model_config = {"frozen": True}


def tool_scope_vocabulary() -> frozenset[str]:
    """Every scope the tool registry actually issues.

    Read from ``ALL_TOOLS`` rather than hard-coded so a scope removed from the
    registry immediately invalidates the catalog entries that claim it.
    """
    from ..tools.definitions import ALL_TOOLS

    return frozenset(td.required_scope for td in ALL_TOOLS.values())


# ── The catalog ──────────────────────────────────────────────────────────
# Scope substitutions are noted inline. Every scope below is a member of
# tool_scope_vocabulary() as of migration 0062.

SKILL_CATALOG: tuple[SkillCatalogEntry, ...] = (
    SkillCatalogEntry(
        slug="acceptance-criteria-review",
        name="acceptance-criteria-review",
        description=(
            "Turn requirements into verifiable acceptance criteria, and review an "
            "existing criteria set for ambiguity, missing failure paths, and "
            "unverifiable claims."
        ),
        tags=["QA", "Testing", "Requirements"],
        version="1.2.0",
        author=CORE_AUTHOR,
        # The TS data declared application.draft/approval.create, neither of which
        # exists in the tool registry. A criteria review reads requirements out of
        # workspace memory; memory.read is the real scope for that.
        required_scope="memory.read",
        autonomy="suggest",
        # Imported from an external knowledge base, not authored by Vaeloom.
        trust_class="community",
        triggers=["acceptance criteria review", "review criteria", "audit requirements"],
        self_check="triggers-echoed",
        markdown_doc="""# Acceptance Criteria Review

## Mission
Produce acceptance criteria that a reviewer can execute without asking a
question, and audit existing criteria against that bar. Turn requirements and
user stories into verifiable, unambiguous criteria that cover failure paths.

## Operating Rules
1. Every criterion gets one observable outcome and one verification method. A
   criterion nobody can verify is not a criterion, it is a wish.
2. Cover the negative path for every positive path: rejection, timeout,
   cancellation, malformed input, and permission denial all get a criterion.
3. Never silently invent a threshold. If a number matters (latency, count, size)
   and the source does not state it, ask or mark it explicitly as open.
4. Separate confirmed facts from working assumptions from open questions. Never
   present an assumption with the same weight as a sourced requirement.
5. Preserve identifiers, enums and casing exactly as the source states them;
   renaming a field is a behaviour change disguised as an edit.
6. Default to Markdown. When the caller asks for a table, CSV, JSON or ticket
   fields, carry risk, evidence, priority and boundaries across in every format.

## Triggers
Use when the request contains acceptance criteria review, review criteria, or
audit requirements.

## Output Contract
Markdown, in this order: a table of criterion / verification / evidence
expected, then open questions, then assumptions. Each criterion carries its
source requirement id. Scope for this skill is `memory.read`: requirements are
read from workspace memory, nothing is written back.
""",
    ),
    SkillCatalogEntry(
        slug="accessibility-testing",
        name="accessibility-testing",
        description=(
            "Audit web UI surfaces against WCAG 2.1 AA: contrast ratios, focus "
            "indicators, keyboard traversal parity and screen-reader semantics."
        ),
        tags=["A11y", "WCAG", "Frontend"],
        version="1.0.4",
        author=CORE_AUTHOR,
        # The TS data declared browser.scrape, which does not exist. The real
        # scope for observing a rendered page is system.browser.read.
        required_scope="system.browser.read",
        autonomy="autonomous",
        # Imported from an external knowledge base.
        trust_class="community",
        triggers=["audit a11y", "check accessibility", "wcag review"],
        self_check="triggers-echoed",
        markdown_doc="""# Accessibility Testing & WCAG Audit

## Mission
Find the concrete accessibility defects in a UI surface and report each one
with the WCAG success criterion it fails, the element that fails it, and the
remedy.

## Operating Rules
1. Contrast: minimum 4.5:1 for standard text, 3:1 for large display titles and
   active icons. Measure it; do not eyeball it.
2. Focus rings: a visible 2-4px indicator on every interactive element. An
   element that takes focus and shows nothing is a defect, not a style choice.
3. Keyboard navigation: complete tab traversal parity with visual order, and no
   keyboard trap. Every mouse affordance has a keyboard equivalent.
4. Screen reader semantics: `aria-label` on icon-only buttons, real landmark
   regions (`nav`, `main`, `aside`), and headings that descend without skipping
   levels.
5. Never report a defect you have not observed on the actual rendered surface.
   If the surface could not be reached, say so and report nothing.
6. Rank findings by user impact (keyboard-only, screen-reader, low vision) before
   by severity number.

## Triggers
Use when the request contains audit a11y, check accessibility, or wcag review.

## Output Contract
Markdown table: finding / WCAG criterion / element / user impact / remedy. Then a
one-line count of defects by severity. Scope for this skill is
`system.browser.read`: the audit reads rendered pages and writes no data.
""",
    ),
    SkillCatalogEntry(
        slug="agent-building",
        name="agent-building",
        description=(
            "Blueprint for designing, implementing, testing and hardening "
            "autonomous agents: lifecycle contract, typed tools, ReAct loop, and "
            "an approval gate in front of every irreversible side effect."
        ),
        tags=["Agent", "Architecture"],
        version="2.1.0",
        author=CORE_AUTHOR,
        required_scope="agent.spawn",
        autonomy="approval_required",
        trust_class="core_trusted",
        triggers=["build agent", "design new agent", "agent architecture"],
        self_check="numbered-operating-rules",
        markdown_doc="""# Agent Building Architecture Blueprint

## Mission
Produce an agent design that is testable and safe: explicit lifecycle states,
typed tool contracts, a bounded reasoning loop, and human approval in front of
irreversible work.

## Operating Rules
1. **BaseAgent contract**: strict lifecycle states — `idle`, `running`,
   `waiting_for_approval`, `errored`, `completed`. No other transitions are legal.
2. **Typed tools**: every tool declares a JSON input schema, an output schema and
   exactly one required scope. An untyped tool is a tool you cannot test.
3. **ReAct loop**: structured Reasoning, Action Selection, Observation,
   Reflection, with a hard iteration and token budget so the loop always
   terminates.
4. **Approval gate**: intercept before any state-mutating or irreversible side
   effect. Read-only tools run unattended; writes ask.
5. **Failure honesty**: a failed step records its real error. An agent that
   reports success it did not achieve is worse than one that fails loudly.
6. **Test the contract, not the prose**: assert on lifecycle transitions, tool
   schemas and denials, not on prompt wording.

## Triggers
Use when the request contains build agent, design new agent, or agent
architecture.

## Output Contract
Markdown: agent name and mission, lifecycle state table, tool table (name /
scope / approval-gated), loop budget, approval gate placement, and the test list
that proves each of the above. Scope for this skill is `agent.spawn`.
""",
    ),
    SkillCatalogEntry(
        slug="agentic-workflows",
        name="agentic-workflows",
        description=(
            "Architecture patterns and operating standards for autonomous "
            "workflows: supervisor-worker delegation, peer verification, "
            "sub-goal decomposition, memory tiers and deterministic fallbacks."
        ),
        tags=["Agent", "Workflows"],
        version="1.8.0",
        author=CORE_AUTHOR,
        required_scope="agent.spawn",
        autonomy="approval_required",
        trust_class="core_trusted",
        triggers=["agentic workflow", "react loop", "subgoal decomposition"],
        self_check="numbered-operating-rules",
        markdown_doc="""# Agentic Workflows Standard

## Mission
Design multi-step autonomous work that degrades predictably: decomposed
sub-goals, bounded delegation, verified outputs, and a deterministic fallback
whenever a model or third-party API throttles or disappears.

## Operating Rules
1. **Supervisor-worker**: the orchestrator delegates bounded subtasks to
   specialised sub-agents and owns the final decision. A worker never
   self-authorises a scope it was not given.
2. **Consensus and peer review**: critical outputs are evaluated by an independent
   verifier before they are accepted. The verifier must not share the author's
   context.
3. **Deterministic fallbacks**: every external dependency has a defined degraded
   path. Graceful degradation is written down before it is needed.
4. **Decompose before you delegate**: a sub-goal without a defined completion
   condition cannot be verified and must not be spawned.
5. **Memory tiers**: working memory for the current run, session memory for the
   task, long-term memory only for facts worth paying to store. Promotion is
   explicit, never a side effect of reading.
6. **Budget every loop**: max iterations, max tool calls and max tokens are set
   before the first step, and exhaustion is a reportable outcome.

## Triggers
Use when the request contains agentic workflow, react loop, or subgoal
decomposition.

## Output Contract
Markdown: workflow graph in words, sub-goal table (goal / completion condition /
verifier / budget), fallback table (dependency / failure mode / degraded path),
and the memory tier map. Scope for this skill is `agent.spawn`.
""",
    ),
    SkillCatalogEntry(
        slug="autoplan",
        name="autoplan",
        description=(
            "Sequential auto-review pipeline that runs CEO, design, engineering "
            "and DX review over a plan and applies six explicit decision "
            "principles to resolve what it finds."
        ),
        tags=["Review", "Planning"],
        version="1.0.0",
        author=CORE_AUTHOR,
        # The TS data declared telemetry.read,prompts.write — neither exists.
        # The pipeline writes its report into the workspace; workspace.write is
        # the real scope for that.
        required_scope="workspace.write",
        autonomy="approval_required",
        # Imported review methodology.
        trust_class="community",
        triggers=["autoplan", "run all reviews", "automatic review pipeline"],
        self_check="scope-cited",
        markdown_doc="""# Autoplan — Auto-Review Pipeline

## Mission
Run CEO, design, engineering and DX review over a plan in that order, resolve
each finding using six fixed principles, and emit one reviewed plan. Auto-decide
only what a principle decides unambiguously; everything else is escalated.

## Operating Rules
1. **Choose completeness** — ship the whole thing. Cover the edge cases rather
   than deferring them.
2. **Boil lakes** — fix everything in the blast radius (<5 files, no new infra).
3. **Pragmatic** — if two options fix the same thing, take the cleaner one.
4. **DRY** — does it duplicate existing functionality? Reject.
5. **Explicit over clever** — a 10-line obvious fix beats a 200-line abstraction.
6. **Bias toward action** — merging beats review cycles beats stale deliberation.

Escalate rather than auto-decide when a finding touches scope, taste or an
irreversible side effect. The pipeline does not merge anything on its own.

## Triggers
Use when the request contains autoplan, run all reviews, or automatic review
pipeline.

## Output Contract
Markdown: per-review findings with the principle applied, a single escalated
decisions list, and the resulting plan diff. Scope for this skill is
`workspace.write`: the reviewed plan is written back to the workspace.
""",
    ),
    SkillCatalogEntry(
        slug="ats-resume-builder",
        name="ats-resume-builder",
        description=(
            "Parse a job description, identify hard-skill gaps, rewrite achievement "
            "bullets with the XYZ formula, and compile an ATS-clean resume that "
            "fits the page budget."
        ),
        tags=["Career", "Templates", "ATS"],
        version="2.0.0",
        author=CORE_AUTHOR,
        # The TS data declared resumes.write,document.compile. Neither exists;
        # the real scope for generating a compiled document artifact is
        # system.document.compile.
        required_scope="system.document.compile",
        autonomy="approval_required",
        trust_class="core_trusted",
        triggers=["build resume", "tailor resume", "ats match"],
        self_check="numbered-operating-rules",
        markdown_doc="""# ATS Resume Builder

## Mission
Produce a resume that survives an ATS parser and reads well to a human: every
hard requirement in the job description addressed, every bullet a concrete
achievement, and the document inside its page budget.

## Operating Rules
1. Ingest the master profile and the job description before writing anything.
2. Extract missing technical keywords and soft skills explicitly, and mark which
   the candidate can actually evidence. Never invent a claim.
3. Rewrite achievement bullets with the XYZ formula — *Accomplished [X] as
   measured by [Y] by doing [Z]*.
4. Render through the Jinja2 template plus Chromium page-fit loop, shrinking type
   until the document fits the page constraint rather than spilling a second page.
5. Report the ATS score and the remaining gap; a resume with unaddressed hard
   requirements says so on its face.
6. Keep formatting ATS-parseable: no text boxes, no headers/footers carrying
   contact details, standard section headings.

## Triggers
Use when the request contains build resume, tailor resume, or ats match.

## Output Contract
JSON `keywords_missing` with evidence status per keyword, the rewritten bullet
list, the ATS score with its component breakdown, and the rendered artifact
reference. Scope for this skill is `system.document.compile`.
""",
    ),
    SkillCatalogEntry(
        slug="check-work",
        name="check-work",
        description=(
            "Verification protocol for a change: inspect the diff, run the test "
            "suite, check type and lint diagnostics, and confirm no scratch "
            "artefacts survive."
        ),
        tags=["QA", "Verification"],
        version="1.1.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="autonomous",
        # Imported from an external knowledge base.
        trust_class="community",
        triggers=["check work", "verify changes", "self-verify"],
        self_check="scope-cited",
        markdown_doc="""# Check Work Verification Protocol

## Mission
Verify a change honestly before it is called done, and report what actually
happened — including failures. Never assert a check passed without having run it.

## Operating Rules
1. Review git status and the modified-file boundary. Anything outside the stated
   scope is itself a finding.
2. Run the test suites and record real pass/fail counts. "Tests look fine" is not
   a result; `127 passed, 3 failed` is.
3. Check type errors and lint diagnostics with the project's own commands.
4. Ensure no uncommitted scratch files, debug statements or stray logging remain.
5. Report each command you ran verbatim, with its exit status. An unrun check is
   reported as unrun, never as passed.
6. A failing verification is a blocking finding. Do not soften it into a note.

## Triggers
Use when the request contains check work, verify changes, or self-verify.

## Output Contract
Markdown: table of command / exit status / result, then findings ranked by
severity, then an explicit ship/no-ship verdict with its reason. Scope for this
skill is `memory.read`: verification reads the workspace and writes nothing.
""",
    ),
    SkillCatalogEntry(
        slug="deep-learning-rag-evals",
        name="deep-learning-rag-evals",
        description=(
            "Evaluate retrieval and generation: embedding quality, hybrid "
            "dense-sparse retrieval, cross-encoder reranking, and faithfulness / "
            "recall / relevance metrics."
        ),
        tags=["AI", "RAG", "Evaluation"],
        version="1.4.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="autonomous",
        trust_class="core_trusted",
        triggers=["eval rag", "rag metrics", "retrieval benchmark"],
        self_check="scope-cited",
        markdown_doc="""# RAG Evaluation Framework

## Mission
Measure whether a retrieval-augmented pipeline actually works, and attribute any
quality loss to a specific stage (retrieval, rerank, or generation) rather than
to "the LLM".

## Operating Rules
1. **Faithfulness**: the proportion of claims in the generated answer that are
   directly groundable in the retrieved contexts. Unsupported claims are the
   defect this metric exists to catch.
2. **Answer relevance**: semantic similarity of the response to the user's
   intent, not to the query string.
3. **Context recall**: the ratio of ground-truth relevant facts the retriever
   actually returned. Low recall with high faithfulness means a retrieval bug,
   not a generation bug.
4. Attribute the loss: report retrieval, rerank and generation scores separately.
   A single blended number hides the stage that needs work.
5. Keep the evaluation set fixed and versioned. Changing the set and the score in
   the same run is not a result.
6. Report the sample size with every metric. A score over ten queries is a
   anecdote.

## Triggers
Use when the request contains eval rag, rag metrics, or retrieval benchmark.

## Output Contract
JSON: metric name, value, sample size, per-stage breakdown, and the single stage
the evidence implicates. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="frontend-design",
        name="frontend-design",
        description=(
            "Visual design direction for Vaeloom surfaces: intentional typography "
            "and spacing hierarchy, domain-specific art direction, and theme token "
            "consistency instead of generic defaults."
        ),
        tags=["Design", "UI-UX"],
        version="2.2.0",
        author=CORE_AUTHOR,
        required_scope="workspace.write",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["frontend design", "polish ui", "design system"],
        self_check="numbered-operating-rules",
        markdown_doc="""# Frontend Design Standard

## Mission
Give a Vaeloom surface deliberate visual direction — grounded in the product's
own domain rather than in generic dashboard defaults — and keep it consistent
with the theme tokens.

## Operating Rules
1. **Ground it in the subject**: design for this product domain. A generic admin
   template is a failure even when it renders correctly.
2. **Structure is information**: dividers, labels, badges and counters encode
   meaning. Decoration that encodes nothing is removed.
3. **Restraint and self-critique**: spend the boldness in one place and keep the
   surroundings disciplined.
4. **Typography**: intentional weight scales, tabular numbers wherever figures
   change, and a readable line measure. No accidental default type.
5. **Tokens only**: colour, spacing and radius come from the theme tokens. A
   hard-coded hex value is a review finding.
6. Dark mode is not an inversion pass; both themes get their own contrast check.

## Triggers
Use when the request contains frontend design, polish ui, or design system.

## Output Contract
Markdown: type scale with token names, spacing rhythm, the token references used,
and one annotated description of where the single deliberate emphasis lands.
Scope for this skill is `workspace.write`.
""",
    ),
    SkillCatalogEntry(
        slug="llm-engineering",
        name="llm-engineering",
        description=(
            "Production LLM engineering: schema-enforced structured output, "
            "multi-tier model routing with fallback, deterministic few-shot "
            "anchors, and explicit token budgeting."
        ),
        tags=["AI", "Prompts"],
        version="2.5.0",
        author=CORE_AUTHOR,
        # The TS data declared prompts.write, which does not exist. Curated
        # prompts are workspace content; memory.write is the real scope.
        required_scope="memory.write",
        autonomy="approval_required",
        trust_class="core_trusted",
        triggers=["prompt engineering", "structured outputs", "token budget"],
        self_check="numbered-operating-rules",
        markdown_doc="""# LLM Engineering Best Practices

## Mission
Make model behaviour predictable and cheap: every structured output validated
against a schema, every call budgeted, and every failure path defined.

## Operating Rules
1. Constrain every tool call with a strict Pydantic schema. Parse into the model,
   not into a dict you hope is right.
2. Multi-tier fallback: fast lightweight model first, escalate to the high
   reasoning model on validation failure. Cap the escalation at one retry.
3. Deterministic few-shot anchors: fixed exemplars, fixed order, so schema
   synthesis is reproducible across runs.
4. Budget tokens before the call. Long-context is not free; retrieve, do not dump.
5. A validation failure is data: record it, and never retry the identical prompt
   unchanged.
6. Cache what is deterministic. Prompt caching is keyed on the stable prefix,
   never on per-request data.

## Triggers
Use when the request contains prompt engineering, structured outputs, or token
budget.

## Output Contract
Markdown: the schema with its enums and required fields, the routing table
(tier / trigger / cost), the token budget per call site, and the retry policy.
Scope for this skill is `memory.write`.
""",
    ),
    SkillCatalogEntry(
        slug="system-design",
        name="system-design",
        description=(
            "Enterprise distributed-systems review: multi-tenant isolation, "
            "durable asynchronous workflows, caching topologies, and disaster "
            "recovery with stated RTO and RPO."
        ),
        tags=["Infra", "Distributed"],
        version="1.3.0",
        author=CORE_AUTHOR,
        # The TS data declared system.observe, which does not exist in the tool
        # registry. Reading connected infrastructure is connector.read.
        required_scope="connector.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["system design", "architecture review", "dr drill"],
        self_check="numbered-operating-rules",
        markdown_doc="""# Enterprise System Design

## Mission
Review or design a multi-tenant system against the properties that actually
cause outages: isolation, durability, degradation and recovery.

## Operating Rules
1. Multi-tenant isolation is enforced in the database, with row-level security
   and the session variables set on every connection. Application-layer checks
   alone are a second line of defence, never the first.
2. Asynchronous durable work goes through a durable workflow engine, not an
   in-process task. A restart must not lose a committed intent.
3. Zero-trust between services: short-lived scoped tokens, encrypted secrets, and
   no implicit trust from network position.
4. State the failure domain for every write: what happens when this node dies
   mid-transaction, and what the caller observes.
5. Disaster recovery needs a measured RTO and RPO and a drill that produced
   them. An unmeasured target is not a target.
6. Prefer the boring, reversible design. Record reversibility for every
   migration and every schema change.

## Triggers
Use when the request contains system design, architecture review, or dr drill.

## Output Contract
Markdown: component and trust-boundary table, isolation mechanism per data store,
durability path per write, degradation table (dependency / failure / behaviour),
and the measured RTO/RPO with the drill date. Scope for this skill is
`connector.read`.
""",
    ),
    SkillCatalogEntry(
        slug="ui-ux-pro-max",
        name="ui-ux-pro-max",
        description=(
            "Design-intelligence checklist for enterprise surfaces: WCAG AA "
            "accessibility, touch and interaction targets, spacing rhythm, and "
            "inline error recovery."
        ),
        tags=["Design", "Intelligence", "A11y"],
        version="3.0.0",
        author=CORE_AUTHOR,
        required_scope="system.browser.read",
        autonomy="suggest",
        # Imported design checklist.
        trust_class="community",
        triggers=["ui-ux-pro-max", "audit ux", "enterprise polish"],
        self_check="triggers-echoed",
        markdown_doc="""# UI/UX Pro Max Design Intelligence

## Mission
Apply a prioritised design checklist to a surface so the highest-impact
problems are fixed first: accessibility, then interaction cost, then rhythm,
then recovery.

## Operating Rules
1. **Accessibility first**: 4.5:1 contrast, alt text on meaningful images,
   visible focus rings, and a logical keyboard tab order.
2. **Touch and interaction**: minimum 44x44px targets and 150-300ms
   micro-interactions. Faster than 150ms reads as a glitch, slower than 300ms
   reads as lag.
3. **Typography and rhythm**: a 4/8dp incremental spacing grid, and tabular
   numbers wherever a figure updates in place.
4. **Error recovery**: immediate inline, contextual feedback that names the
   problem and links the remedy. Never a bare "something went wrong".
5. Fix in priority order. Do not spend the pass on colour while an
   untabbable control is still untabbable.
6. Every finding names the element and the remedy; "improve contrast" is not a
   finding.

## Triggers
Use when the request contains ui-ux-pro-max, audit ux, or enterprise polish.

## Output Contract
Markdown: findings grouped by the four priorities, each with element, current
state, target state, and the WCAG criterion where one applies. Scope for this
skill is `system.browser.read`.
""",
    ),
)

CATALOG_BY_SLUG: dict[str, SkillCatalogEntry] = {e.slug: e for e in SKILL_CATALOG}
CATALOG_BY_NAME: dict[str, SkillCatalogEntry] = {e.name: e for e in SKILL_CATALOG}


def list_catalog(category: str | None = None) -> list[SkillCatalogEntry]:
    if category and category.strip().lower() not in ("skill", "skills", ""):
        return []
    return list(SKILL_CATALOG)


def get_catalog_entry(slug: str) -> SkillCatalogEntry | None:
    key = (slug or "").strip()
    return CATALOG_BY_SLUG.get(key) or CATALOG_BY_NAME.get(key)


def is_bundled_skill(name: str) -> bool:
    return (name or "").strip() in CATALOG_BY_NAME


# ── Validation ───────────────────────────────────────────────────────────


def _section_titles(markdown: str) -> list[tuple[str, int]]:
    found: list[tuple[str, int]] = []
    for idx, line in enumerate(markdown.splitlines(), start=1):
        m = _SECTION_RE.match(line)
        if m:
            found.append((m.group("title").strip().lower(), idx))
    return found


def _has_section(markdown: str, wanted: str) -> int | None:
    for title, line_no in _section_titles(markdown):
        if title == wanted or title.startswith(wanted):
            return line_no
    return None


def _placeholder_violations(markdown: str) -> list[SkillViolation]:
    hits: list[SkillViolation] = []
    for line_no, line in enumerate(markdown.splitlines(), start=1):
        for label, pattern in _PLACEHOLDER_PATTERNS:
            if pattern.search(line):
                hits.append(
                    SkillViolation(
                        rule="SKILL-PLACEHOLDER",
                        message=f"Unresolved placeholder {label} on line {line_no}",
                        line=line_no,
                        severity="hard",
                    )
                )
    return hits


def _count_numbered_rules(markdown: str) -> int:
    lines = markdown.splitlines()
    start = None
    for idx, line in enumerate(lines):
        if _SECTION_RE.match(line) and _SECTION_RE.match(line).group("title").strip().lower().startswith(
            "operating rules"
        ):
            start = idx + 1
            break
    if start is None:
        return 0
    count = 0
    for line in lines[start:]:
        if _SECTION_RE.match(line):
            break
        if _NUMBERED_RE.match(line):
            count += 1
    return count


SHARED_RULE_IDS: tuple[str, ...] = (
    "SKILL-DOC-PRESENT",
    "SKILL-DOC-MISSION",
    "SKILL-DOC-OPERATING-RULES",
    "SKILL-DOC-TRIGGERS",
    "SKILL-DOC-OUTPUT-CONTRACT",
    "SKILL-TAGS-PRESENT",
    "SKILL-SCOPE-VOCABULARY",
    "SKILL-PLACEHOLDER",
)


def validate_skill_document(
    *,
    markdown_doc: str,
    required_scope: str,
    tags: list[str] | None,
    entry: SkillCatalogEntry | None = None,
    triggers: list[str] | None = None,
) -> SkillValidationResult:
    """Validate a skill document against the rules Vaeloom actually enforces.

    ``status`` is ``error`` when any hard rule fails, ``warning`` when only soft
    rules fail, and ``success`` only when there are no violations at all.
    ``rules_checked`` counts the rules evaluated, including the catalog
    self-check when ``entry`` is supplied.
    """
    vocab = tool_scope_vocabulary()
    violations: list[SkillViolation] = []
    doc = markdown_doc or ""

    if not doc.strip():
        violations.append(
            SkillViolation(
                rule="SKILL-DOC-PRESENT",
                message="Skill has no markdown instruction document",
                line=None,
                severity="hard",
            )
        )
    if _has_section(doc, "mission") is None:
        violations.append(
            SkillViolation(
                rule="SKILL-DOC-MISSION",
                message="Skill document has no '## Mission' section",
                line=None,
                severity="hard",
            )
        )
    if _has_section(doc, "operating rules") is None:
        violations.append(
            SkillViolation(
                rule="SKILL-DOC-OPERATING-RULES",
                message="Skill document has no '## Operating Rules' section",
                line=None,
                severity="hard",
            )
        )
    if _has_section(doc, "triggers") is None:
        violations.append(
            SkillViolation(
                rule="SKILL-DOC-TRIGGERS",
                message="Skill document has no '## Triggers' section",
                line=None,
                severity="soft",
            )
        )
    if _has_section(doc, "output contract") is None:
        violations.append(
            SkillViolation(
                rule="SKILL-DOC-OUTPUT-CONTRACT",
                message="Skill document has no '## Output Contract' section",
                line=None,
                severity="soft",
            )
        )
    if not tags:
        violations.append(
            SkillViolation(
                rule="SKILL-TAGS-PRESENT",
                message="Skill has no tags; it cannot be discovered or filtered",
                line=None,
                severity="hard",
            )
        )
    if required_scope not in vocab:
        violations.append(
            SkillViolation(
                rule="SKILL-SCOPE-VOCABULARY",
                message=(
                    f"required_scope '{required_scope}' is not in the tool scope "
                    f"vocabulary ({len(vocab)} scopes registered)"
                ),
                line=None,
                severity="hard",
            )
        )
    violations.extend(_placeholder_violations(doc))

    rules_checked = len(SHARED_RULE_IDS)

    if entry is not None:
        rules_checked += 1
        violations.extend(_self_check_violations(entry, doc, triggers))

    if not violations:
        status: Literal["success", "warning", "error"] = "success"
    elif any(v.severity == "hard" for v in violations):
        status = "error"
    else:
        status = "warning"

    return SkillValidationResult(
        status=status,
        rules_checked=rules_checked,
        violations=violations,
        from_catalog=entry is not None,
        detail=_result_detail(status, violations),
    )


def _self_check_violations(
    entry: SkillCatalogEntry, doc: str, triggers: list[str] | None
) -> list[SkillViolation]:
    check = entry.self_check
    if check not in SELF_CHECKS:
        return [
            SkillViolation(
                rule="SKILL-CATALOG-SELFCHECK",
                message=f"Catalog entry declares unknown self-check '{check}'",
                line=None,
                severity="hard",
            )
        ]

    if check == "numbered-operating-rules":
        count = _count_numbered_rules(doc)
        if count < 3:
            return [
                SkillViolation(
                    rule="SKILL-CATALOG-SELFCHECK",
                    message=(
                        "Catalog self-check 'numbered-operating-rules' failed: "
                        f"Operating Rules declares {count} numbered rules, needs 3"
                    ),
                    line=None,
                    severity="soft",
                )
            ]
        return []

    if check == "triggers-echoed":
        lowered = doc.lower()
        missing = [t for t in (triggers if triggers is not None else entry.triggers) if t.lower() not in lowered]
        if missing:
            return [
                SkillViolation(
                    rule="SKILL-CATALOG-SELFCHECK",
                    message=(
                        "Catalog self-check 'triggers-echoed' failed: trigger "
                        f"phrases missing from the document: {missing}"
                    ),
                    line=None,
                    severity="soft",
                )
            ]
        return []

    # scope-cited
    if entry.required_scope not in doc:
        return [
            SkillViolation(
                rule="SKILL-CATALOG-SELFCHECK",
                message=(
                    "Catalog self-check 'scope-cited' failed: document does not "
                    f"cite its required scope '{entry.required_scope}'"
                ),
                line=None,
                severity="soft",
            )
        ]
    return []


def _result_detail(
    status: str, violations: list[SkillViolation]
) -> str:
    if not violations:
        return "All skill document rules passed."
    hard = sum(1 for v in violations if v.severity == "hard")
    soft = len(violations) - hard
    return f"{hard} hard and {soft} soft rule violation(s); nothing was executed."


def catalog_to_wire(entry: SkillCatalogEntry) -> dict[str, Any]:
    """snake_case wire shape, matching the rest of the API."""
    return {
        "slug": entry.slug,
        "name": entry.name,
        "description": entry.description,
        "tags": list(entry.tags),
        "version": entry.version,
        "author": entry.author,
        "required_scope": entry.required_scope,
        "autonomy": entry.autonomy,
        "trust_class": entry.trust_class,
        "triggers": list(entry.triggers),
        "markdown_doc": entry.markdown_doc,
        "bundled": entry.bundled,
        "self_check": entry.self_check,
    }
