# ADR-048: Root TS integration/connector packages and the `skills/` transpiler are archived

- **Status:** Accepted
- **Date:** 2026-10-22
- **Supersedes:** the pointing stub halves of ADR-036 (§legacy note) and ADR-037
  (§Legacy TS archive) — their supersession verdicts are unchanged and
  elaborated here; the stub archive dirs those ADRs created are now filled
  with the real trees.
- **Affects:** `integrations/` (6 TS packages, now
  `archive/integrations-legacy-ts/`), `connectors/` (3 TS packages, now
  `archive/connectors-legacy-ts/{graphql,rest}` and
  `archive/connectors-mcp-ts/mcp`), root `skills/` transpiler (now
  `archive/skills/`), `pnpm-workspace.yaml`, `archive/*/README.md` +
  `DEPRECATED.md` pointers, `apps/api/tests/test_skill_catalog.py:121-132`
  (docstring path reference only).

## Context

Root TS packages `integrations/{calendar,email,github,google-drive,notion,slack}`
and `connectors/{graphql,mcp,rest}` were judged orphaned back on 2026-08-27
(ADR-036/037) — but the judgement was executed as README-only stubs under
`archive/` while the real, fully-implemented trees (159 tracked files:
integrations 80, connectors 42, skills 37) kept
sitting at the repo root **as workspace members** (the `integrations/*` and
`connectors/*` globs in `pnpm-workspace.yaml` were never removed), paying
pnpm install cost and inviting resurrection-by-import with every lockfile
refresh. The root `skills/` tree (claude/codex/qwen mirrors +
`compiler/`, `transpiler.py`, `sync_dotfiles.py`) is the legacy generator
for the skill documents whose live surface is now `.agents/skills/**`,
served by `skill_catalog_service` with the repo-committed catalog.

## Decision

**Archive the trees, don't delete them, and stop believing in them at the
workspace root.**

1. `git mv` the whole `integrations/` and `connectors/` roots and the root
   `skills/` tree into `archive/` (history preserved via renames):
   - `integrations/{calendar,email,github,google-drive,notion,slack}` +
     `DEPRECATED.md` → `archive/integrations-legacy-ts/` (the ADR-037 dir
     that already claimed to be their archived copy).
   - `connectors/mcp` → `archive/connectors-mcp-ts/mcp/` (the exact name
     ADR-037 reserved); `connectors/{graphql,rest}` + README →
     `archive/connectors-legacy-ts/` (new sibling, same README-as-index +
     DEPRECATED.md layout as integrations-legacy-ts; packages sit in
     subdirs, consistent with integrations-legacy-ts).
   - `skills/` → `archive/skills/` wholesale.
2. Remove the `integrations/*` and `connectors/*` globs from
   `pnpm-workspace.yaml` (redundant `skills/` never was a member); the
   packages stop being install targets.
3. Update the three archive READMEs/DEPRECATED.md pointers to state the
   2026-10-22 move, the zero-import sweep, and the no-resurrect-without-ADR
   rule already present from ADR-037.
4. `plugins/*` remains in the workspace (SDK examples are live doc content).

### Investigation note

The root `agents/*` directory is **untouched**: those are live Python agent
packages (`agent.yaml` + `src/vaeloom_<name>_agent/handler.py` + pyproject)
with registered handlers used by the orchestrator and routers — a different
domain from the TS integration packages, tested in CI, and not importable
candidates for this task.

### Test-surface note

`apps/api/tests/test_skill_catalog.py:127-129` checked for a
`skills/claude` mirror and **skipped by design** when absent; with the move
it now skips consistently in every checkout where `.agents/skills` is the
single truth. The load-bearing direction of that test (on-disk ⊆ catalog)
is unaffected.

## Evidence (measured, this change)

- Pre-flight import sweep: `rg "@vaeloom/(integration-(calendar|email|
  github|google-drive|notion|slack)|connector-(graphql|mcp|rest))"` across
  `apps/`, `packages/`, `sdk/`, `plugins/`, `scripts/`, `testing/`,
  `infra/`, `.github/` → **zero hits**. Path-token sweep
  (`integrations/<pkg>`, `connectors/<pkg>`, `skills/{compiler,claude,
  codex,qwen}`, `sync_dotfiles`, `transpiler`) → only API-URL strings
  (`/connectors/mcp/builtin`), this plan's own docs, and the two
  graceful-skip lines in `test_skill_catalog.py`.
- `git status --short` on the three roots pre-move: 0 dirty lines (all
  tracked, untracked `node_modules/` caches removed before the move).
- Rename count as staged: `git status --short | Select-String '^R '`
  → 159 (integrations 80, connectors 42, skills 37).
- Config references (prettier/eslint/nx/turbo/tsconfig.base/.gitignore):
  zero hits.
- Verification after the move: `pnpm install` (lockfile diff limited to the
  removed workspace families), `pnpm lint`, `pnpm typecheck`, and
  `pnpm gen:openapi` byte-unchanged — results recorded in the task-19 report
  and progress ledger.

## Consequences

The archive is now a faithful copy rather than a pointer to git history, so
`git log --follow` restores packages as the earlier ADRs claimed; fresh
clones no longer install 9 dead packages on `pnpm install`; and the
catalog/skills truth chain is single-surface (`.agents/skills/**` +
`skill_catalog_service`), with the claude-mirror asymmetry documented in the
skipping test. The cost: repo inventory docs that name the moved paths go
stale until Task 20's documentation maintenance pass.
