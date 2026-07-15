# 08 — Specialist Agents (MVP)

```mermaid
graph TD
    classDef primary fill:#e3f2fd,stroke:#1565c0,color:#000
    classDef secondary fill:#e8f5e9,stroke:#2e7d32,color:#000

    ORCH["Orchestrator"]:::primary

    subgraph Agents["MVP Specialist Agents"]
        OA["Organization Agent<br/>Categorize, dedup, rename docs"]:::secondary
        RA["Resume Agent<br/>Build & maintain master resume"]:::secondary
        ATS["ATS Agent<br/>Score resume vs JD (read-only)"]:::secondary
        JSA["Job Search Agent<br/>Search, rank, shortlist"]:::secondary
        AA["Application Agent<br/>Tailor & submit applications"]:::secondary
        GA["Gmail Agent<br/>Classify mail, extract events"]:::secondary
        SA["Scheduler Agent<br/>Maintain deadlines, detect conflicts"]:::secondary
    end

    subgraph Autonomy["Autonomy Levels"]
        SUGGEST["Suggest-mode (default)"]:::secondary
        APPROVAL["Approval-gated"]:::secondary
        READONLY["Read-only"]:::secondary
        FULL["Full (reminders only)"]:::secondary
    end

    ORCH --> OA
    ORCH --> RA
    ORCH --> ATS
    ORCH --> JSA
    ORCH --> AA
    ORCH --> GA
    ORCH --> SA

    OA -.-> SUGGEST
    RA -.-> SUGGEST
    ATS -.-> READONLY
    JSA -.-> SUGGEST
    AA -.-> APPROVAL
    GA -.-> SUGGEST
    SA -.-> FULL
```

## Context
Read `05-agent-harness-orchestration.md`, `06-rag-retrieval.md`, and `07-mcp-tool-ecosystem.md` first. This phase builds the seven user-facing agents on top of the harness — the first point where the product becomes usable end to end.

## Objective
Implement the seven MVP specialist agents, each as a class extending the base agent contract (file 05), each with its own file under `apps/ai-service/agents/`.

## Agents to build (one file each)

**`organization_agent/`** — Mission: name, categorize, deduplicate documents. Reads: `document` memory. Writes: proposed rename/folder (via `agent_actions`, status `proposed`), never auto-applies in MVP. Must detect version chains (e.g. `Resume_v2_final_FINAL.pdf` recognized as a version of `Resume.pdf`) using the dedup logic from file 03.

**`resume_agent/`** — Mission: build and maintain the master resume. Reads: `profile`, `career` memory via retrieval (file 06). Writes: `resumes` rows. When a referenced fact is missing (e.g. no GPA recorded anywhere it's expected), triggers a specific, narrow clarifying question to the user rather than guessing or leaving a blank. Must support generating at least: Master Resume, ATS Resume, one Role-specific variant.

**`ats_agent/`** — Mission: score a resume against a pasted job description. Reads: a `resumes` row + raw JD text (not stored as a document, ephemeral input). Writes: nothing to memory — output is a score + gap list returned directly to the caller. Read-only autonomy — never edits the resume itself, only proposes edits for the Resume Agent or user to apply.

**`job_search_agent/`** — Mission: search connected platforms, rank against memory, return a shortlist. Reads: `career`, `preference` memory. Must filter out roles the user has previously rejected (check `applications.status`). Output: a ranked shortlist with a stated fit reason per role — never an unexplained score.

**`application_agent/`** — Mission: tailor documents and submit or hand off an application. Reads: `resumes`, ATS Agent output. Writes: `applications` rows. **Approval-gated autonomy — never submits without an explicit per-application user approval in MVP.** Where no application API exists for a platform, generate the tailored documents and return a deep link instead of attempting to scrape/auto-fill the platform's form (see the companion MVP spec, §9, for why).

**`gmail_agent/`** — Mission: classify mail, extract deadlines/tasks. Reads: Gmail connector (file 07). Writes: `schedule_events`, `episodic` memory. Runs on a schedule (default 6 AM daily) plus a push-triggered path for high-priority classifications (interview, deadline-today) — implement both, not just the scheduled pass, since a same-day-urgent email missing the daily window is a known failure mode. Drafts only — never sends mail.

**`scheduler_agent/`** — Mission: maintain deadlines, detect conflicts. Reads: `schedule_events` from all sources (Gmail Agent, manual entry, Application Agent outcomes). Writes: conflict flags on `schedule_events`. Full autonomy for reminders (notify-only actions are safe to automate), suggest-only for adding/editing events.

## Out of scope
The remaining ~20 agents from the full enterprise roster (Learning, Research, Coding, Calendar, Internship, Document, PDF, Planning, Reminder, Analytics, Recommendation, Security, Plugin, Connector, Reflection, Self-Improvement, Quality Assurance — all `enterprise/08-specialist-agents.md`). Earned autonomy upgrades beyond the stated defaults (v1.5+, not MVP).

## Acceptance criteria
- [ ] Each agent has its own test suite exercising at least the happy path and one "asks rather than guesses" path.
- [ ] Organization Agent, run against a seeded messy folder of 10 mixed files, produces proposals a human reviewer approves at >90% without edits.
- [ ] Resume Agent correctly asks a specific clarifying question when a seeded profile is missing an expected field, rather than fabricating a value.
- [ ] Job Search Agent, run against seeded career memory including a prior rejection, excludes that previously-rejected role from a new shortlist.
- [ ] Application Agent never calls a submission tool without a preceding recorded approval action in the test harness.
- [ ] Gmail Agent's push-triggered path fires on a seeded "interview tomorrow" test email without waiting for the scheduled pass.

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Building all seven agents before the harness is stable | Every agent needs rework when the harness interface changes; build one fully after harness is green |
| Leaving stub `fallback()` implementations that guess instead of asking | Agents silently fabricate data when uncertain, undermining the entire memory system |
| Hard-coding autonomy levels inside agent classes | Changing an agent's autonomy requires a code deploy instead of a config change |

## Best Practices

| Practice | Why |
|----------|-----|
| Test each agent's "asks rather than guesses" path specifically | This is the most important safety property an agent has — it must be explicitly tested |
| Wire Approval Agent flows through the same Permission Engine | Ensures no "special" agent bypasses the standard authorization path |
| Run the Gmail Agent's push-triggered and scheduled paths as separate tests | The push path is easy to forget and hard to verify without a dedicated test |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Gmail Agent drafting replies could expose confidential information | Draft-only policy enforced at the connector level, with output filtering for cross-conversation content |
| Application Agent storing cover letters with PII | Treat all generated documents as containing PII; apply same retention/export rules |
| Job Search Agent could send queries to unintended platforms | Scrub platform identifiers from queries; validate platform selection against approved list |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Seven agents all running against the same model provider could cause contention | Use the AI gateway (file 09) to queue agent requests with per-agent priority |
| Resume Agent generating multiple resume variants is compute-heavy | Generate variants asynchronously; cache results keyed by variant type + version |
| Gmail Agent's scheduled pass could coincide with high user traffic | Stagger scheduled agent runs across the hour; avoid top-of-the-hour alignment |
