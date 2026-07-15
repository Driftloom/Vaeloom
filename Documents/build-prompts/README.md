# Meridian — Build Prompts
### For Claude Code, Cursor, or any agentic coding tool

## What this is
35 implementation prompts — 17 for MVP, 18 for Enterprise (17 upgrade-deltas + 1 genuinely new file, `enterprise/17-agent-orchestration-at-scale.md`) — each a self-contained build task with context, requirements, explicit scope boundaries, and acceptance criteria. These are not more product research or documentation (that's in `Meridian-Complete-Documentation.md`, `01-Meridian-MVP-Spec.md`, and `06-Meridian-Enterprise-Paper.md`) — these are instructions meant to be handed directly to a coding agent to actually write the code.

## How to use these

**With Claude Code:** point it at `mvp/00-master-build-order.md` first — it establishes the non-negotiable architectural decisions every later file assumes. Then work through `01` → `16` in order, one file per session/milestone. Paste or reference each file's content as the task for that session. Claude Code can read the file directly from the repo if these are committed alongside the codebase (recommended — put the whole `mvp/` and `enterprise/` folders in the repo root or under `/docs/build-prompts/`).

**With Cursor:** same order, same approach — paste a file's content into Composer as the task definition for that milestone, or `@`-reference it if committed to the repo.

**Sequencing across the two folders:** do not start `enterprise/` until every acceptance criterion in `mvp/16-deployment-infrastructure.md` is met and the product has real usage data. `enterprise/00-master-build-order.md` states this explicitly as an entry gate, not a suggestion — the whole point of building MVP first is to learn what the enterprise tier actually needs to solve, not to guess.

## Why 17 files, not one giant prompt
A coding agent working from one enormous prompt tends to either lose track of earlier decisions or re-litigate them mid-build. Splitting by system — with explicit dependencies and an enforced build order — keeps each session's context focused and makes "what's done vs. not done" a matter of checking off files, not re-reading a monolith.

## Why the Enterprise files are short (mostly)
Every enterprise file assumes its MVP counterpart is already built and working — it's an upgrade delta, not a rewrite. If a future need doesn't cleanly fit as a delta on an existing MVP file, that's worth a conversation before adding a new file, not a reason to force it into the nearest existing one. `enterprise/17-agent-orchestration-at-scale.md` is the one exception in this set — routing across 28 agents, multiple tenants, and genuine multi-agent plans was a big enough problem to earn its own file rather than being squeezed into the harness file (`05`), which already had plenty to say about the harness itself.

## A note on the master decisions already made for you
Both folders' `00` files record the architectural calls that are treated as settled rather than open questions in every subsequent file — the agent contract shape, the agentic loop (Plan → Act → Observe → Reflect → Improve), the eight-part harness anatomy (Planner, Memory, State, Tools, Guardrails, Evals, Context, Execution control — mapped out explicitly in `mvp/05`), MCP-shaped tools from day one, suggest-mode-by-default autonomy, and the two-service backend split. If you want to change one of these, change it in the relevant `00` file first and re-read the downstream files that depend on it — don't let a coding agent quietly drift from it mid-build.

## Suggestions if you're about to start
- Commit these 35 files to the repo before running the first one, so Claude Code/Cursor can reference earlier files (e.g. exact table names from `02-database-schema.md`) instead of re-deriving them from memory each session.
- Run each file's acceptance criteria as literal checklist items at the end of that session — don't move to the next numbered file until they're all checked.
- The Memory System file (`04`) is the one to slow down on in both folders — it's called out in-file as the highest-care point, and it's the one place where a subtle mistake (a bad merge, a wrong confidence threshold) silently degrades everything built afterward without an obvious symptom.
- The Harness Anatomy table in `mvp/05` is worth reading even before file 04 — it's the one-page map of where every cross-cutting concern (memory, tools, guardrails, evals, context, execution control) actually lives, which makes the rest of the build order easier to hold in your head.
