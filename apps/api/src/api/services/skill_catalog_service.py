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

# Tier 3: External Skills Quarantine / Purge Policy
# External bioinformatics, genomics, and unrelated science plugins that are
# permanently excluded from Vaeloom's career intelligence workspace ingestion.
PROHIBITED_EXTERNAL_DOMAINS: frozenset[str] = frozenset(
    {
        "alphafold",
        "alphafold_database_fetch_and_analyze",
        "alphagenome",
        "alphagenome_variant_impact_score",
        "chembl",
        "chembl_database",
        "clinical_trials",
        "clinical_trials_database",
        "clinvar",
        "clinvar_database",
        "dbsnp",
        "dbsnp_database",
        "embl_ebi_ols",
        "encode_ccres",
        "encode_ccres_database",
        "ensembl",
        "ensembl_database",
        "foldseek",
        "foldseek_structural_search",
        "gnomad",
        "gnomad_database",
        "gtex",
        "gtex_database",
        "human_protein_atlas",
        "human_protein_atlas_database",
        "interpro",
        "interpro_database",
        "jaspar",
        "jaspar_database",
        "ncbi_sequence_fetch",
        "openfda",
        "openfda_database",
        "opentargets",
        "opentargets_database",
        "pdb",
        "pdb_database",
        "predictingthepast",
        "protein_sequence_msa",
        "protein_sequence_similarity_search",
        "pubchem",
        "pubchem_database",
        "pubmed",
        "pubmed_database",
        "pymol",
        "quickgo",
        "quickgo_database",
        "reactome",
        "reactome_database",
        "string_database",
        "ucsc_conservation_and_tfbs",
        "unibind",
        "unibind_database",
        "uniprot",
        "uniprot_database",
    }
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
        tags=["Career", "Templates", "ATS", "Resume"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="system.document.compile",
        autonomy="approval_required",
        trust_class="core_trusted",
        triggers=["build resume", "tailor resume", "ats match", "ats resume builder", "format resume", "compile resume",
                  # Restored from the full reference. Without these two, a user
                  # asking to "build ats resume" or for a "single column resume"
                  # activated nothing: the condensed directive is what the
                  # matcher ever sees. Checked by
                  # vaeloom-skills/scripts/check_catalog_fidelity.py.
                  "build ats resume", "single column resume"],
        self_check="numbered-operating-rules",
        markdown_doc="""# ATS Resume Builder & Single-Column Architecture Playbook

## Mission
Compile clean, elegant, parser-bulletproof resumes that guarantee 100% extraction fidelity across enterprise Applicant Tracking Systems (Workday, Taleo, Greenhouse, Lever, iCIMS, Ashby). Enforce single-column visual hierarchy, typographic best practices, and deterministic section ordering that eliminates layout corruption while presenting an executive aesthetic to human reviewers.

## Operating Rules
1. Single-Column Architectural Invariant: Never emit multi-column layouts, sidebars, floating text boxes, graphic dividers, or embedded HTML/Word tables. The visual flow must strictly follow top-to-bottom linear streaming.
2. Deterministic Section Ordering: Organize document sections in standard industry hierarchy: Header (Name, Contact Data), Professional Experience, Technical Skills, Education, and Certifications.
3. Typography & Metric Margins: Maintain 0.5 to 0.75-inch margins; use universal system fonts (Calibri, Arial, Georgia); strictly ban custom web fonts and vector icon glyphs.
4. Clean Plaintext Extraction Verification: The resulting document must yield 100% intelligible, correctly ordered plaintext when processed through pdftotext or clipboard copy-paste.
5. Standardized Header Tokenizer Labels: Use universal, unambiguous section titles (PROFESSIONAL EXPERIENCE, TECHNICAL SKILLS, EDUCATION).
6. Chronological Syntax Normalization: Enforce uniform date styling across all employment entries: Month YYYY – Month YYYY (e.g., Jan 2022 – Present or 03/2021 – 11/2023).
7. Bullet Point Density & Punctuation: Every bullet point must begin with an active power verb, contain 25 to 45 words, and end with consistent period punctuation.
8. Page-Fit Budgeting: Calibrate total content volume to exact page targets: Under 7 years of experience is strictly 1 page; 8+ years is strictly 2 full pages.

## Structural Blueprint
- Name & Contact Header (Single line, pipe or bullet separated).
- Professional Experience: Company, Role, Location, Right-aligned Dates, Bullet achievements.
- Technical Skills: Languages, Frameworks, Cloud & Infrastructure, Developer Tools & Databases.
- Education: Degree, Institution, Graduation Year.

## Triggers
Use when the request contains build resume, tailor resume, ats match, ats resume builder, format resume, or compile resume.

## Output Contract
Produce a compiled, verified ATS document package with single-column markdown, extraction fidelity verification, and page-budget adherence. Scope for this skill is `system.document.compile`.
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
    SkillCatalogEntry(
        slug="career-coaching",
        name="career-coaching",
        description=(
            "Strategic career pathing, promotion readiness evaluation, skill gap "
            "identification, and executive interview preparation for students and engineering professionals."
        ),
        tags=["Career", "Coaching", "Strategy", "Mentorship"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["career coaching", "career advice", "promotion readiness", "career path", "skill gap analysis", "staff engineer path"],
        self_check="numbered-operating-rules",
        markdown_doc="""# Strategic Career Coaching & Engineering Leveling Playbook

## Mission
Guide software engineers, technical leads, and students through strategic career acceleration, level progression (L4 Mid -> L5 Senior -> L6 Staff+), and promotion dossier engineering. Provide diagnostic, evidence-grounded career blueprints that bridge technical skill gaps, amplify organizational agency, and build durable executive presence.

## Operating Rules
1. Dual-Track Calibration: Explicitly distinguish between Individual Contributor (IC) and Engineering Management (EM) paths.
2. Three-Horizon Strategic Mapping: Frame candidate development across three operational horizons: Horizon 1 (30-90 Days immediate execution), Horizon 2 (6-12 Months cross-team influence), Horizon 3 (1-3 Years organizational strategy).
3. Four-Pillar Diagnostic Gap Audit: Audit readiness across Technical Mastery, Operational Rigor, Organizational Agency, and Business Acumen.
4. Promotion Dossier Mandate: Prevent the Invisible Work Trap by establishing a continuous brag document tracking shipped projects, design docs, fires triaged, and mentees guided.
5. Radical Candor & Gap Sourcing: Reject empty motivational platitudes; provide direct, actionable diagnoses of what is holding the candidate back from the next level band.
6. Student & Transition Guidance: Emphasize demonstrable proof-of-work (open-source contributions, deployed systems) over passive tutorial certificates.
7. Burnout & Boundary Protection: Advocate for sustainable delivery velocity over unsustainable heroism that masks organizational dysfunction.
8. Actionable Milestone Roadmaps: Conclude every coaching session with 3 concrete, time-boxed milestones for the upcoming quarter.

## Triggers
Use when the request contains career coaching, career advice, promotion readiness, skill gap analysis, staff engineer path, or career path.

## Output Contract
Produce a structured career roadmap with level diagnostic, four-pillar gap analysis, 90-day phased action plan, and promotion dossier template. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="ats-audit",
        name="ats-audit",
        description=(
            "Comprehensive ATS parseability, typography, and keyword density audit across "
            "Workday, Greenhouse, Lever, Taleo, and Ashby parsers."
        ),
        tags=["Career", "ATS", "Audit", "Compliance"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="system.document.compile",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["ats audit", "ats scan", "parse test", "resume parser check", "audit resume formatting"],
        self_check="triggers-echoed",
        markdown_doc="""# ATS Formatting & Parseability Audit Playbook

## Mission
Deliver rigorous, parser-accurate diagnostic audits of candidate resumes against the technical ingestion engines of enterprise Applicant Tracking Systems (Workday/Sovren, Greenhouse, Lever, Taleo, iCIMS, and Ashby). Eliminate silent parsing failures, layout traps, and entity extraction corruption before human recruiters ever review the application.

## Operating Rules
1. Parser Engine Parity: Never evaluate a resume purely as a visual artifact; always simulate linear text stream extraction (pdftotext, Apache PDFBox, Daxtra, and Sovren OCR tokenizers).
2. Column & Table Prohibition: Flag any multi-column layout, sidebar, embedded table, or text box as a critical parsing hazard that causes interleaved reading-order corruption in legacy ATS engines.
3. Contact Header Integrity: Verify that email, phone number, LinkedIn URL, GitHub profile, and geographic location are located in the main document body, not hidden inside PDF header/footer metadata zones.
4. Section Ontology Compliance: Enforce standard industry header labels (Work Experience, Professional Experience, Education, Technical Skills, Certifications). Flag creative synonyms.
5. Date Normalization Standards: Audit all date ranges for unambiguous chronological syntax (MM/YYYY - MM/YYYY or Month YYYY - Present). Flag missing months or ambiguous year-only dates.
6. Glyph & Ligature Sanitization: Identify non-standard bullet characters, decorative icon fonts, and complex ligatures (fi, fl) that translate into corrupted unicode.
7. Semantic Keyword Density: Compare extracted hard skills against target Job Description requirements using cosine similarity thresholds and exact token matching.
8. Deterministic 100-Point Scoring: Produce an objective Parseability Index broken into Parse Stream Integrity (30 pts), Section Classification (25 pts), Entity Extraction (25 pts), and Chronology Consistency (20 pts).

## Triggers
Use when requests contain: ats audit, ats scan, parse test, resume parser check, or audit resume formatting.

## Output Contract
Produce a structured markdown audit report containing Executive Summary & Parseability Score (0-100), Critical Parsing Hazards, Entity Extraction Report, Section Breakdown, and Remediation Plan. Scope for this skill is `system.document.compile`.
""",
    ),
    SkillCatalogEntry(
        slug="resume-optimization",
        name="resume-optimization",
        description=(
            "Precision resume bullet rewriting, action verb hardening, metric quantification, "
            "and recruiter readability scoring using the Google XYZ formula."
        ),
        tags=["Career", "Resume", "Optimization", "Google XYZ"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["resume optimization", "bullet rewrite", "xyz formula", "improve resume bullets", "quantify achievements"],
        self_check="numbered-operating-rules",
        markdown_doc="""# Resume Bullet Optimization & Google XYZ Playbook

## Mission
Transform weak, passive, duty-focused job descriptions into compelling, metric-driven achievement statements using the Google XYZ formula ("Accomplished [X] as measured by [Y], by doing [Z]") and the Harvard OCS action verb framework. Maximize recruiter conversion and hiring manager engagement while preserving absolute factual integrity without fabricating ungrounded claims.

## Operating Rules
1. Google XYZ Syntactic Mandate: Every bullet point must adhere to the structural pattern: "Accomplished [X] as measured by [Y], by doing [Z]" or active front-loaded variations.
2. Elimination of Passive Responsibility Phrasing: Strictly ban phrases like "Responsible for", "Assisted with", "Worked on", "Tasked with", "Helped team". Replace them with high-agency Tier-1 power verbs.
3. Metric Grounding & Non-Fabrication: Never invent numerical metrics, revenue figures, percentage improvements, or dollar amounts that the user has not confirmed. When a metric is missing, generate targeted discovery prompts.
4. Context-Action-Result Balance: Ensure each bullet concisely delivers all three components: the business context or problem, the technical/operational action taken by the candidate, and the measurable business outcome.
5. Technical Specificity & Toolchain Context: Embed concrete technical tools, frameworks, languages, and architecture paradigms directly into the execution clause [Z].
6. Brevity & Visual Density: Constrain bullet length to 1 to 2 lines (maximum 35-45 words per bullet). Eliminate filler adjectives.
7. Scope & Seniority Calibration: Calibrate bullet complexity to target seniority level (L3-L4 tactical vs L5-L7 architectural and organizational force multiplication).
8. Recruiter Readability Scoring: Assess each bullet on a 5-dimension rubric (Agency, Metric Rigor, Technical Depth, Brevity, Scope). Produce a quantifiable improvement delta.

## Triggers
Use when requests contain: resume optimization, bullet rewrite, xyz formula, improve resume bullets, or quantify achievements.

## Output Contract
Produce a structured markdown transformation package with Bullet-by-Bullet Comparison Table, Metric Discovery Open Questions, Power Verb Diversity Audit, and Recruiter Readability Scorecard. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="job-discovery-radar",
        name="job-discovery-radar",
        description=(
            "Autonomous job discovery, verified career portal monitoring, company hiring "
            "intelligence extraction, and live posting validation with SSRF protection."
        ),
        tags=["Career", "Job Search", "Radar", "Automation"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="system.browser.read",
        autonomy="autonomous",
        trust_class="core_trusted",
        triggers=["job discovery radar", "job search", "find jobs", "career radar", "scrape job posting"],
        self_check="scope-cited",
        markdown_doc="""# Autonomous Job Discovery Radar & Hiring Intelligence Playbook

## Mission
Autonomously discover, verify, and filter unindexed and high-signal engineering job openings across premier applicant tracking endpoints (Greenhouse, Lever, Ashby, Workday). Shield candidates from stale listings, ghost jobs, and staffing agency traps while extracting high-leverage company intelligence, tech stack requirements, and compensation bands.

## Operating Rules
1. SSRF Guard & Domain Allowlist: Strictly validate every job URL before fetching via browser or HTTP connectors. Enforce HTTPS, resolve DNS to verify non-private/non-loopback IP ranges, and block untrusted redirects.
2. First-Party Career Board Prioritization: Prioritize direct enterprise ATS career portals (Greenhouse, Lever, Ashby, Workday, direct careers domains) over third-party scrapers or aggregators.
3. Ghost Job & Stale Listing Elimination: Reject and filter out listings posted or refreshed > 60 days ago or third-party recruitment agency camouflage.
4. Structured Intelligence Extraction: For every verified opportunity, extract Company Name & Stage, Exact Title & Level, Location Policy, Compensation Range, Primary Tech Stack, and Core Initiatives.
5. Team Velocity & Funding Signal Correlation: Correlate open job postings with recent funding announcements, engineering blog posts, and team growth momentum.
6. Rate-Limit & Scraping Etiquette: Respect site concurrency boundaries, enforce backoff on HTTP 429 errors, and adhere to workspace quotas.
7. Semantic Fit Scoring: Compare extracted role responsibilities against candidate experience stored in workspace memory, computing a deterministic Match Index.
8. Link Verification Invariant: Test live HTTP responsiveness (200 OK) and ensure application forms are active before queueing.

## Triggers
Use when requests contain: job discovery radar, job search, find jobs, career radar, or scrape job posting.

## Output Contract
Produce a structured markdown opportunity dossier with Curated Job Queue Table, Deep-Dive Opportunity Cards, Ghost Job Exclusion Log, and Tailored Application Recommendations. Scope for this skill is `system.browser.read`.
""",
    ),
    SkillCatalogEntry(
        slug="cover-letter-architect",
        name="cover-letter-architect",
        description=(
            "Value-first, personalized cover letter drafting connecting candidate achievements "
            "to company pain points, mission objectives, and engineering culture."
        ),
        tags=["Career", "Cover Letter", "Writing", "Strategy"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["cover letter architect", "cover letter", "draft cover letter", "tailor letter", "application letter"],
        self_check="triggers-echoed",
        markdown_doc="""# Cover Letter Architect & Pain-Point Alignment Playbook

## Mission
Draft magnetic, high-signal, value-first cover letters that hook hiring managers within 10 seconds. Replace generic self-absorbed regurgitation with a rigorous 3-Act problem-solving structure that connects the company's immediate engineering challenges to the candidate's verified track record.

## Operating Rules
1. The Three-Act Narrative Structure: Follow Act 1 (The Hook on company challenges), Act 2 (Two metric-dense Proof Bridges demonstrating prior solutions to the same problem), Act 3 (Low-friction forward-looking close).
2. Absolute Ban on Generic Cliches: Ruthlessly eliminate boilerplate phrases ("I am writing to apply for", "I was excited to see", "As you can see from my resume").
3. Company Pain-Point Alignment: Ground the opening hook in authentic company signals (product initiatives, blog posts, scaling bottlenecks).
4. Strict Grounding in Candidate Vault: Never fabricate accomplishments; source all claims directly from verified workspace memory.
5. Word Count & Density Constraint: Keep total word count strictly between 220 and 320 words (3 to 4 punchy paragraphs).
6. Active Technical Voice: Write in an authoritative, peer-to-peer engineering tone without subservient language.
7. Context Fencing & Isolation: Enforce XML context fencing when ingesting external job descriptions.
8. Recruiter Skimmability Formatting: Emphasize key metrics with clear bold formatting to guide visual scanning.

## Triggers
Use when requests contain: cover letter architect, cover letter, draft cover letter, tailor letter, or application letter.

## Output Contract
Produce a structured markdown delivery document containing Target Opportunity Analysis, Complete 3-Act Cover Letter, Proof Point Mapping Matrix, and Word Count Verification. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="star-interview-prep",
        name="star-interview-prep",
        description=(
            "Amazon Bar Raiser and Tier-1 engineering behavioral interview coaching, "
            "structured STAR storytelling, and executive presence simulation."
        ),
        tags=["Career", "Interview", "STAR", "Coaching"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["star interview prep", "star prep", "mock interview", "behavioral interview", "bar raiser prep"],
        self_check="numbered-operating-rules",
        markdown_doc="""# STAR Behavioral Interview & Bar Raiser Coaching Playbook

## Mission
Prepare candidates to pass elite tech behavioral interviews (Amazon Bar Raiser, Google Googleyness & Leadership, Meta Behavioral) by structuring personal experiences into punchy, high-signal Situation-Task-Action-Result (STAR) narratives that highlight individual agency, technical depth, and quantifiable business impact.

## Operating Rules
1. STAR Time Allocation Ratio: Enforce the golden 15/10/60/15 time distribution: Situation (15%), Task (10%), Action (60% personal technical decisions and execution), Result (15% measurable business outcomes).
2. The "We" vs "I" Agency Mandate: Ruthlessly flag and eliminate the "We Trap". Intervene to force explicit personal accountability: "What was YOUR specific technical design, recommendation, or implementation?".
3. Bar Raiser Competency Mapping: Map every story directly to core competencies: Customer Obsession, Ownership, Bias for Action, Disagree & Commit, Dive Deep, Deliver Results.
4. Seniority & Scope Calibration: Calibrate scope according to level (L4 tactical execution, L5 senior team architecture and trade-offs, L6 cross-organizational strategy).
5. Trade-Off & Conflict Defense: Ensure every story explicitly includes a genuine trade-off and explains why alternative paths were rejected.
6. Failure & Learning Grounding: Enforce genuine technical/execution mistakes followed by systematic process remediation that prevented recurrence.
7. Metric-Backed Results: Mandate verified metrics in the Result phase (latency reduction, cost savings, customer adoption, incident MTTR drop).
8. Follow-Up Stress Test Probes: Generate 3 realistic counter-probes for every story simulating an aggressive Bar Raiser interviewer digging into edge cases.

## Triggers
Use when requests contain: star interview prep, star prep, mock interview, behavioral interview, or bar raiser prep.

## Output Contract
Produce a structured interview coaching plan featuring Target Competency Analysis, Four-Part STAR Script, Agency Verification Audit, Three Follow-up Probe Questions, and Readiness Score. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="salary-negotiation-playbook",
        name="salary-negotiation-playbook",
        description=(
            "Total compensation negotiation, counter-offer strategy, equity math valuation, "
            "and executive compensation scripts based on Patrick McKenzie and Haseeb Qureshi frameworks."
        ),
        tags=["Career", "Compensation", "Negotiation", "Strategy"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["salary negotiation playbook", "negotiate salary", "counter offer", "equity math", "compensation review"],
        self_check="scope-cited",
        markdown_doc="""# Salary Negotiation & Total Compensation Playbook

## Mission
Maximize candidate Total Compensation (TC) across base salary, equity, signing bonuses, and executive benefits using game-theoretic negotiation frameworks (Patrick McKenzie / Haseeb Qureshi). Eliminate unforced concessions, anchor bias traps, and equity valuation misunderstandings through data-grounded, collaborative scripts.

## Operating Rules
1. The Iron Law of Anchoring: Never reveal current compensation or state a specific number first during early recruitment stages. Deflect compensation queries until a formal offer is extended.
2. Total Compensation (TC) Holism: Always evaluate and negotiate the complete package: Base Salary + Annual Bonus + Equity Grant (amortized) + Signing Bonus.
3. BATNA Maximization: Establish and quantify the candidate's Best Alternative to a Negotiated Agreement (competing offers, retention path, or active interview pipelines).
4. Equity Valuation & Liquidity Diligence: Audit RSUs against 30-day VWAP; mandate startup disclosure of Fully Diluted Shares, 409A Valuation, Preferred Share Price, and Liquidation Preferences.
5. Enthusiasm-Anchored Countering: Every counter-offer must begin with genuine enthusiasm for the team and mission, framing the delta as market alignment enabling immediate acceptance.
6. Multi-Lever Trade-Off Strategy: If base salary is capped by bands, pivot negotiation to signing bonuses, equity refreshers, accelerated 6-month review cycles, or remote stipends.
7. Absolute Non-Ultimatum Principle: Never make artificial threats, deliver hostile ultimatums, or bluff nonexistent competing offers.
8. Writing-Only Closing Mandate: Never accept an offer orally on the phone; always request 24-48 hours to review documentation and submit counters in crisp written form.

## Triggers
Use when requests contain: salary negotiation playbook, negotiate salary, counter offer, equity math, or compensation review.

## Output Contract
Produce a structured negotiation strategy document with Current Package vs Target TC Matrix, Leverage Audit, Target Counter Numbers, Customized Written Scripts, and Contingency Decision Tree. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="linkedin-profile-optimizer",
        name="linkedin-profile-optimizer",
        description=(
            "Transform candidate LinkedIn profiles into high-ranking, recruiter-optimized landing pages "
            "with search-indexed headlines, engaging About sections, and metric-dense Experience entries."
        ),
        tags=["Career", "LinkedIn", "Profile", "Recruiter", "SEO"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["linkedin profile optimizer", "optimize linkedin", "linkedin headline", "linkedin about section", "recruiter search optimization"],
        self_check="triggers-echoed",
        markdown_doc="""# LinkedIn Profile Optimizer & Recruiter Discovery Playbook

## Mission
Transform candidate LinkedIn profiles into high-ranking, recruiter-optimized landing pages. Synthesizes search-indexed headlines, engaging 3-hook About sections, and metric-dense Experience entries grounded in the candidate's verified workspace memory vault, achieving maximum discovery across LinkedIn Recruiter searches while maintaining 100% truthful metrics.

## Operating Rules
1. Three-Part Searchable Headline Architecture: Format headlines using `[Target Title] | [2-3 Core High-Signal Keywords] | [Quantified Proof or Value Proposition]` within the 220-character limit.
2. The 3-Line Mobile Fold Hook: Craft the first 3 lines (210 desktop characters / 140 mobile characters) of the About section to provoke curiosity and compel readers to tap 'see more'.
3. Google XYZ & Metric Grounding: Format all Experience bullets using the XYZ framework (`Accomplished [X] as measured by [Y] by doing [Z]`), sourcing numbers directly from workspace memory (`memory.read`). Never fabricate metrics.
4. Strategic Recruiter Keyword Traversal: Map top recruiter search competencies into Skills and Experience sections naturally without keyword stuffing or deceptive spam.
5. First-Person Conversational Professional Voice: Write About sections in a polished, first-person narrative ('I build...', 'My focus is...') rather than third-person formality or AI tropes.
6. Zero AI Tells & Clean Typography: Ban generic AI buzzwords (`delve`, `leverage`, `testament to`, `in today's fast-paced world`), straighten curly quotes, and eliminate zero-width spaces.
7. Featured Section High-Impact Sequencing: Recommend portfolio order: 1) Flagship open-source or product build, 2) Technical deep dive or article, 3) High-signal award or credential.
8. Strict Scope Discipline: Operates under authorized tool scope `memory.read` to read candidate profile and career receipts without unapproved writes.

## Triggers
Use when requests contain: linkedin profile optimizer, optimize linkedin, linkedin headline, linkedin about section, or recruiter search optimization.

## Output Contract
Produces an end-to-end LinkedIn profile optimization blueprint containing: 1) 3 Headline Options (with character count and keyword density check), 2) Complete 3-Part About Section, 3) Experience Section Bullet Refinements, 4) Top 5 Recruiter Skills to Pin, 5) Profile Completeness & Rubric Scorecard (0-100). Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="linkedin-interviewer",
        name="linkedin-interviewer",
        description=(
            "Interview candidate to capture verified career receipts, turning points, "
            "failure scars, and defended contrarian positions into a permanent Story Bank."
        ),
        tags=["Career", "LinkedIn", "Interview", "Story Bank", "Branding"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.write",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["linkedin interviewer", "interview me", "career interview", "story bank", "extract stories"],
        self_check="triggers-echoed",
        markdown_doc="""# LinkedIn Interviewer & Career Story Banker

## Mission
Conduct structured, empathetic diagnostic interviews with the candidate to extract concrete career evidence—scopes, verified metrics, turning points, failure scars, and defended contrarian convictions. Compiles the interview findings into a persistent, un-hallucinated Story Bank that powers all downstream resume bullets, LinkedIn posts, and cover letters.

## Operating Rules
1. Press Once, Never Interrogate: When the candidate provides a soft answer ('we improved performance'), press once for exact metrics, measurement duration, and tools used. Accept their answer and move on.
2. Zero Fabrication & No Plausible Inventions: Never invent figures or guess team sizes. If a candidate cannot recall an exact metric, leave the field empty or marked as approximate.
3. Chase the Turning Points & Scars: Specifically ask what the candidate believed 12-24 months ago that they no longer believe, and what failure or mistake taught them that lesson. Real scars provide 10x more trust than unearned wins.
4. Capture Defended Positions: Elicit convictions and architectural choices the candidate advocates for that peers or conventional wisdom disagree with.
5. Verbatim Phrasing Retention: Record the candidate's exact words and lively phrasing rather than flattening them into generic corporate jargon.
6. Honor Off-Limits Boundaries: Explicitly establish what metrics, client names, or proprietary technologies stay confidential and off-limits.
7. Strict Scope Discipline: Operates under authorized tool scope `memory.write` to persist verified stories into the candidate's workspace memory vault.

## Triggers
Use when requests contain: linkedin interviewer, interview me, career interview, story bank, or extract stories.

## Output Contract
Outputs a structured, markdown-formatted Story Bank adhering to the schema: 1) Roles & Scopes, 2) Receipts & Concrete Figures, 3) Turning Points & Scars, 4) Defended Positions, 5) Off-Limits Boundaries. Scope for this skill is `memory.write`.
""",
    ),
    SkillCatalogEntry(
        slug="linkedin-humanizer",
        name="linkedin-humanizer",
        description=(
            "Strip machine tells, invisible unicode smuggling characters, and AI tropes "
            "from drafts while strictly preserving authentic facts and numbers."
        ),
        tags=["Career", "LinkedIn", "Writing", "Quality", "Humanizer"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["linkedin humanizer", "humanize post", "strip ai tells", "remove slop", "humanize content"],
        self_check="triggers-echoed",
        markdown_doc="""# LinkedIn Content Humanizer & AI Tell Stripper

## Mission
Sanitize AI-generated drafts (resume bullets, LinkedIn posts, About sections, and cover letters) by eliminating machine tells: zero-width unicode format characters, typographic AI fingerprints (excessive em dashes, curly quotes), and overused AI buzzwords (`delve`, `leverage`, `seamless`, `testament to`). Replaces cliches with concrete, natural phrasing while strictly preserving the candidate's authentic numbers, metrics, and dates.

## Operating Rules
1. Never Drop Concrete Numbers: The humanizer must preserve 100% of the candidate's authentic metrics, percentages, dollar figures, and dates. Any edit that drops or alters a number is strictly rejected.
2. Invisible Character Elimination: Automatically detect and strip zero-width spaces (`U+200B`), zero-width joiners, byte-order marks (`U+FEFF`), and Unicode tag smuggling characters that survive copy-paste.
3. Typographic Normalization: Replace machine-generated em dashes with commas or hyphens, straighten curly quotes, and replace ellipses with standard periods.
4. Lexical Slop Replacement: Replace canonical AI buzzwords (`delve into` -> `look at`, `leverage` -> `use`, `seamless` -> `clean`, `in today's fast-paced world` -> `right now`) while maintaining grammatical integrity.
5. Preserve URLs & Code Verbatim: Protect all URLs, email addresses, and technical code identifiers from regex modifications.
6. Flag Structural Tells: Flag rhetorical reveals ('The kicker?', 'Let that sink in'), rule-of-three triads, and hashtag walls for human revision rather than mangling sentence structure.
7. Strict Scope Discipline: Operates under authorized tool scope `memory.read` without fabricating new facts or claims.

## Triggers
Use when requests contain: linkedin humanizer, humanize post, strip ai tells, remove slop, or humanize content.

## Output Contract
Outputs: 1) Cleaned Draft with all invisible chars and slop removed, 2) Audit Report detailing changes made, 3) 5-Check Score across Burstiness, Specificity, Slop Density, Fingerprint, and Voice (0-100 scale). Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="linkedin-post-writer",
        name="linkedin-post-writer",
        description=(
            "Draft high-agency career and technical LinkedIn posts using 21 proven hook formulas "
            "with zero AI cliches, zero link leakage, and authentic engineering voice."
        ),
        tags=["Career", "LinkedIn", "Content", "Thought Leadership", "Writing"],
        version="2.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["linkedin post writer", "write linkedin post", "draft post", "linkedin thought leadership", "share technical win"],
        self_check="triggers-echoed",
        markdown_doc="""# LinkedIn Post Writer & Career Thought Leadership

## Mission
Draft authentic, high-dwell-time LinkedIn posts showcasing career milestones, technical systems, architecture decisions, and contrarian engineering convictions. Employs 21 battle-tested hook formulas to capture reader attention before the 210-character mobile fold while maintaining zero AI slop, zero fabricated numbers, and a human conversational voice.

## Operating Rules
1. The Fold is Everything: Line 1 and 2 must capture the reader's interest before LinkedIn's fold (210 chars on desktop, 140 chars on mobile). Never waste line 1 on pleasantries, setups, or greetings.
2. Numbers Beat Adjectives: Specific figures ($14,200, 31%, 47 minutes) must always replace vague qualifiers ('significant cost', 'massive growth', 'fast deployment').
3. One Idea Per Post: Focus strictly on one clear insight or lesson. If an idea requires multiple disparate pivots, split it into separate posts.
4. Zero AI Cliches: Never include prohibited tropes (`delve`, `leverage`, `testament to`, `in today's fast-paced world`, `game-changer`, rocket or fire emoji chains).
5. No External Links in Body: Keep external URLs out of the post body to protect algorithmic distribution; instruct links to be placed in the first comment or profile featured section.
6. Ground in Verified Experience: Pull real facts, roles, and lessons directly from the candidate's Story Bank or workspace memory vault (`memory.read`). Never fabricate metrics.
7. Strict Scope Discipline: Operates under authorized tool scope `memory.read` and generates candidate-approved copy ready for publication.

## Triggers
Use when requests contain: linkedin post writer, write linkedin post, draft post, linkedin thought leadership, or share technical win.

## Output Contract
Outputs: 1) Selected Hook Formula with ID and rationale, 2) Full Post Draft formatted with whitespace for mobile readability (900-1,300 chars), 3) First-Comment Call to Action with optional link or follow-up question. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="academic-cv-builder",
        name="academic-cv-builder",
        description="Format CVs for academic positions with publications, grants, and teaching.",
        tags=["Career", "Resume", "Academic", "CV", "Writing"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["academic cv builder", "academic cv", "curriculum vitae", "faculty application", "research cv", "postdoc cv"],
        self_check="triggers-echoed",
        markdown_doc="""# Academic CV Builder & Scholarly Dossier Architecture

## Mission
Structure, format, and curate comprehensive Curriculum Vitae (CV) documents for academic faculty, postdoc, and research fellow applications across research-intensive and teaching-focused institutions.

## Operating Rules
1. Comprehensive Chronological Record: Maintain an unabridged, exhaustive record of scholarship, teaching, grants, and academic service; do not artificially constrain CVs to industry 1-page limits.
2. Standardized Disciplinary Citation Format: Enforce consistent citation style (APA, IEEE, Chicago, or MLA) across all publications, separating peer-reviewed articles, books, chapters, and conference proceedings.
3. Author Order & Contribution Transparency: Bold candidate name across citations and explicitly denote corresponding author or equal contribution marks.
4. Grant & Award Precision: Include funding agency, award title, grant number, total monetary amount, funding period, and candidate investigator role (PI/co-PI).
5. Pedagogical & Course Scope Specificity: Detail course codes, titles, level (undergraduate/graduate), candidate role (instructor of record vs TA), and enrollment sizes.
6. Strict Grounding in Candidate Vault: Never invent citations, grants, or awards; ground all entries in verified workspace records (`memory.read`).

## Triggers
Use when requests contain: academic cv builder, academic cv, curriculum vitae, faculty application, research cv, postdoc cv.

## Output Contract
Markdown dossier containing: 1) Education, 2) Academic & Research Appointments, 3) Publications by Category, 4) Grants & Awards, 5) Teaching Experience, 6) Service & Professional Activities. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="application-form-filler",
        name="application-form-filler",
        description="Fill out job application form fields with context-aware, tailored answers drawn from the candidate's CV and the job description.",
        tags=["Career", "Job Search", "Applications", "Automation"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["application form filler", "fill application", "job application form", "apply to job", "form answers"],
        self_check="triggers-echoed",
        markdown_doc="""# Application Form Filler & Smart Questionnaire Response Engine

## Mission
Generate tailored, high-signal, and policy-compliant answers for job application form fields, custom screening questions, and ATS portal questionnaires by extracting verified facts from candidate workspace memory.

## Operating Rules
1. Exact Truthfulness & Zero Fabrication: Answer factual fields (work authorization, notice period, location preference, clearance) strictly from verified vault memory (`memory.read`). Never guess legal or immigration status.
2. Question-Specific Decomposition: Identify the exact core question being asked (behavioral, technical, motivation, situational) and address every sub-prompt directly.
3. Character & Word Count Enforcement: Adhere strictly to portal character limits (e.g., 150 words, 500 characters) with crisp, impactful prose without trailing ellipses.
4. Concrete Evidence in Screening Answers: Ground behavioral answers in STAR-method metrics rather than general platitudes.
5. Diversity & Demographic Sensitivity: For optional EEO/demographic disclosures, provide honest guidance or advise decline options per user preference.
6. Scope Discipline: Reads verified candidate history and profile details under authorized scope `memory.read`.

## Triggers
Use when requests contain: application form filler, fill application, job application form, apply to job, form answers.

## Output Contract
Structured mapping of form questions to candidate-tailored responses with character count, source memory citations, and explicit verification flags. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="career-changer-translator",
        name="career-changer-translator",
        description="Translate skills from one industry to another and identify transferable strengths without buzzwords.",
        tags=["Career", "Coaching", "Transition", "Strategy"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["career changer translator", "career pivot", "career transition", "transferable skills", "industry change"],
        self_check="triggers-echoed",
        markdown_doc="""# Career Changer Translator & Transferable Competency Mapper

## Mission
Deconstruct candidate experience across non-traditional or previous industries and map foundational competencies into the target industry's nomenclature, demonstrating immediate domain relevance and problem-solving capability.

## Operating Rules
1. Functional Abstraction Over Jargon: Strip source-industry specific jargon and restate accomplishments in terms of universal business drivers: revenue, latency, scale, compliance, risk, and team leadership.
2. Bridge Framing: Establish explicit bridges between prior discipline methods (e.g., clinical trials, military logistics, academic research) and target tech/business workflows (e.g., A/B testing, supply chain ops, data science).
3. Value-First Narrative: Position career change as a distinct competitive advantage (cross-functional insight, resilience, lateral thinking) rather than a deficit to excuse.
4. Preserved Historical Integrity: Never misrepresent past job titles or falsify duties; translate the impact and methodology while keeping verified titles (`memory.read`).
5. Target Skill Gap Transparency: Openly identify gaps requiring upskilling or certification rather than papering over missing hard requirements.
6. Scope Discipline: Operates under authorized tool scope `memory.read` without side effects.

## Triggers
Use when requests contain: career changer translator, career pivot, career transition, transferable skills, industry change.

## Output Contract
Markdown report featuring: 1) Competency Translation Matrix, 2) Reframed Professional Summary, 3) 4-6 Translated High-Impact Bullets, 4) Gap Analysis & Mitigation Recommendations. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="cold-email-writer",
        name="cold-email-writer",
        description="Write personalized cold outreach emails to hiring managers and founders — specific, human, not a pitch deck.",
        tags=["Career", "Outreach", "Networking", "Email", "Job Search"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["cold email writer", "cold email", "hiring manager outreach", "founder outreach", "networking email"],
        self_check="triggers-echoed",
        markdown_doc="""# Cold Email Writer & High-Conversion Outreach Architect

## Mission
Draft hyper-personalized, concise, and credible cold outreach emails to engineering leaders, hiring managers, and founders that generate high response rates without sounding like generic sales copy or desperate pitches.

## Operating Rules
1. Extreme Brevity: Keep the total email body strictly between 75 and 150 words. Respect the recipient's finite attention span.
2. Specific Observation Hook: Open with a hyper-specific observation regarding the recipient's recent engineering blog post, product launch, GitHub commit, or talk. No generic flattery.
3. Single High-Relevance Proof Point: Include exactly one verified metric or architectural outcome from candidate vault history (`memory.read`) directly addressing the team's public pain point.
4. Low-Friction Single Call-to-Action: Conclude with an effortless, low-commitment ask (e.g., 'Open to a 10-minute chat next Tuesday, or should I speak with someone else on your infra team?').
5. Clean Human Tone: Zero marketing buzzwords, zero formal Victorian correspondence cliches, zero automated template tells.
6. Scope Discipline: Operates under authorized scope `memory.read` for candidate achievements retrieval.

## Triggers
Use when requests contain: cold email writer, cold email, hiring manager outreach, founder outreach, networking email.

## Output Contract
Markdown email package containing: 1) 3 Subject Line Options (< 45 chars), 2) Email Body (< 150 words), 3) Follow-up Snippet (for Day 5 check-in). Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="creative-portfolio-resume",
        name="creative-portfolio-resume",
        description="Balance visual design with ATS compatibility for creative, UI/UX, and design roles.",
        tags=["Career", "Resume", "Portfolio", "Design", "Creative"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="system.document.compile",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["creative portfolio resume", "creative resume", "design resume", "ux resume", "portfolio resume"],
        self_check="triggers-echoed",
        markdown_doc="""# Creative Portfolio Resume & Dual-Format Design Architecture

## Mission
Create resumes for UI/UX designers, design engineers, creative directors, and product designers that strike the perfect balance between high-craft typographic elegance and strict machine-readable ATS compliance.

## Operating Rules
1. Dual-Track Parsing Compliance: Ensure all primary textual content exists in single-column semantic flow that ATS engines parse cleanly while maintaining refined typographic hierarchy.
2. Design Artifact & Case Study Linking: Integrate prominent, scannable links to live prototypes, design systems, Figma files, and case studies.
3. Design Systems & Tooling Granularity: Explicitly enumerate design tools, design systems (tokens, components), and prototyping frameworks alongside front-end engineering competencies.
4. Outcome-Driven Design Metrics: Pair visual and interaction design deliverables with measurable user/business metrics (conversion lift, usability score improvement, design debt reduction).
5. Strict Layout Safety: Avoid complex floating layers, non-standard glyph fonts, or image-only text that break ATS parsers.
6. Scope Discipline: Compiles production-ready documents under authorized scope `system.document.compile`.

## Triggers
Use when requests contain: creative portfolio resume, creative resume, design resume, ux resume, portfolio resume.

## Output Contract
Compiled resume specification ready for PDF rendering with complete typography tokens, portfolio links, and verified case studies. Scope for this skill is `system.document.compile`.
""",
    ),
    SkillCatalogEntry(
        slug="executive-resume-writer",
        name="executive-resume-writer",
        description="Create C-suite and VP level resumes emphasizing strategic leadership, P&L ownership, and board communication.",
        tags=["Career", "Resume", "Executive", "Leadership", "Strategy"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["executive resume writer", "executive resume", "vp resume", "c-suite resume", "director resume", "leadership resume"],
        self_check="triggers-echoed",
        markdown_doc="""# Executive Resume Writer & Strategic Leadership Dossier

## Mission
Synthesize executive careers (VP, SVP, C-Suite, GM, Managing Director) into authoritative executive resumes that communicate board-level governance, P&L ownership, organizational transformation, and enterprise shareholder value.

## Operating Rules
1. Enterprise Scale Primacy: Lead every role with the operating scale: P&L size ($M/$B), organizational headcount, global footprint, and reporting line to Board/CEO.
2. Strategic Transformation Narrative: Frame achievements in terms of enterprise value creation: market entry, turnaround, M&A integration, EBITDA growth, and digital transformation.
3. Executive Summary as Business Case: Open with an executive value proposition highlighting the candidate's core operating philosophy and strategic impact.
4. Board & Advisory Presence: Dedicate distinct positioning for board governance, committee leadership, and external industry advisory appointments.
5. High-Impact Scannable Typography: Enforce crisp executive formatting with strategic callout blocks for milestone acquisitions or exits.
6. Scope Discipline: Reads verified executive career history out of workspace memory under scope `memory.read`.

## Triggers
Use when requests contain: executive resume writer, executive resume, vp resume, c-suite resume, director resume, leadership resume.

## Output Contract
Comprehensive executive resume markdown containing Executive Summary, Board & Governance, Core Operating Competencies, Professional Experience with P&L scope, and Education/Credentials. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="job-description-analyzer",
        name="job-description-analyzer",
        description="Analyze job postings, calculate match scores, identify requirements gaps, and formulate application strategy.",
        tags=["Career", "Job Search", "Analysis", "Strategy", "ATS"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["job description analyzer", "analyze job description", "job posting analysis", "jd breakdown", "job requirements"],
        self_check="triggers-echoed",
        markdown_doc="""# Job Description Analyzer & Hiring Intelligence Engine

## Mission
Dissect complex job descriptions to extract implicit and explicit requirements, map candidate qualifications against role demands, calculate authentic match scores, and produce actionable application positioning strategies.

## Operating Rules
1. Four-Tier Qualification Extraction: Separate requirements into 1) Must-have hard skills, 2) Nice-to-have bonus skills, 3) Hidden team/cultural signals, and 4) Core business objectives.
2. Authentic Match Scoring: Calculate transparent match score percentage based on hard qualification overlap; never artificially inflate scores.
3. Gap Identification with Mitigation: Highlight every candidate gap alongside a concrete mitigation tactic (parallel experience, demonstrated fast learning, portfolio project).
4. Hidden Pain Point Detection: Decode boilerplate requirements to identify the real organizational problem the hiring manager is desperate to solve.
5. Keyword Density Guidance: Extract top 10 ATS search keywords in descending order of frequency and strategic importance.
6. Scope Discipline: Operates under authorized tool scope `memory.read` for candidate profile comparison.

## Triggers
Use when requests contain: job description analyzer, analyze job description, job posting analysis, jd breakdown, job requirements.

## Output Contract
Markdown analysis containing: 1) Role Overview & Pain Points, 2) Four-Tier Skills Taxonomy, 3) Candidate Match Score %, 4) Identified Gaps & Mitigation Strategy, 5) ATS Keyword Bank. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="offer-comparison-analyzer",
        name="offer-comparison-analyzer",
        description="Compare multiple job offers side-by-side with total compensation, equity valuation, and cost of living analysis.",
        tags=["Career", "Compensation", "Offers", "Finance", "Strategy"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["offer comparison analyzer", "compare job offers", "offer comparison", "total compensation compare", "multiple offers"],
        self_check="triggers-echoed",
        markdown_doc="""# Offer Comparison Analyzer & Multi-Offer Decision Framework

## Mission
Deliver rigorous, multi-dimensional comparative analysis of concurrent job offers, balancing total direct compensation (Base, Bonus, Equity, Sign-on) against benefits, cost of living, career trajectory, and qualitative culture fit.

## Operating Rules
1. Normalized Total Compensation: Model 4-year annualized total compensation (Year 1 vs Years 2-4) taking vesting cliffs, signing bonuses, and expected performance bonuses into account.
2. Equity Realism & Risk Modeling: Distinguish public liquid RSUs from private options/illiquid shares; model conservative, base, and upside exit scenarios for private equity.
3. Cost of Living & Tax Adjustment: Normalize offers across different geographic locations using state/local tax models and real cost of living indexes.
4. Benefits & Hidden Perks Valuation: Quantify monetary value of 401(k) matches, healthcare premiums, PTO policies, learning budgets, and remote work stipends.
5. Qualitative Career Trajectory Scoring: Score company brand prestige, promotion velocity, mentorship quality, and market resilience.
6. Scope Discipline: Operates under authorized tool scope `memory.read` without persisting sensitive compensation data externally.

## Triggers
Use when requests contain: offer comparison analyzer, compare job offers, offer comparison, total compensation compare, multiple offers.

## Output Contract
Markdown decision dossier containing: 1) Side-by-Side Compensation Matrix, 2) 4-Year Cash Flow Projection, 3) Benefits & Equity Risk Analysis, 4) Qualitative Dimension Scorecard, 5) Recommendation & Decision Rationale. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="portfolio-case-study-writer",
        name="portfolio-case-study-writer",
        description="Transform resume bullets and system architecture into detailed portfolio case studies and project deep-dives.",
        tags=["Career", "Portfolio", "Case Study", "Engineering", "Writing"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["portfolio case study writer", "portfolio case study", "project case study", "write case study", "engineering case study"],
        self_check="triggers-echoed",
        markdown_doc="""# Portfolio Case Study Writer & Architecture Narrative Builder

## Mission
Transform isolated engineering projects, system implementations, and product milestones into compelling, publication-grade technical case studies that demonstrate architectural depth, trade-off analysis, and measurable business impact.

## Operating Rules
1. Problem-First Narrative Arc: Structure case studies around the authentic business challenge, latency bottleneck, or scaling constraint before discussing technical solutions.
2. Explicit Trade-off Documentation: Detail alternatives considered, why specific tools/patterns were chosen, and what trade-offs were accepted.
3. Architecture & Data Flow Clarity: Provide clear architectural breakdowns (microservices, caching layers, data schemas, async queues) suitable for senior/staff engineering reviewers.
4. Quantified Business Impact: Anchor case study conclusion in verifiable business outcomes (revenue preserved, infrastructure cost reduced, p99 latency dropped).
5. Candidate Ownership Attribution: Clearly distinguish the candidate's individual design contributions from general team activities (`memory.read`).
6. Scope Discipline: Operates under authorized tool scope `memory.read` without side effects.

## Triggers
Use when requests contain: portfolio case study writer, portfolio case study, project case study, write case study, engineering case study.

## Output Contract
Markdown case study containing: 1) Executive Summary, 2) Problem Statement & Constraints, 3) Architecture & Implementation, 4) Trade-offs & Decisions, 5) Measurable Impact & Lessons Learned. Scope for this skill is `memory.read`.
""",
    ),
    SkillCatalogEntry(
        slug="reference-list-builder",
        name="reference-list-builder",
        description="Format professional references properly, prepare reference dossiers, and prep references with context.",
        tags=["Career", "References", "Job Search", "Dossier"],
        version="1.0.0",
        author=CORE_AUTHOR,
        required_scope="memory.read",
        autonomy="suggest",
        trust_class="core_trusted",
        triggers=["reference list builder", "professional references", "reference list", "reference dossier", "reference preparation"],
        self_check="triggers-echoed",
        markdown_doc="""# Reference List Builder & Candidate Advocacy Dossier

## Mission
Curate professional reference lists and candidate briefing dossiers that equip advocates with the exact project contexts, key competencies, and shared accomplishments needed to deliver glowing, credible reference checks.

## Operating Rules
1. Categorized Advocate Roster: Organize references by professional relationship: former managers, peer engineers, cross-functional partners, and direct reports.
2. Contextual Role Alignment: For each reference, document the shared company, project timeframe, and specific high-impact initiatives worked on together.
3. Reference Briefing Packet: Generate tailored talking points and refresher notes for each advocate highlighting the specific target role requirements.
4. Privacy & Consent Safeguards: Advise candidate to obtain explicit permission before sharing contact numbers and private emails; never disclose references prematurely.
5. Reverse Chronological Experience Grounding: Ensure dates and company names match verified workspace memory (`memory.read`).
6. Scope Discipline: Operates under authorized tool scope `memory.read` without external side effects.

## Triggers
Use when requests contain: reference list builder, professional references, reference list, reference dossier, reference preparation.

## Output Contract
Markdown dossier containing: 1) Formatted Professional Reference Sheet, 2) Reference Alignment Matrix (who covers which competencies), 3) Advocate Outreach & Briefing Email Templates. Scope for this skill is `memory.read`.
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
