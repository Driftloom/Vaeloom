<!-- /autoplan restore point: C:\Users\Dell\.gstack\projects\Driftloom-Vaeloom\master-frontend-autoplan-restore-20260924-230835.md -->

# Vaeloom Complete Enterprise Frontend + Design System + All UI Pages

**Source:** User-provided frontend master specification in the autoplan
conversation **Branch:** master **Working-copy note:** No repository plan file
existed before this invocation. This normalized copy preserves the plan's
actionable requirements for review; it is not a replacement for the full
conversation text.

## Objective

Complete and independently verify the Vaeloom frontend as one coherent,
accessible, responsive, enterprise-grade AI-native product. Inspect actual
routes, components, tokens, runtime behavior, and tests before changing
anything. Static/demo UI is allowed only when isolated, clearly labeled,
deterministic, and never presented as live backend behavior.

## Required workstreams

1. Reconcile the actual App Router route tree, navigation, workspaces, auth,
   onboarding, and product journeys.
2. Establish one canonical semantic token and component system across `apps/web`
   and `packages/ui-kit`; remove drift, duplicates, raw palette drift, and dead
   controls.
3. Cover enterprise surfaces: shell, auth, onboarding, dashboard, copilot/chat,
   agents, memory, graph, documents, resumes, ATS, jobs, calendar,
   connectors/MCP, tasks, notifications, activity, search, settings, admin,
   billing, and help where supported by the product.
4. Make every async/data surface expose loading, empty, success, error,
   permission, offline/stale/partial, retry, confirmation, and destructive
   states as applicable.
5. Preserve backend authority: no fake API success, no fabricated live
   execution, no client-side security claims, and no sensitive token exposure.
6. Verify responsive behavior from mobile through large desktop, keyboard and
   screen-reader semantics, focus behavior, contrast, reduced motion, and touch
   targets.
7. Build the requested route, component, page-state, UX-journey, audit, visual
   QA, accessibility, and architecture artifacts with evidence.
8. Run build, lint, typecheck, unit/integration/E2E/accessibility/visual checks
   that are actually available, and report blockers honestly.

## Hard completion conditions

Do not claim production readiness if major product journeys, navigation, auth,
authorization UX, critical states, responsive layouts, accessibility evidence,
design-system consistency, destructive-action UX, or tests are missing or
failing. Backend functionality must not be fabricated.

## Review inputs

- Actual repository and runtime evidence are authoritative.
- `DESIGN.md` is the existing design-system baseline and must be reconciled with
  code.
- `AGENTS.md` and phase contracts provide repository constraints and
  test/security honesty rules.
- Current working tree is a moving target. During this review, the branch
  advanced through frontend/UI-kit commits (`60f8cd4c`, `98915607`, `faeef0da`,
  `9bac8cad`) and now has uncommitted tenant-scoping changes in
  `apps/api/src/api/routers/integrations.py` and
  `apps/api/src/api/services/integration_service.py`. Re-snapshot and re-run
  every gate before implementation.

## Required review output

The autoplan pipeline must amend this plan with findings, task sequencing, test
coverage, architecture, design-system decisions, evidence requirements, deferred
scope, and a final approval gate before application changes are made.

## Phase 1: CEO Review

**Mode:** SELECTIVE EXPANSION **Verdict:** NO-GO for the current
production-ready claim. CONDITIONAL GO only for a truth-first stabilization
phase. **Outside voice:** Claude subagent completed; Codex unavailable because
the CLI is not installed. Findings are single-model corroboration, not two-model
consensus. **Evidence note:** The independent reviewer executed web/UI-kit
typecheck, Jest, and build checks and reported 57 web tests plus 5 UI-kit tests
passing. E2E, browser, accessibility, and visual verification were not
completed. Those results are recorded as reviewer evidence, not as a substitute
for the final engineering gate.

### Pre-review system audit

- Base branch: `master`; remote is GitHub; no target PR was present.
- Current tree is collaborative and dirty. Existing changes under `apps/web` and
  `packages/ui-kit` are user work and were not reverted or edited.
- `DESIGN.md` exists and declares semantic tokens, a 4px spacing grid, Inter,
  Space Grotesk, and IBM Plex Mono as the design baseline.
- The repository has a real Next.js App Router frontend, a UI-kit package, live
  backend APIs, an E2E harness, and existing design documentation. The plan must
  stabilize and connect these assets, not replace them with a parallel frontend.
- The governing enterprise execution status places ENT-P01 ahead of ENT-P09/P10.
  This review therefore treats ENT-P09/P10 as later entry criteria, not
  permission to claim those phases are complete.
- No `TODOS.md` was found at the repository root. Deferred work will be captured
  in this plan and in the external review artifacts until a repository TODO
  source is explicitly established.

### 0A. Premise challenge

| Premise                                                | Repository evidence                                                                                                                                                          | Assessment                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Route coverage means frontend completeness             | 60 routes compile, but new search, tasks, email, career, invite, and security surfaces are fixture, redirect, or simulated flows                                             | **Wrong as a completion metric.** Use behavior, data-source honesty, states, and journey evidence instead. |
| Labeled static UI is sufficient for primary navigation | `career`, `search`, `tasks`, and `email` carry realistic claims and are linked from `Sidebar.tsx:50-111`; `tasks/page.tsx:111-136` reports a 100% success rate from fixtures | **Unsafe.** Demo data must be quarantined from production navigation or explicitly permissioned.           |
| Backend authority is preserved by static UI            | Existing API methods exist for search, invitations, MFA, and sessions, while new pages ignore them                                                                           | **Partly wrong.** Wire existing contracts before adding more screens.                                      |
| One design system exists                               | Runtime CSS, Tailwind aliases, UI-kit JSON tokens, and design documents use different namespaces and values                                                                  | **Wrong.** Select one authority and add parity checks.                                                     |
| Loading/error files prove page states                  | Many boundaries exist, but synchronous fixture pages cannot produce the states they claim to cover                                                                           | **Wrong.** Define state machines from actual requests.                                                     |
| Enterprise support is environment-gated UI             | `Sidebar.tsx:42-44` and `EnterpriseGated.tsx` use a public env flag; billing is visible outside the enterprise group; policy data is absent from shared auth/workspace types | **Wrong.** Server-derived capability and entitlement data must control presentation.                       |
| Build success proves production readiness              | Web build passed in the independent review, while E2E, full a11y, browser verification, and delivery smoke checks remain unproven or blocked                                 | **Wrong.** The plan's full gate is mandatory.                                                              |
| Existing documentation is current                      | Audit documents claim clean state, complete testing, and verified telemetry while the tree is dirty and error tracking is console-only                                       | **Wrong.** Evidence status must be explicit and reproducible.                                              |

### 0B. Existing-code leverage map

| Plan sub-problem        | Existing code or flow to reuse                                                                    | Decision                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Search                  | `CommandCenter.tsx:646-703` already performs debounced backend search                             | Replace the fixture-only `/search` implementation with the same typed contract and deep-link model.                          |
| Invitations             | Live accept endpoint and client method exist for organizations                                    | Replace timer-based `invite/[token]` behavior with token validation, identity binding, and explicit recovery states.         |
| MFA and sessions        | `api.ts:356-386` exposes real session/MFA methods                                                 | Wire the security page to these methods; do not ship hardcoded secrets, codes, or sessions.                                  |
| Auth/session foundation | `useAuth.tsx`, `api.ts`, CSRF middleware, and refresh queue already exist                         | Migrate to secure server-managed cookies without creating a second auth system.                                              |
| App shell               | `layout.tsx`, workspace layout, Sidebar, TopNav, CommandCenter, and existing theme hooks          | Consolidate around one route/capability registry; do not rewrite the shell.                                                  |
| Design tokens           | `globals.css`, `tailwind.config.ts`, and `DESIGN.md` already define a useful semantic base        | Pick the runtime source and migrate the UI-kit generator to it, or make the generator the single source; one authority only. |
| UI primitives           | `packages/ui-kit` already has Button, Modal, Tabs, DataTable, feedback, memory, and AI components | Repair public exports and semantics first, then migrate duplicate app wrappers.                                              |
| Testing                 | `apps/web/e2e` has a real FastAPI/Next Playwright harness and existing axe/responsive tests       | Repair false-green paths and generate route coverage from the route tree.                                                    |
| Delivery                | Docker, Kubernetes, GitHub Actions, and frontend manifests exist                                  | Repair context, branch, standalone, image, and smoke-check mismatches before claiming deployability.                         |

### 0C. Dream-state delta

```text
CURRENT
Mixed live/static/simulated surfaces
+ independent route lists
+ JavaScript-readable tokens
+ token and UI-kit drift
+ incomplete E2E/a11y evidence
+ master/main and Docker/deploy drift
              |
              v
THIS PLAN, PHASE 1
Capability and route inventory
+ quarantine previews
+ secure session and recovery path
+ real state/error contracts
+ one design-system authority
+ honest evidence ledger
+ repairable delivery pipeline
              |
              v
12-MONTH IDEAL
Policy-derived navigation and entitlements
+ secure HttpOnly session architecture
+ generated typed contracts
+ versioned capability registry
+ complete async/recovery state machines
+ privacy-safe telemetry and Web Vitals
+ deterministic visual and accessibility baselines
+ canary deployment with tested rollback
```

### 0C-bis. Implementation alternatives

**Approach A: Truth-first stabilization**

- Effort: M, human ~1-2 weeks / CC ~1-2 hours for the reviewable slice.
- Risk: Low.
- Pros: Removes false trust and security claims; reuses existing contracts;
  produces a credible baseline.
- Cons: Defers broad visual polish and some new product breadth.
- Reuses: Existing backend, shell, theme, and test harness.

**Approach B: Reuse-first vertical slices (recommended)**

- Effort: L, human ~4-8 weeks / CC ~4-8 hours across slices.
- Risk: Medium.
- Pros: Wires search, invite, security/session, recovery, and route correctness
  end to end; leaves a platform other pages can use.
- Cons: Requires backend/frontend coordination and staged rollout.
- Reuses: Highest existing-code leverage.

**Approach C: Big-bang 60-route completion**

- Effort: XL, human ~3-6 months / CC ~1-2 days of high-risk implementation.
- Risk: High.
- Pros: Potentially coherent if perfectly executed.
- Cons: Current evidence, auth, delivery, and state foundations are
  insufficient; a partial failure would leave many false surfaces.
- Reuses: Existing code would be hard to preserve while replacing.

**Recommendation:** Approach A immediately, then Approach B. Approach C is not
an acceptable execution plan until P0 trust, security, and delivery foundations
are proven.

### Section 1: Architecture and strategy review

**Findings:**

1. **[P0, confidence 10/10]** The plan's route-level breadth is ahead of its
   contract layer. New pages bypass existing search, invitation, MFA, and
   session APIs. This creates parallel behavior and makes later fixes multiply.
2. **[P0, confidence 9/10]** Sidebar, TopNav, CommandCenter, accessibility
   scripts, and docs maintain independent navigation registries.
   `CommandCenter.tsx:323-340` links to nonexistent `/analytics`;
   `EnterpriseGated.tsx:24-33` links to nonexistent `/workspaces`.
3. **[P0, confidence 9/10]** `api.ts`, `api-client.ts`, and direct `fetch()`
   calls do not share one request, token, CSRF, error, and workspace-scope
   contract. `ChatWindow.tsx:302-337` bypasses the centralized client.
4. **[P1, confidence 9/10]** UI-kit token generation is not wired into the app.
   `packages/ui-kit/src/tokens/index.ts:52-120` can emit a different namespace,
   but `globals.css` is the runtime source. A migration without a single
   authority creates silent theme drift.
5. **[P1, confidence 8/10]** The frontend middleware decodes JWT shape but does
   not verify signatures. Backend authorization remains authoritative, but
   protected shells can render with forged shape tokens; the UI must not present
   them as authenticated truth.

**Architecture diagram:**

```text
                    +--------------------------+
                    | Browser / Next App Router |
                    +------------+-------------+
                                 |
       +-------------------------+--------------------------+
       |                         |                          |
  +----v-----+             +-----v------+              +----v------+
  | Auth/API |             | UI-kit     |              | Fixture   |
  | clients  |             | components |              | pages     |
  +----+-----+             +-----+------+              +----+------+
       |                         |                          |
       | direct fetch + refresh  | exported primitives      | static data
       |                         |                          |
  +----v-------------------------v--------------------------v------+
  | Route tree / Sidebar / TopNav / CommandCenter / docs          |
  | independent registries; no single capability contract         |
  +-------------------------------+------------------------------+
                                  |
                    +-------------v--------------+
                    | FastAPI + workspace auth  |
                    | RLS / policy / providers  |
                    +-------------+--------------+
                                  |
                    +-------------v--------------+
                    | Database / S3 / live tools |
                    +----------------------------+
```

### Section 2: Error and rescue registry

| Codepath                    | Failure                                                 | Exception or error class                      | Required rescue                                                                          | User-visible result                         |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| `api.ts` request/refresh    | Network timeout, malformed JSON, 401, 429, 5xx          | `AbortError`, `SyntaxError`, `ApiError`       | Abort/cancel stale request, classify status, honor `Retry-After`, preserve safe redirect | Retry or clear explanation, never raw stack |
| OAuth callback              | Invalid code, provider outage, backend failure          | Supabase error, `TypeError`, `Response` error | Remove code and sensitive logs, return login with support correlation                    | OAuth failed with recovery path             |
| Search page                 | Empty query, empty index, provider timeout, invalid URI | `ApiError`, empty result, invalid route       | Distinguish no results from failed index; validate deep links                            | Search retry and no dead result links       |
| Invitation acceptance       | Invalid, expired, replayed, wrong-account token         | `ApiError`, 403/404/409                       | Bind token to authenticated identity; show expiry and transfer policy                    | No false membership success                 |
| Security settings           | MFA setup, TOTP verify, session revoke, timeout         | `ApiError`, conflict, timeout                 | Keep server state authoritative; clear pending local state on failure                    | No fake “verified” or “revoked”             |
| Fixture page                | User treats demo as live data                           | N/A                                           | Disable mutation or show explicit preview mode                                           | Demo badge plus non-production affordance   |
| Route navigation            | Deleted/renamed route                                   | `notFound()` / route manifest check           | Fail CI and provide valid fallback                                                       | 404 with breadcrumb and escape route        |
| Destructive settings action | Stale confirmation, 401/403/409                         | `ApiError`, conflict                          | Explain target, scope, and recovery; audit result                                        | No silent success                           |

**Critical gaps:** reset token logging and lockout recovery are backend-coupled
trust gaps; the current frontend plan does not own them but cannot claim
zero-trust completion until they are resolved. The error contract must include
401, 403, 404, 409, 422, 423, 429, 500, timeout, offline, and unknown mutation
outcome.

### Section 3: Security and threat model

1. **[P0, confidence 10/10]** `api.ts:64-80,111-125` stores access and refresh
   tokens in localStorage and JS-readable cookies without `Secure` or
   `HttpOnly`. Any XSS can exfiltrate long-lived credentials.
2. **[P0, confidence 10/10]** `auth/callback/route.ts:24-31,62-82` logs the
   OAuth code, cookie metadata, backend user data, and error bodies. Sensitive
   logging must be removed before any release.
3. **[P0, confidence 10/10]** `settings/security/page.tsx:25-69,133-243,249-295`
   fabricates TOTP secrets, recovery codes, sessions, verification, and
   revocation. It also displays “RLS VERIFIED” and “ENFORCED” without live
   evidence.
4. **[P0, confidence 9/10]** Reset and lockout behavior is inconsistent: reset
   tokens are reportedly logged in the backend, and reset does not clear lockout
   state. The frontend's “reset and unlock” promise is therefore misleading.
5. **[P1, confidence 9/10]** Invitation acceptance uses a timer and generic
   redirect instead of token validation and account binding. This is a
   cross-account membership risk even when the backend endpoint is correct.
6. **[P1, confidence 9/10]** UI feature gates are environment flags, not
   server-derived policy. Hidden controls are not an authorization boundary and
   can expose inconsistent navigation.
7. **[P1, confidence 9/10]** Direct fetches and workspace-selected identifiers
   need negative tests for cross-tenant, stale-cache, and role changes.

**Threat boundary:** Browser is untrusted. The frontend may hide controls, but
backend RLS, policy, entitlement, and audit services remain authoritative.
Sensitive token migration must include session revocation, OAuth callback
changes, CSRF, refresh concurrency, and cross-account cache isolation.

### Section 4: Data flow and interaction edge cases

```text
Route request
   |
   v
Auth + workspace scope ----X----> unauthorized / forbidden
   |                         \
   v                          v
Capability lookup ----------> disabled / unavailable state
   |
   v
Typed API request --> nil/empty/error/stale/partial responses
   |                 |       |       |        |
   |                 |       |       |        +--> partial UI + retry failed slice
   |                 |       |       +----------> stale banner + refresh
   |                 |       +------------------> explicit empty state
   |                 +--------------------------> named error + recovery
   v
Mutation --> duplicate / timeout / conflict / 403 / 409
   |
   +--> optimistic state is rolled back or reconciled
   +--> server audit event is required for sensitive writes
```

Unhandled interaction cases to cover in the plan:

- Double-click submit, keyboard shortcut while typing, back/forward navigation
  mid-mutation, and two tabs acting on the same resource.
- Empty, zero, long, unicode, and invalid workspace/resource identifiers.
- Stale session, expired CSRF, 401 refresh race, 429 retry, provider timeout,
  and unknown mutation outcome.
- Search result deep links to deleted resources; invitation replay; TOTP retry;
  stale optimistic state.
- Mobile drawers, dialogs, focus return, and touch targets for capability views
  and chat.
- Logout and workspace switch while SWR data is in flight; cache purge must be
  keyed by user, tenant, workspace, region, and capability.

### Section 5: Code quality review

- The dirty UI-kit additions are directionally useful, but adding exports does
  not prove the public contract is complete or behaviorally correct. The new
  `outline` variant must be typechecked and behavior-tested, not only made
  visible to new pages.
- App and package layers duplicate `ErrorState`, `EmptyState`, Tabs, tables,
  feedback, search, and AI primitives. The plan should migrate wrappers to
  re-exports or document an intentional escape hatch.
- `DataTable`, `Drawer`, `FormField`, `Card`, and `StatCard` need keyboard/focus
  behavior before they become canonical enterprise primitives.
- New fixture pages repeat button, tab, filter, and status markup. That is an
  opportunity for shared `FilterBar`, `StatCard`, `Tabs`, `ErrorState`, and
  accessible disclosure patterns, not a reason to add another local primitive.
- The plan has no explicit naming, ownership, or module-boundary rules. Add a
  route manifest, capability contract, fixture boundary, and API ownership
  table.

### Section 6: Test review

**New UX/data paths:**

- New routes: account locked, invite, career, documents redirect, email, help,
  resumes redirect, search, security, tasks.
- New interactions: workspace navigation, filters, tabs, disclosure, invitation
  acceptance, MFA verification, session revoke, search deep links, task
  expansion, email thread selection, help article expansion.
- New data sources: live auth/session/invite/search APIs and isolated
  deterministic fixtures.
- New failure paths: provider outage, invalid token, unauthorized role, stale
  workspace cache, malformed API payload, network timeout, duplicate mutation,
  deleted resource.
- New visual surfaces: dark, light, high-contrast, 320px through 2560px, reduced
  motion, keyboard-only.

The independent reviewer reported web Jest 57/57 and UI-kit Jest 5/5 passing,
but the current tests do not cover the new routes, the security fixture
behavior, cross-account cache isolation, real E2E execution, or full
accessibility. The plan must add route-generated smoke/E2E coverage, exact
negative assertions, and fixture contract tests before any completion claim.

### Section 7: Performance review

- Landing route weight is reported at 332 kB first load, capabilities at 258 kB,
  and profile at 182 kB. No route-level budget gate is wired.
- Fixture-heavy pages ship deterministic data into client bundles. This is
  acceptable for preview mode only if the mode is isolated and the production
  route does not pretend to be live.
- `ChatWindow.tsx` and capability views are large client components. Splitting
  by route and interaction state is preferable to a broad rewrite.
- Add measured p50/p95 route load, interaction latency, CLS, INP, bundle size,
  and 200% zoom checks. Do not claim a performance number from source
  inspection.

### Section 8: Observability and debuggability

- `error-tracking.ts` is console-only. The global error boundary's “team
  notified” copy is unsupported.
- `web-vitals.ts` is a no-op when no endpoint is configured. A plan requirement
  must specify the destination, consent/privacy boundary, redaction, sampling,
  and failure behavior.
- Add release markers, route/workspace-scoped correlation, privacy-safe error
  events, and a dashboard for auth failures, route load failures, provider
  freshness, and action rejection.
- Sensitive values must never appear in frontend logs, fixtures, URLs, or
  telemetry payloads.

### Section 9: Deployment and rollout review

1. **Branch gate:** remote default is `master`, while several workflows trigger
   on `main`.
2. **Docker context:** `apps/web/Dockerfile` copies root files while workflows
   use `apps/web` as the context.
3. **Standalone output:** Dockerfile copies `.next/standalone` without setting
   `CI=true` on non-Windows.
4. **Image substitution:** deploy steps do not reliably replace the image with
   the built digest.
5. **Health check:** frontend Kubernetes probes `/health`, but no dedicated
   frontend health route is evidenced.
6. **Smoke gate:** load-test steps print success without proving threshold
   evaluation.
7. **Rollback:** an `undo` command is present without post-rollback route/auth
   smoke verification.

The plan must make delivery evidence a gate, not a documentation section. Until
these paths are repaired and tested, production-ready is NO-GO.

### Section 10: Long-term trajectory

- Reversibility: 2/5 for a broad route-by-route implementation; 4/5 for a staged
  stabilization with feature flags and quarantine.
- Technical debt: route registries, duplicate primitives, direct fetch paths,
  token architecture, and false audit claims are load-bearing debt.
- Platform potential: one capability/route registry, one state contract, one API
  client boundary, and one design-token authority would make future pages
  cheaper and safer.
- The plan should not create a second frontend or a second token system. It
  should make existing foundations canonical.

### Section 11: Design and UX review

- Initial design completeness: 4/10. The plan lists states and broad surfaces
  but does not define the canonical user hierarchy, real vs preview boundary, or
  page-level recovery behavior.
- `DESIGN.md` is a useful baseline, but runtime values and UI-kit JSON disagree.
- New pages have convincing hierarchy, but career, search, tasks, email, and
  help use repetitive card/filter patterns and some clickable non-semantic
  containers.
- Design system alignment is 3/10 until token authority, public exports,
  keyboard semantics, and responsive behavior are fixed.
- Responsive/a11y completeness is 3/10 until the plan names
  320/375/768/1024/1440/2560 behavior, focus order, reduced motion, and
  route-specific evidence.

### NOT in scope

| Deferred item                                                            | Rationale                                                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Big-bang rewrite of all 60 routes                                        | Existing live foundation should be stabilized and reused.                                           |
| New backend product contracts for career, email, or workflow persistence | Product ownership and persistence semantics are not defined; these are separate API/product slices. |
| Full enterprise admin implementation before ENT-P09/P10                  | Governing phase order places ENT-P01 first; enterprise UX needs policy decisions.                   |
| New analytics visualization                                              | No canonical analytics contract or route exists; remove or defer the dead link first.               |
| New i18n/localization framework                                          | No locale contract or target locale set exists; record as a later platform decision.                |
| Production claims based on current audit documents                       | They are not evidence until regenerated from current execution.                                     |

### What already exists

- `apps/web/src/app/layout.tsx` and the workspace layout provide the shell,
  theme bootstrap, skip link, and mobile sidebar structure.
- `apps/web/src/lib/api.ts` and `api-client.ts` provide API, CSRF, refresh, key
  transformation, and error primitives, despite split ownership.
- `packages/ui-kit` contains substantial core, navigation, data, feedback,
  memory, and AI primitives, including new untracked extensions.
- `DESIGN.md` defines semantic token intent, typography, spacing, and component
  morphology.
- `apps/web/e2e` provides a real browser/API harness with axe, responsive,
  mutation, document, auth, and onboarding tests.
- Backend services already expose auth, workspace, search, invitation, MFA,
  session, document, resume, approval, connector, and notification surfaces that
  the UI can reuse.
- Existing error, loading, not-found, confirmation, theme, and workspace
  components are available to migrate toward canonical primitives.

### Failure modes registry

| ID   | Failure                  | Trigger                              | User harm                       | Detection                    | Rescue                                       | Status   |
| ---- | ------------------------ | ------------------------------------ | ------------------------------- | ---------------------------- | -------------------------------------------- | -------- |
| F-01 | Fake success             | Fixture or timer shown as live state | Trust loss and unsafe action    | Contract/network test        | Disable action or explicit preview state     | Open, P0 |
| F-02 | Token theft              | XSS plus JS-readable storage/cookies | Account takeover                | Storage/CSP security test    | Secure HttpOnly session migration and revoke | Open, P0 |
| F-03 | Reset takeover           | Raw reset token in logs              | Account reset by log reader     | Secret-log scanner           | Remove raw logging and deliver securely      | Open, P0 |
| F-04 | Lockout deadlock         | Reset does not clear lockout         | User cannot recover as promised | 423 → reset → login E2E      | Clear lockout only after verified reset      | Open, P0 |
| F-05 | Invite replay/wrong user | Token not bound to identity          | Unauthorized membership         | Cross-account negative test  | Identity-bound token acceptance              | Open, P0 |
| F-06 | Partial provider state   | Gmail/MCP/model outage               | Stale or misleading telemetry   | Freshness/health contract    | Degraded banner and failed-slice retry       | Open, P1 |
| F-07 | Cross-workspace leakage  | Client-selected workspace/filter     | Tenant data exposure            | Negative tenant tests        | Server-derived scope and cache purge         | Open, P0 |
| F-08 | E2E false green          | Redirect/error counted as pass       | Unverified route/a11y           | URL/status assertions        | Fail on unexpected URL/status                | Open, P1 |
| F-09 | Deployment drift         | Context/image/branch mismatch        | Broken release                  | Container and manifest smoke | Block deploy before rollout                  | Open, P0 |
| F-10 | Stale evidence           | Docs claim status without artifacts  | Team trusts false readiness     | Evidence manifest check      | Regenerate and mark unverified               | Open, P0 |

### CEO dual voices

**CLAUDE SUBAGENT (CEO — strategic independence):** The strongest finding is
that the plan is directionally correct but not yet executable: it lacks
dependency order, acceptance criteria, owners, rollback gates, and a distinction
between compiled routes and product-complete journeys. The reviewer recommends
truth-first stabilization, reuse of existing backend contracts, and quarantine
of simulated primary-navigation surfaces. Codex was unavailable.

**CODEX SAYS:** Not run. `codex` binary is not installed; this is a single-model
phase, not a false consensus.

**CEO DUAL VOICES — CONSENSUS TABLE:**

| Dimension                            | Claude subagent                                                                                | Codex | Consensus                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------- |
| 1. Premises valid?                   | Major premises about route count, demo data, design system, and evidence are wrong or unproven | N/A   | Single-model finding; treat as provisional until human gate     |
| 2. Right problem to solve?           | Trust-first stabilization and reusable contracts beat maximum route count                      | N/A   | Single-model recommendation                                     |
| 3. Scope calibration correct?        | Current breadth is too large for one implementation pass; stabilize first                      | N/A   | Single-model recommendation                                     |
| 4. Alternatives explored?            | Truth-first, reuse-first, and big-bang compared; reuse-first sequence preferred                | N/A   | Complete single-model analysis                                  |
| 5. Competitive/market risks covered? | Product trust, deployment credibility, and preview boundary are primary risks                  | N/A   | Partially covered; competitive product positioning remains open |
| 6. Six-month trajectory sound?       | Only if token, capability, route, evidence, and delivery contracts become canonical            | N/A   | Conditional                                                     |

### CEO implementation tasks

- [ ] **T1 (P0, human: ~2-4h / CC: ~20-30min)** — Trust boundary — quarantine
      simulated primary-navigation surfaces and remove unsupported
      success/security claims.
  - Surfaced by: CEO Section 3 and failure modes F-01/F-03/F-05.
  - Files:
    `apps/web/src/app/workspace/[workspaceId]/settings/security/page.tsx`,
    `invite/[token]/page.tsx`, `career/page.tsx`, `search/page.tsx`,
    `tasks/page.tsx`, `email/page.tsx`, `Sidebar.tsx`, `TopNav.tsx`.
  - Verify: route manifest scan plus fixture contract tests and exact UI-state
    review.
- [ ] **T2 (P0, human: ~1-2d / CC: ~2-4h)** — Auth and session — replace
      JS-readable token storage with secure server-managed session architecture
      and remove sensitive OAuth logging.
  - Surfaced by: CEO Section 3, F-02/F-03.
  - Files: `apps/web/src/lib/api.ts`, `apps/web/src/app/auth/callback/route.ts`,
    `apps/web/src/hooks/useAuth.tsx`, `apps/web/src/middleware.ts`, backend auth
    service and session tests.
  - Verify: exact security tests, CSP/storage scan, refresh race tests,
    cross-account logout tests.
- [ ] **T3 (P0, human: ~2-4d / CC: ~3-5h)** — Recovery and identity — wire
      lockout, password reset, invitation, MFA, and session APIs to real server
      state.
  - Surfaced by: CEO Sections 2-4, F-04/F-05.
  - Files: auth pages, organization invite page, security settings,
    `api-client.ts`, backend auth tests.
  - Verify: 423→reset→login, invalid/expired/replayed invite, MFA failure,
    session revoke E2E tests.
- [ ] **T4 (P0, human: ~1-2d / CC: ~1-2h)** — Route and capability governance —
      create one route manifest and policy-derived capability source; remove
      dead links and env-only gates.
  - Surfaced by: CEO Sections 1 and 4.
  - Files: `Sidebar.tsx`, `TopNav.tsx`, `CommandCenter.tsx`,
    `EnterpriseGated.tsx`, shared auth/workspace types, route tests.
  - Verify: every navigation target resolves; unauthorized/disabled capability
    tests fail closed.
- [ ] **T5 (P0, human: ~1-2d / CC: ~1-2h)** — Delivery evidence — repair branch
      triggers, Docker context, standalone output, image substitution, health
      checks, and rollback smoke tests.
  - Surfaced by: CEO Section 9, F-09.
  - Files: GitHub workflows, `apps/web/Dockerfile`, `next.config.js`,
    Compose/Kubernetes manifests, deployment smoke scripts.
  - Verify: container build, manifest render, health smoke, deploy/rollback
    rehearsal.
- [ ] **T6 (P1, human: ~1-2d / CC: ~2-3h)** — Design system authority — unify
      runtime tokens, UI-kit exports, Tailwind aliases, and primitive behavior;
      add parity and lint gates.
  - Surfaced by: CEO Sections 5 and 11.
  - Files: `globals.css`, `tailwind.config.ts`, `packages/ui-kit/src/tokens`,
    `packages/ui-kit/src/index.ts`, primitive components, docs.
  - Verify: token parity test, UI-kit typecheck/lint/Jest,
    dark/light/high-contrast screenshots.
- [ ] **T7 (P1, human: ~2-3d / CC: ~3-5h)** — State and test coverage — generate
      route/state coverage and repair false-green E2E/a11y/visual gates.
  - Surfaced by: CEO Sections 2, 4, 6, and F-08.
  - Files: `apps/web/e2e`, Jest configs/tests, accessibility audit script, CI
    workflows, state components.
  - Verify: full web/UI-kit test commands, route smoke, axe, keyboard,
    responsive, and visual evidence.
- [ ] **T8 (P2, human: ~1-2d / CC: ~1-2h)** — Observability and performance —
      replace console-only claims with privacy-safe error reporting, release
      markers, and measured route budgets.
  - Surfaced by: CEO Sections 7 and 8.
  - Files: `error-tracking.ts`, `error-tracking-boundary.tsx`, `web-vitals.ts`,
    route dashboards/budget config.
  - Verify: event redaction tests, Web Vitals sample, budget gate, release
    smoke.

### CEO decision audit trail

| #   | Phase | Decision                                            | Classification           | Principle | Rationale                                                                            | Rejected                       |
| --- | ----- | --------------------------------------------------- | ------------------------ | --------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| 1   | CEO   | Choose truth-first stabilization before breadth     | User challenge candidate | P1/P2     | Existing contracts and P0 trust gaps make breadth-first work unsafe                  | Big-bang completion            |
| 2   | CEO   | Quarantine fixture primary-navigation surfaces      | Mechanical               | P1/P4     | Simulated security, invite, and telemetry claims violate the plan's own no-mock rule | Keep pages as ordinary live UI |
| 3   | CEO   | Reuse existing search/invite/MFA/session APIs       | Mechanical               | P4        | Reuse is faster and preserves backend authority                                      | Parallel fixture APIs          |
| 4   | CEO   | Select one token/component authority                | Taste                    | P5/P3     | Both paths can work, but one canonical source is required                            | Keep three token systems       |
| 5   | CEO   | Route/capability manifest before page proliferation | Mechanical               | P2/P4     | Prevents dead links and policy drift                                                 | Independent route lists        |
| 6   | CEO   | Make delivery evidence a release gate               | Mechanical               | P1        | Build success alone cannot prove deployability                                       | Documentation-only delivery    |
| 7   | CEO   | Defer career/email/task backend persistence         | User challenge candidate | P1/P6     | Product contracts are undefined and fixtures are not product evidence                | Treat fixtures as MVP data     |
| 8   | CEO   | Preserve current dirty work during review           | Mechanical               | P6        | Repo is collaborative and user work must not be overwritten                          | Reset/revert changes           |

### CEO completion summary

```text
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION                           |
| System Audit         | Dirty tree, live assets, false evidence          |
| Step 0               | Stabilize truth and contracts before breadth    |
| Section 1  (Arch)    | 5 issues                                      |
| Section 2  (Errors)  | 8 paths mapped, 4 critical gaps               |
| Section 3  (Security)| 7 issues, 5 P0                                |
| Section 4  (Data/UX) | 7 edge-case groups, 6 unhandled               |
| Section 5  (Quality) | 4 issues                                      |
| Section 6  (Tests)   | Diagram produced, 6 major gaps                |
| Section 7  (Perf)    | 4 issues                                      |
| Section 8  (Observ)  | 4 gaps                                        |
| Section 9  (Deploy)  | 7 risks                                       |
| Section 10 (Future)  | Reversibility 2/5, debt items 5               |
| Section 11 (Design)  | 4 issues, initial 4/10                        |
+--------------------------------------------------------------------+
| NOT in scope         | written (6 items)                             |
| What already exists  | written                                     |
| Dream state delta    | written                                     |
| Error/rescue registry| 8 methods, 4 critical gaps                    |
| Failure modes        | 10 total, 5 critical gaps                    |
| TODOS.md updates     | repository TODOS.md absent; captured here      |
| Scope proposals      | 2 queued user challenges, no Codex vote       |
| CEO plan             | written as this plan amendment                |
| Outside voice        | Claude subagent; Codex unavailable            |
| Lake Score           | 8/8 recommendations selected complete option  |
| Diagrams produced    | premise, leverage, dream state, architecture,  |
|                       | data/error flow                              |
| Stale diagrams found | documentation claims require regeneration    |
| Unresolved decisions | 2 premise/product challenges at final gate    |
+====================================================================+
```

**Phase 1 complete.** Codex: unavailable. Claude subagent: 10 primary concerns,
5 critical trust/security/deployment gaps, and 2 premise challenges queued for
the final gate. Consensus: 0/6 two-model confirmations; single-model evidence is
explicitly marked. Passing to Phase 2.

## Phase 2: Design Review

**Scope:** UI detected. The gstack designer was not available, so no visual
mockups were generated. This is a plan review grounded in source and
design-system evidence, not a live visual audit. **Focus:** all seven
dimensions. No mid-run user question was needed because autoplan resolves
intermediate decisions automatically; genuine product choices are queued for the
final gate. **Snapshot warning:** one outside reviewer observed a different
repository snapshot while the tree was being modified concurrently. The current
local tree is authoritative and must be re-read immediately before
implementation.

### Step 0: Design scope and leverage

**Initial design completeness:** 4/10. The plan names many pages and states but
does not define role-based first viewports, page archetypes, a live/preview
boundary, or mutation recovery behavior.

**DESIGN.md status:** Found at
`C:\PROJECTS\PIOS\ClonU\Driftloom\Vaeloom\DESIGN.md`. It establishes semantic
tokens, a 4px grid, typography, and component morphology. It is the declared
design baseline, but runtime and UI-kit code currently disagree with parts of
it.

**Existing design leverage:**

- Reuse the workspace shell, theme bootstrap, skip link, and responsive sidebar
  behavior.
- Reuse the UI-kit Button, Modal, Tabs, DataTable, feedback, navigation, data,
  memory, and AI primitives rather than adding page-local equivalents.
- Reuse existing loading, error, empty, confirmation, and status components
  after their semantics are corrected.
- Use the backend capability contract to control which navigation and page
  states are available.
- Keep fixtures in `src/lib/fixtures/` and tag them with an explicit `dataMode`.

**Required page archetypes:**

| Archetype       | First thing shown               | Primary action                               | Supporting evidence                       | Mobile pattern                         |
| --------------- | ------------------------------- | -------------------------------------------- | ----------------------------------------- | -------------------------------------- |
| Dashboard       | next best action                | Start or resolve the highest-priority action | approvals, deadlines, activity, freshness | single-column action queue             |
| Career cockpit  | target role and next job action | tailor or inspect a role                     | pipeline, gaps, evidence                  | vertical pipeline with sticky action   |
| AI run          | active run and decision queue   | stop, approve, or continue                   | steps, context, citations, confidence     | run timeline with detail disclosure    |
| Search          | query and scope                 | submit or refine query                       | results and deep link                     | list-to-preview navigation             |
| Master/detail   | result list and selected item   | inspect or act                               | metadata and history                      | list-to-detail drawer/navigation       |
| Files/documents | file tree/table and selection   | upload or open                               | version, processing, permissions          | file list then detail route            |
| Settings        | category and current section    | save scoped change                           | validation, impact, audit                 | category accordion or stacked sections |
| Admin console   | incidents and policy health     | resolve or inspect                           | audit, usage, recovery                    | incident-first stack                   |

**Decision rule:** no new page may default to “header + four stat cards + filter
pills + card list” unless its job is genuinely a KPI dashboard or data table.

### Step 0.5: Visual design setup

`DESIGN_READY` was not available and no mockup artifacts were generated. The
plan therefore carries concrete layout, hierarchy, state, and token decisions
forward without pretending that a visual comparison occurred. Runtime
screenshots remain required before implementation approval.

### Design outside voices

**CLAUDE SUBAGENT (design completeness):** Found 14 design/UX findings. The
highest-risk issues are navigation registries, false-success security/recovery
surfaces, non-semantic clickable containers, and a split token authority. It
rates the plan 3-4/10 initially and proposes amended scores of 7-8/10 only after
adding route/state contracts, page archetypes, and evidence gates. Codex was
unavailable.

**CODEX SAYS:** Not run. `codex` binary is not installed. No cross-model
consensus is claimed.

**DESIGN OUTSIDE VOICES — LITMUS SCORECARD:**

| Check                              | Claude subagent                                           | Codex | Consensus                        |
| ---------------------------------- | --------------------------------------------------------- | ----- | -------------------------------- |
| Brand unmistakable in first screen | Conditional: landing is distinctive, app shell is generic | N/A   | Provisional single-model finding |
| One strong visual anchor           | No across workspace surfaces                              | N/A   | Provisional single-model finding |
| Scannable by headlines only        | No on several pages                                       | N/A   | Provisional single-model finding |
| Each section has one job           | No on repeated card/filter pages                          | N/A   | Provisional single-model finding |
| Cards actually necessary           | No on several surfaces                                    | N/A   | Provisional single-model finding |
| Motion improves hierarchy          | Conditional fail; live pulses are decorative/false        | N/A   | Provisional single-model finding |
| Premium without decorative shadows | Unverified; source-only review                            | N/A   | N/A until browser evidence       |
| Hard rejections triggered          | Stacked cards, unclear action, preview theater            | N/A   | Single-model finding             |

### Pass 1: Information architecture — 4/10 → 8/10

**Examined:** `Sidebar.tsx:50-114`, `TopNav.tsx:21-64`, workspace layout,
current dashboard/career/tasks/search/email/settings pages, and
`docs/frontend/ux-journeys.md`.

**Findings:**

1. The navigation is route-first and outcome-second. Users must infer what
   matters from labels and page titles.
2. The product promise mixes personal career/memory, AI execution, enterprise
   administration, developer tools, feature flags, and vault operations without
   a clear primary persona.
3. Sidebar, TopNav, CommandCenter, EnterpriseGated, and docs maintain
   independent route concepts; billing is categorized differently in Sidebar and
   TopNav.
4. Current pages place equal-weight metrics and filters before the next action,
   especially career and tasks.

**Plan fix adopted:** Add persona/route/first-viewport/primary-action matrix and
page archetypes above. Require route manifest as the only source for navigation,
breadcrumbs, aliases, permissions, and command search.

### Pass 2: Interaction state coverage — 3/10 → 8/10

**Examined:** `career/loading.tsx`, `career/error.tsx`, generic boundaries,
`TopNav.tsx:99-109`, invite/security pages, jobs/capabilities mutations, and the
plan's state list.

**Findings:**

- The plan names states but does not define transition triggers, copy, actions,
  retry scope, freshness, or announcements.
- “No data,” “not connected,” “no permission,” “preview unavailable,” “provider
  failed,” and “stale cache” are currently easy to conflate.
- `TopNav` swallows notification errors; invite and security success are
  simulated; jobs/capabilities can show success after backend failure.
- Loading copy such as “Calibrating…” is not truthful for a fixture page.

**Plan fix adopted:** Add a route-state matrix with columns for trigger, visible
copy, available action, data mode, freshness, retry scope, mutation status,
announcement, test, and screenshot. Add a canonical mutation contract with
authoritative success, pending, conflict, unknown outcome, rollback/undo, and
receipt/history behavior.

### Pass 3: User journey and emotional arc — 3/10 → 7/10

**Examined:** signup/onboarding routes, chat/capabilities/approvals,
career/jobs/resume routes, workspace resolver/layout, and existing journey docs.

**Journey fixes adopted:**

- New user: signup → verification → resumable onboarding → first grounded value
  within 10 minutes → dashboard.
- Career user: target role → evidence-backed gap → resume/job action →
  application → status/outcome.
- AI user: prompt/context → active run → tool/step observation →
  evidence/citation → approval/result.
- Workspace user: workspace switcher → members/roles/invites → connected source
  → search → memory → audit/governance.
- Admin: incident/policy health → entitlement/role → audit/usage → recovery.

**Still unresolved:** education is named in metadata but has no complete
journey; the primary product identity must be chosen at the final gate.

### Pass 4: AI slop and interaction specificity — 3/10 → 7/10

**Examined:** `career/page.tsx:83-110`, `tasks/page.tsx:111-155`,
`search/page.tsx:140-279`, `help/page.tsx:182-230`, and the app's indigo/black
card vocabulary.

**Hard-rejection findings:**

- Generic stat-card/filter/card repetition across career, tasks, search, and
  help.
- No single obvious primary action on several surfaces.
- App UI is frequently a vertical stack of cards rather than a work surface.
- Pulse/animated indicators can imply live provider or agent health without a
  verified source.

**Plan fix adopted:** Use distinct archetypes, one dominant action per viewport,
progressive disclosure for dense data, explicit source/freshness labels, and
motion only for verified state transitions. Do not use fixed latency, “100%
success,” or “ingested” claims in production navigation.

### Pass 5: Design-system alignment — 3/10 → 7/10

**Examined:** `DESIGN.md`, `globals.css`, `tailwind.config.ts`,
`packages/ui-kit/src/tokens/index.ts`, current `packages/ui-kit/src/index.ts`,
and app wrappers.

**Findings:**

1. Three token authorities disagree: runtime CSS/Tailwind, UI-kit JSON, and
   design docs.
2. Runtime dark canvas is pure black while Tailwind comments say pure black is
   not the app background; documentation names alternate values/fonts.
3. UI-kit's newly exported components are not yet proven behaviorally safe.
   Clickable cards/rows, sortable headers, drawers, form labels, and focus
   return remain gaps.
4. App wrappers duplicate package primitives and local CSS component classes.

**Plan fix adopted:** Select one token authority before migration, add parity
tests, define a raw-palette/arbitrary-value allowlist, repair primitive
semantics, then migrate wrappers to re-exports. `outline` must be either a
supported canonical variant or removed from all callers.

### Pass 6: Responsive and accessibility — 3/10 → 7/10

**Examined:** workspace layout, Sidebar, capability views, email master/detail,
tables, `Drawer`, `DataTable`, `FormField`, `Card`, `StatCard`, and Playwright
route/width coverage.

**Plan breakpoint contract:**

| Width   | Required behavior                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------- |
| 320-414 | Single column; one primary action; list-to-detail navigation or drawer; no page-level horizontal scroll |
| 768     | Compact navigation; two columns only when comparison matters                                            |
| 1024    | Persistent sidebar and two-pane master/detail where applicable                                          |
| 1440    | Full workbench, table, inspector, and evidence panes                                                    |
| 2560    | Density cap and centered workbench; do not stretch card grids indefinitely                              |

**Accessibility fixes adopted:** route/state-generated axe coverage;
keyboard-only journeys; focus trap/restore for drawers and dialogs; semantic
buttons/links for clickable cards/rows; `aria-sort` and keyboard sorting;
programmatic labels/descriptions/errors; 44px touch targets; reduced-motion and
high-contrast evidence; 200% zoom/reflow checks.

### Pass 7: Unresolved design decisions

| Decision                  | If deferred                                                | Auto-decision for this review                                                                            | Gate status                  |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Primary product promise   | Personal, AI, and enterprise users get incompatible shells | Recommend personal memory/career first, enterprise as role-specific control plane                        | User challenge at final gate |
| First-value action        | New user wanders through setup                             | Require one grounded AI action or resume upload within 10 minutes                                        | Queued                       |
| Live/preview boundary     | Demo pages look operational                                | Move fixture surfaces to preview namespace or permission                                                 | Adopted                      |
| Token authority           | Theme drift and unknown classes persist                    | Use runtime CSS/Tailwind as migration source unless implementation proves generated UI-kit JSON is safer | Taste decision               |
| Page archetypes           | Every page becomes a card mosaic                           | Adopt archetype matrix                                                                                   | Adopted                      |
| Mobile master/detail      | Long stacked content and lost context                      | Route/drawer pattern per archetype                                                                       | Adopted                      |
| Destructive actions       | False success or unsafe native confirm                     | Canonical confirmation and receipt contract                                                              | Adopted                      |
| Education product promise | Metadata promises a journey with no pages                  | Remove promise or add a separately scoped learner journey                                                | User challenge at final gate |
| Admin placement           | Personal and governance navigation blur                    | Separate role-specific admin shell/entry point                                                           | Queued                       |

### Design state matrix required by the plan

| Surface archetype | Loading               | Empty               | Error                   | Success              | Partial/stale           | Permission             | Destructive                       |
| ----------------- | --------------------- | ------------------- | ----------------------- | -------------------- | ----------------------- | ---------------------- | --------------------------------- |
| Dashboard         | action-queue skeleton | no next action      | retry failed card       | server-backed action | per-card freshness      | role-filtered queue    | clear completed action with scope |
| Career            | roadmap skeleton      | no target role      | retry source            | saved strategy       | stale benchmark         | role policy            | archive roadmap                   |
| AI run            | run step skeleton     | no run              | retry/cancel            | receipt/citation     | step-level failure      | approval boundary      | stop/cancel                       |
| Search            | index status          | no matching results | provider retry          | deep link            | partial index/freshness | scope-filtered results | clear history only                |
| Files             | table/tree skeleton   | no files            | retry upload/processing | processing receipt   | failed processing       | source permission      | archive/delete with undo          |
| Settings          | section skeleton      | no settings         | validation/API error    | saved audit receipt  | stale config            | role policy            | revoke/delete with consequence    |
| Admin             | health skeleton       | no incidents        | retry source            | remediation receipt  | source-specific stale   | entitlement denied     | policy rollback                   |

### NOT in scope for design phase

| Deferred item                                       | Rationale                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| New marketing/landing visual direction              | The landing already has a distinct concept; the current task is application coherence.  |
| Pixel-level polish before token and state contracts | Polishing drifting primitives would multiply inconsistency.                             |
| New illustration/icon set                           | Existing icon strategy must first be audited and made coherent.                         |
| Broad animation redesign                            | Motion semantics and reduced-motion behavior must be defined before adding transitions. |
| Visual mockup approval                              | Designer binary unavailable; no approval is claimed.                                    |

### What already exists for design reuse

- `DESIGN.md` semantic token and typography intent.
- `globals.css` runtime theme, focus, skip-link, component, and high-contrast
  rules.
- `packages/ui-kit` core primitives and newly added navigation/data/AI
  components.
- Workspace shell and mobile sidebar focus/close behavior.
- Existing error, empty, loading, confirmation, status, and approval components.
- Existing Playwright axe/responsive harness and visual snapshot concept.

### Design implementation tasks

- [ ] **T1 (P0, human: ~4-8h / CC: ~30-60min)** — Route/IA — create persona
      matrix, page archetypes, and route/capability manifest.
  - Surfaced by: Design Pass 1 and F1-F3.
  - Files: `Sidebar.tsx`, `TopNav.tsx`, `CommandCenter.tsx`,
    `EnterpriseGated.tsx`, route tests, design docs.
  - Verify: every link resolves; each archetype has one primary action and
    mobile pattern.
- [ ] **T2 (P0, human: ~1-2d / CC: ~2-4h)** — State contract — add route-state
      and mutation-outcome matrix with live/preview metadata.
  - Surfaced by: Design Pass 2 and F4-F6/F14.
  - Files: shared state components, page error/empty/loading files, mutation
    hooks, fixtures.
  - Verify: exact state tests, retry/pending/conflict/unknown-outcome tests,
    screenshot coverage.
- [ ] **T3 (P0, human: ~2-4h / CC: ~30-60min)** — Primitive semantics — fix
      clickable cards/rows, sorting, drawer focus, form labels, and button
      defaults.
  - Surfaced by: Design Pass 5 and F11.
  - Files: UI-kit `Card`, `StatCard`, `DataTable`, `Drawer`, `FormField`,
    `Button`, app wrappers.
  - Verify: keyboard/focus/a11y unit tests and browser smoke.
- [ ] **T4 (P1, human: ~1d / CC: ~1-2h)** — Design token authority — select and
      enforce one token namespace with theme parity and raw-value lint.
  - Surfaced by: Design Pass 5 and F10.
  - Files: `globals.css`, `tailwind.config.ts`, UI-kit token files, `DESIGN.md`,
    CI.
  - Verify: dark/light/high-contrast token tests and unknown-class scan.
- [ ] **T5 (P1, human: ~1d / CC: ~1-2h)** — Responsive and a11y evidence —
      implement breakpoint matrix and route-generated checks.
  - Surfaced by: Design Pass 6 and F12-F13.
  - Files: layouts, capability/email/search pages, Playwright config/specs,
    accessibility script.
  - Verify: 320/375/768/1024/1440/2560 screenshots, keyboard, zoom, reduced
    motion, high contrast, axe.
- [ ] **T6 (P1, human: ~4-8h / CC: ~30-60min)** — Preview boundary — move or
      gate fixture pages and remove live-looking telemetry.
  - Surfaced by: Design Pass 2/4 and F5/F6/F8/F9.
  - Files: career, search, tasks, email, help, invite, account-locked, Sidebar,
    fixtures.
  - Verify: no fixture route is reachable as ordinary live navigation without a
    demo mode.
- [ ] **T7 (P2, human: ~1d / CC: ~1h)** — Design evidence ledger — record route,
      state, component, responsive, and a11y screenshots with source revision.
  - Surfaced by: Design completion requirements.
  - Files: external design/QA artifacts and CI output paths.
  - Verify: every claimed matrix cell links to a command and artifact.

### Design decision audit trail

| #   | Phase  | Decision                                                   | Classification           | Principle | Rationale                                             | Rejected                         |
| --- | ------ | ---------------------------------------------------------- | ------------------------ | --------- | ----------------------------------------------------- | -------------------------------- |
| 1   | Design | Use page archetypes and persona-specific first viewports   | Mechanical               | P1/P5     | Current screens lack consistent hierarchy             | More repeated card dashboards    |
| 2   | Design | Add executable route-state matrix                          | Mechanical               | P1        | State names alone do not guide implementation         | Generic global states only       |
| 3   | Design | Quarantine fixture pages from production navigation        | Mechanical               | P1/P4     | Demo telemetry and security claims create false trust | Keep all fixtures in Sidebar     |
| 4   | Design | Use runtime CSS/Tailwind as provisional token authority    | Taste                    | P5/P3     | It is the current runtime and lowest migration risk   | Silent dual authority            |
| 5   | Design | Require semantic keyboard primitives                       | Mechanical               | P1/P5     | Shared components are the blast radius                | Page-specific ARIA patches       |
| 6   | Design | Adopt route-generated a11y/responsive coverage             | Mechanical               | P1        | Hard-coded 12-route coverage misses new pages         | Continue partial manual matrix   |
| 7   | Design | Keep education out of current promise until journey exists | User challenge candidate | P1/P6     | No learner route or contract exists                   | Add another broad surface now    |
| 8   | Design | Do not generate mockups without designer binary            | Mechanical               | P6        | Fabricating visual approval would be false evidence   | Pretend text review is visual QA |

### Design completion summary

```text
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | DESIGN.md found; runtime and UI-kit drift    |
| Step 0               | Initial 4/10; focus all seven dimensions        |
| Pass 1  (Info Arch)  | 4/10 -> 8/10                                 |
| Pass 2  (States)     | 3/10 -> 8/10                                 |
| Pass 3  (Journey)    | 3/10 -> 7/10                                 |
| Pass 4  (AI Slop)    | 3/10 -> 7/10                                 |
| Pass 5  (Design Sys) | 3/10 -> 7/10                                 |
| Pass 6  (Responsive) | 3/10 -> 7/10                                 |
| Pass 7  (Decisions)  | 9 decisions: 6 adopted, 3 queued             |
+--------------------------------------------------------------------+
| NOT in scope         | written (5 items)                             |
| What already exists  | written                                     |
| TODOS.md updates     | repository TODOS.md absent; captured here      |
| Approved Mockups     | 0; designer unavailable                        |
| Decisions made       | 8 added to plan                               |
| Decisions deferred   | 3 at final gate                              |
| Overall design score | 4/10 -> 7.5/10                               |
| Outside voice        | Claude subagent; Codex unavailable            |
+====================================================================+
```

**Phase 2 complete.** Codex: unavailable. Claude subagent: 14 design concerns, 6
P0/P1 trust/accessibility gaps, and 3 product decisions queued. Consensus: 0/7
two-model confirmations; the single-model result is explicitly provisional.
Passing to Phase 2.5.

## Phase 2.5: Developer Experience Review

**Product type:** API/SDK plus internal frontend contributor surface, with a
developer portal and workspace automation controls. **Primary persona:**
backend/API integrator integrating Vaeloom from TypeScript or Python. Secondary
personas: frontend engineer and platform engineer. **Mode:** DX POLISH.
**Outside voice:** Claude subagent completed; Codex unavailable. The repository
changed during independent-agent inspection, so only findings re-verified in the
current local tree are promoted to high confidence. **Web reference check:**
current 2026 search results reinforce task-first quickstarts, runnable examples,
test/sandbox credentials, and preserving request IDs. External pages are
reference patterns, not evidence that Vaeloom already implements them.

### Step 0: DX investigation

#### Target developer persona

| Field             | Assessment                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Who               | Backend/API integrator consuming memories, agents, documents, and webhooks                                 |
| Context           | Starts from README/docs, needs credentials, workspace context, typed calls, and safe upgrades              |
| Tolerance         | Should reach one verified first call in under 10 minutes; currently static contract blockers prevent that  |
| Expects           | One canonical route, clear auth, copy-paste working example, actionable errors, and observable request IDs |
| Secondary         | Frontend engineer needs UI-kit contracts, route manifests, fixtures, and test commands                     |
| Platform engineer | Needs CI/release parity, health checks, image/build provenance, and rollback                               |

#### Developer empathy narrative

I open the README and see a broad monorepo with a short install and
`pnpm dev:web` instruction. That is a good first signal. I search for the SDK
because the developer portal advertises TypeScript, Python, Go, and REST. I copy
the TypeScript package name, then compare the example to the source. The example
calls `/api/v1/memory`, while the backend mounts `/api/v1/memories`; the client
has no workspace ID, and the API middleware requires a Bearer token even though
the SDK advertises `X-API-Key`. I would not discover these as deliberate product
limitations. I would discover them as a failed first request and then a second
failed request while trying to guess the response envelope. The portal adds more
uncertainty: it shows versions and quotas that do not match the repository,
generates key-like values in the browser, and persists them locally. By the time
I reach debugging, the web request helper has a correlation ID, but the SDK
turns 401/403/429 into generic strings and loses the request context needed to
find the answer. I need one reliable path: create a scoped key, choose a
workspace, make one grounded memory request, see the exact response, and follow
the same request ID into diagnostics. Without that, I cannot tell whether the
problem is my code, my auth, the workspace boundary, or a stale document.

#### Journey map

| Stage       | Developer does                         | Evidence today                                                      | Friction                                                                            | Plan status      |
| ----------- | -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| Discover    | README → docs → developer portal/SDK   | README, docs index, SDK READMEs, developer route                    | No task-first integration entry; portal inventory is not contract-derived           | Frictional       |
| Install     | `pnpm add`/`pip install`               | `sdk/typescript/README.md`, `sdk/python/README.md`                  | No verified registry/publication path in release workflow                           | Blocked/unproven |
| Auth        | Create API key, choose workspace       | `developer/page.tsx:71-95,139-163`; SDK headers `client.ts:42-49`   | Portal mixes BYOK and Vaeloom keys; SDK header not accepted by middleware           | Blocked          |
| Hello world | Create and search memory               | SDK paths `client.ts:53-75`; backend memory mount `main.py:431-436` | Singular/plural route mismatch, missing workspace context, response unwrap mismatch | Blocked          |
| Real usage  | Call agents/documents/webhooks         | Hand-maintained `api-client.ts`, direct fetches                     | Split auth, casing, error, CSRF, retry, and stream behavior                         | High risk        |
| Debug       | Read error and request ID              | Web helper has request ID; SDK throws generic errors                | SDK loses status/body/request ID; docs use stale prefixes                           | Partial          |
| Upgrade     | Read migration, install semver, verify | Versioning docs exist                                               | No package changelogs/migrations/compatibility gates or published artifacts         | Ineffective      |

#### TTHW assessment

**Task:** clean TypeScript project → create scoped key → select authorized
workspace → create one memory → search it → receive ID and request correlation.

| Metric            | Result                                                                                               | Evidence                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Current TTHW      | Unknown; static path is blocked                                                                      | No install/runtime run in this review; source-level mismatches are verified                    |
| Target p50        | <=10 minutes                                                                                         | DX POLISH target for an authenticated resource call                                            |
| Target p90        | <=20 minutes                                                                                         | Allows workspace and key provisioning variance                                                 |
| Completion target | >=90% unattended on supported matrix                                                                 | Must be measured, not asserted                                                                 |
| Current blockers  | Wrong route, missing workspace context, API-key mismatch, response mismatch, publication uncertainty | `sdk/typescript/src/client.ts`, `sdk/python/src/vaeloom/client.py`, `auth.py`, backend routers |

#### Reference benchmark

| Reference                | Pattern observed in current source search                                                          | Vaeloom gap                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Stripe API docs          | Test/sandbox credentials, copy-paste requests, exact errors with codes and doc links, request logs | No verified Vaeloom quickstart, request log, or machine-key lifecycle        |
| Supabase API keys        | Explicit key types, project context, one canonical setup path, rotation guidance                   | Developer portal conflates provider/BYOK keys with Vaeloom credentials       |
| 2026 onboarding research | TTFC/TTHW, under-five-minute first call, runnable examples, test mode, immediate feedback          | Current SDK route/auth/workspace blockers prevent the first call             |
| Vercel/CLI patterns      | Small focused command and template-based first success                                             | Vaeloom tooling is distributed across pnpm, uv, Nx, Docker, and SDK packages |

Reference links: `https://docs.stripe.com/keys`,
`https://docs.stripe.com/error-codes`,
`https://supabase.com/docs/guides/getting-started/api-keys`, and the 2026
onboarding references surfaced during the live search. These establish
comparison patterns only; they do not prove Vaeloom's current behavior.

### DX outside voices

**CLAUDE SUBAGENT (DX — independent review):** Rated current DX 2.3/10 and plan
coverage 3/10. It found route/auth/response mismatches, browser-generated key
behavior, stale portal inventory, non-executable docs, and no release
compatibility gate. It recommends a private SDK beta until contracts,
publication, install smoke, and migration gates are green. Codex was
unavailable.

**CODEX SAYS:** Not run. `codex` binary is not installed. No cross-model
consensus is claimed.

**DX DUAL VOICES — CONSENSUS TABLE:**

| Dimension                      | Claude subagent                                    | Codex | Consensus                        |
| ------------------------------ | -------------------------------------------------- | ----- | -------------------------------- |
| Getting started <10 min?       | Static blockers prevent first call                 | N/A   | Provisional single-model finding |
| API/SDK naming guessable?      | Route/auth/response contracts are inconsistent     | N/A   | Provisional single-model finding |
| Error messages actionable?     | SDK loses status/body/request ID                   | N/A   | Provisional single-model finding |
| Docs findable and complete?    | Large docs have stale routes and false inventory   | N/A   | Provisional single-model finding |
| Upgrade path safe?             | No package compatibility/migration gate            | N/A   | Provisional single-model finding |
| Dev environment friction-free? | Tooling/docs disagree on uv, env, and verification | N/A   | Provisional single-model finding |

### Pass 1: Getting started — 3/10 → 8/10

**Findings:** README install is short, but SDK publication and the first-call
contract are not proven. The developer portal advertises an install path that
cannot be trusted from source.

**Plan fix adopted:** Create one task-first quickstart per supported language,
beginning with raw HTTP or a deterministic sandbox endpoint, then add the SDK.
It must show exact install, key issuance, workspace selection, one request,
exact response, one error path, and a request ID. Do not require enterprise
access for the first successful call unless that is an explicit product
decision.

### Pass 2: API/CLI/SDK design — 2/10 → 8/10

**Findings:**

- TypeScript and Python clients call singular `/api/v1/memory`; backend exposes
  plural `/api/v1/memories`.
- Client config has `tenantId` but no `workspaceId`.
- SDK `X-API-Key` is not accepted by current auth middleware; provider/BYOK key
  UI is not a Vaeloom machine key.
- Response unwrapping differs between direct memory objects, paginated agents,
  and search results.
- `api-client.ts` is hand-maintained and direct fetch paths bypass shared
  behavior.

**Plan fix adopted:** Generate transport/models from the mounted OpenAPI
contract, wrap them in small resource facades, and make direct fetch a
deliberate allowlisted adapter. Add contract tests against a real local API
before publishing SDKs.

### Pass 3: Error messages and debugging — 3/10 → 8/10

**Findings:** SDK errors collapse 401/403/429 into generic messages and discard
response body, request ID, and remediation. Web direct fetches can swallow
failures. Webhook secret behavior differs between portal and backend.

**Plan fix adopted:** Define a structured error hierarchy: code, HTTP status,
message, field, request ID, docs URL, retryable flag, and safe details. Preserve
request IDs through SDK, portal, webhook delivery, and logs. Test exact
400/401/403/404/409/422/429/500 and timeout outcomes.

### Pass 4: Documentation and learning — 2/10 → 8/10

**Findings:** API examples use `/v1` paths while the app uses `/api/v1`; setup
references a missing verification script; docs mention TanStack Query while the
app uses SWR; examples are not executed in CI.

**Plan fix adopted:** One canonical OpenAPI-linked quickstart, generated
reference, executed curl/TypeScript/Python examples, and docs CI that compiles
or runs snippets. Separate tutorial, reference, migration, and troubleshooting
content.

### Pass 5: Upgrade and migration — 1/10 → 8/10

**Findings:** SemVer policy exists as a document, but no verified SDK changelog,
package publication, migration guide, codemod, or compatibility suite blocks
breaking route/auth changes.

**Plan fix adopted:** Release gate must compare OpenAPI, regenerate clients, run
contract tests, install packages, run consumer smoke, and publish migration
notes. Keep SDKs private/workspace-only until this passes.

### Pass 6: Developer environment and tooling — 4/10 → 7/10

**Findings:** pnpm/uv are pinned, but docs disagree on commands and environment
loading. Root `pnpm dev:be` uses bare uvicorn while project guidance requires
uv. TypeScript SDK has no tests, Python SDK is not integrated into backend CI,
and no setup doctor exists.

**Plan fix adopted:** Add a cross-platform setup/doctor command or verified dev
container, standard wrappers, environment preflight, and package-specific CI.
Keep Windows instructions explicit.

### Pass 7: Community and ecosystem — 2/10 → 5/10

**Findings:** The repository is proprietary and has generic issue templates. No
SDK-specific compatibility matrix, examples, or feedback loop is present. This
is a deliberate product choice, not a defect to solve by inventing a public
community.

**Plan fix adopted:** Document the private-beta/invite/partner model, add SDK
issue fields and supported-version matrix, and defer public ecosystem investment
until a real external-user policy exists.

### Pass 8: DX measurement and feedback — 1/10 → 7/10

**Findings:** Product onboarding telemetry exists, but no TTHW, install success,
first-call, time-to-resolution, upgrade success, or SDK adoption metrics exist.

**Plan fix adopted:** Instrument privacy-safe events: docs visit, key issued,
first request success, first request failure class, quickstart completion,
support issue, and upgrade success. Report p50/p90 by language and workspace
tier.

### DX scorecard

| Dimension            | Initial | Amended | What a 10 requires                                                   |
| -------------------- | ------: | ------: | -------------------------------------------------------------------- |
| Getting started      |    3/10 |    8/10 | Verified clean-machine quickstart under 10 minutes                   |
| API/CLI/SDK design   |    2/10 |    8/10 | Generated contract, ergonomic facades, stable auth/workspace context |
| Error/debugging      |    3/10 |    8/10 | Structured errors, request IDs, docs links, request inspection       |
| Docs/learning        |    2/10 |    8/10 | Executed examples, generated reference, searchable task docs         |
| Upgrade/migration    |    1/10 |    8/10 | Published semver, migrations, compatibility gates                    |
| Environment/tooling  |    4/10 |    7/10 | One setup/doctor path across OS and package managers                 |
| Community/ecosystem  |    2/10 |    5/10 | Clear private-beta/partnership model and feedback loop               |
| Measurement/feedback |    1/10 |    7/10 | TTHW/TTFC funnel, failure taxonomy, upgrade telemetry                |

### Magical moment

A developer creates a scoped key, copies one version-accurate TypeScript or
Python snippet, runs it against a real workspace, receives a memory ID and
search result, and sees the same correlation ID in the response, portal request
log, and webhook diagnostics without opening another troubleshooting document.

### DX implementation checklist

- [ ] Repair SDK route/response/workspace/auth contracts.
- [ ] Separate Vaeloom API keys from provider/BYOK keys.
- [ ] Add one canonical quickstart for TypeScript and Python.
- [ ] Execute examples in CI.
- [ ] Generate clients/models from the mounted OpenAPI contract.
- [ ] Add request IDs and structured errors to SDK and portal.
- [ ] Add package publication or clearly mark SDKs private/workspace-only.
- [ ] Add compatibility, migration, and deprecation gates.
- [ ] Add setup/doctor and Windows verification.
- [ ] Instrument TTHW/TTFC and developer feedback.
- [ ] Update UI-kit README to match public exports and semantics.

### DX implementation tasks

- [ ] **DX-01 (P0, human: ~1-2d / CC: ~1-2h)** — Developer portal — remove false
      SDK/Go/v2 inventory, static quotas, browser key generation, and mixed BYOK
      semantics.
  - Surfaced by: DX Pass 2, Pass 4, and TTHW blockers.
  - Files: `developer/page.tsx`, `api-client.ts`, developer docs.
  - Verify: source-derived version manifest, no browser-generated secret, exact
    live/preview labels.
- [ ] **DX-02 (P0, human: ~4-7d / CC: ~4-6h)** — SDK contracts — repair routes,
      workspace context, auth, response models, pagination, and
      TypeScript/Python parity.
  - Surfaced by: DX Pass 2 and static TTHW blockers.
  - Files: `sdk/typescript`, `sdk/python`, OpenAPI contract tests, backend route
    schemas.
  - Verify: local API contract suite for create/get/search/list and exact
    errors.
- [ ] **DX-03 (P0, human: ~5-8d / CC: ~4-6h)** — Machine auth — create
      server-issued, scoped, revocable Vaeloom keys and wire middleware.
  - Surfaced by: DX Pass 2 and security findings.
  - Files: API key routes/service/middleware, developer portal, tests.
  - Verify: key shown once; cross-workspace and revoked-key requests return
    exact denials.
- [ ] **DX-04 (P0, human: ~5-8d / CC: ~4-6h)** — Typed transport — generate
      OpenAPI transport/types and centralize direct-fetch exceptions.
  - Surfaced by: DX Pass 2 and Pass 3.
  - Files: `api.ts`, `api-client.ts`, generated client, stream/upload adapters.
  - Verify: drift check, auth/CSRF/correlation/error parity tests.
- [ ] **DX-05 (P0, human: ~2-4d / CC: ~2h)** — Install truth — publish SDKs or
      label them private/workspace-only; add registry smoke tests.
  - Surfaced by: DX Pass 1 and Pass 5.
  - Files: package manifests, release workflow, SDK READMEs, portal.
  - Verify: clean install and import for each supported package.
- [ ] **DX-06 (P0, human: ~3-5d / CC: ~2-3h)** — Quickstart — implement one
      tested TypeScript/Python first-success path with exact responses and
      errors.
  - Surfaced by: DX Pass 1, Pass 3, Pass 4.
  - Files: developer docs, examples, CI.
  - Verify: CI executes the exact snippets against an isolated test workspace.
- [ ] **DX-07 (P1, human: ~4-6d / CC: ~2-3h)** — Compatibility — add OpenAPI
      diff, generated-client, package-install, migration, and deprecation gates.
  - Surfaced by: DX Pass 5.
  - Files: CI, release workflow, changelog/migrations.
  - Verify: breaking contract blocks release.
- [ ] **DX-08 (P1, human: ~4-7d / CC: ~3-4h)** — Debug portal — add redacted
      request logs, correlation search, quota truth, webhook delivery
      inspection/replay.
  - Surfaced by: DX Pass 3 and developer portal findings.
  - Files: developer/webhook pages, API observability endpoints, tests.
  - Verify: request ID links to redacted server trace and replay has explicit
    side effects.
- [ ] **DX-09 (P1, human: ~3-5d / CC: ~2h)** — Tooling — add setup/doctor,
      standard pnpm/uv wrappers, and Windows checks.
  - Surfaced by: DX Pass 6.
  - Files: package scripts, Makefile, docs, CI.
  - Verify: clean Windows and Linux setup command.
- [ ] **DX-10 (P1, human: ~3-5d / CC: ~2h)** — DX telemetry — measure install,
      first call, TTHW, failures, time-to-resolution, and upgrades.
  - Surfaced by: DX Pass 8.
  - Files: analytics events, dashboard, privacy policy.
  - Verify: cohort report with no secrets or message bodies.
- [ ] **DX-11 (P1, human: ~2-4d / CC: ~1-2h)** — UI-kit DX — synchronize
      README/specs with exports and add component behavior/a11y examples.
  - Surfaced by: DX Pass 6 and design-system findings.
  - Files: `packages/ui-kit/README.md`, component docs/tests.
  - Verify: import smoke and keyboard/focus examples.
- [ ] **DX-12 (P2, human: ~5-10d / CC: ~3-5h)** — CLI — add focused `login`,
      `workspace use`, `memory create/search`, `request logs`, and
      `webhook test` only after SDK path is green.
  - Surfaced by: DX scope decision.
  - Files: CLI package, release/docs.
  - Verify: non-interactive help and one sandbox workflow.

### DX decision audit trail

| #   | Phase | Decision                                                             | Classification | Principle | Rationale                                     | Rejected                                      |
| --- | ----- | -------------------------------------------------------------------- | -------------- | --------- | --------------------------------------------- | --------------------------------------------- |
| 1   | DX    | Use mounted OpenAPI as machine contract authority                    | Mechanical     | P1/P4     | SDK paths and response models already diverge | Maintain handwritten clients                  |
| 2   | DX    | Keep SDKs private until publication/contract gates pass              | Mechanical     | P6        | Current install claims are unverified         | Advertise unregistered packages as public     |
| 3   | DX    | Separate Vaeloom API keys from provider/BYOK credentials             | Mechanical     | P1/P4     | Different trust and lifecycle semantics       | Reuse provider key endpoint                   |
| 4   | DX    | Make raw HTTP quickstart precede SDK installation                    | Taste          | P5/P1     | Fewer dependencies improve first success      | SDK-only first path                           |
| 5   | DX    | Use external backend/API integrator as primary persona               | Taste          | P6        | Docs and portal target integrators            | Treat all developers as frontend contributors |
| 6   | DX    | Add a CLI only after SDK and auth are green                          | Mechanical     | P2/P5     | Avoid a second broken surface                 | Build full CLI immediately                    |
| 7   | DX    | Instrument TTHW/TTFC with privacy-safe telemetry                     | Mechanical     | P1        | Current DX is unknown and unmeasured          | Infer success from support silence            |
| 8   | DX    | Defer public community program until distribution policy is explicit | Mechanical     | P3        | Repo is proprietary                           | Promise open-source contribution path         |

### DX completion summary

```text
+====================================================================+
|            DX PLAN REVIEW — COMPLETION SUMMARY                       |
+====================================================================+
| Product type         | API/SDK + internal frontend contributor          |
| Persona              | Backend/API integrator, secondary FE/platform    |
| Initial score        | 2.3/10 current DX; 3/10 plan coverage            |
| Mode                 | DX POLISH                                        |
| Getting started      | 3/10 -> 8/10                                     |
| API/CLI/SDK          | 2/10 -> 8/10                                     |
| Error/debugging      | 3/10 -> 8/10                                     |
| Docs/learning        | 2/10 -> 8/10                                     |
| Upgrade/migration    | 1/10 -> 8/10                                     |
| Environment/tooling  | 4/10 -> 7/10                                     |
| Community/ecosystem  | 2/10 -> 5/10                                     |
| Measurement/feedback | 1/10 -> 7/10                                     |
| TTHW                 | Unknown; static blockers; target p50 <=10m      |
| Magical moment       | scoped key -> real workspace -> first result     |
| Implementation tasks | 12                                               |
| Outside voice        | Claude subagent; Codex unavailable                |
| Unresolved choices   | 5 product/DX decisions queued at final gate      |
+====================================================================+
```

**Phase 2.5 complete.** DX overall: 2.3/10 current, 3/10 plan coverage. TTHW:
unknown and statically blocked, target p50 <=10 minutes. Codex unavailable;
Claude subagent found 12 actionable workstreams. Passing to Phase 3, the
required engineering gate, which will review the final amended plan.

## Phase 3: Engineering Review and Final Shipping Gate

**Verdict:** NO-GO for production or enterprise readiness. CONDITIONAL GO for a
truth-first stabilization program. **Outside voice:** Claude subagent completed;
Codex unavailable. This is single-model engineering corroboration, not two-model
consensus. **Current local verification:** web typecheck passed; UI-kit
typecheck passed; web lint passed with warnings; UI-kit lint failed with 5
errors and 56 warnings; web Jest passed 57/57; UI-kit Jest passed 5/5; web build
passed once; Playwright `--list` found 76 tests in 8 files but no E2E run was
executed. These commands do not clear the release gate. **Snapshot warning:**
the independent reviewer observed a different worktree state. The current local
tree remains collaborative and must be snapshotted and rechecked before
implementation.

### Step 0: Scope challenge and reuse

The plan is executable only as a staged stabilization and contract program, not
as a route-by-route visual expansion. Existing code already supplies a Next
shell, live API surface, SWR, UI-kit primitives, auth/recovery endpoints, and a
real Playwright harness. Rebuilding these would add risk. The minimum complete
sequence is:

```text
1. quarantine false-success/preview surfaces
2. secure browser session and repair reset/lockout
3. enforce organization RBAC and identity-bound invitations
4. establish route/capability/data-mode/OpenAPI contracts
5. unify token/UI-kit primitives and transport
6. replace false-green tests with generated route/state coverage
7. repair Docker/CI/Kubernetes/rollback and prove RLS
8. add telemetry, budgets, and release evidence
```

The complexity smell is real: the user-facing scope touches frontend, UI-kit,
API auth, organization authorization, SDKs, CI, deployment, and PostgreSQL. That
is not a reason to rewrite everything; it is a reason to freeze new surface
breadth until the trust and contract boundaries are green.

### Architecture review

```text
                    +----------------------------+
                    | Route + capability manifest|
                    | dataMode: live/preview/etc |
                    +-------------+--------------+
                                  |
       +--------------------------+--------------------------+
       |                          |                          |
  +----v-----+             +------v------+             +-----v-----+
  | Sidebar  |             | TopNav      |             | Command   |
  | breadcrumbs / E2E route generation                  | center    |
  +----+-----+             +------+------+             +----+-----+
       |                          |                          |
       +--------------------------+--------------------------+
                                  |
                    +-------------v--------------+
                    | Next route/BFF/session    |
                    | HttpOnly cookies + CSRF   |
                    | refresh rotation + IDs    |
                    +-------------+--------------+
                                  |
                    +-------------v--------------+
                    | FastAPI auth + policy     |
                    | RLS + tenant/workspace    |
                    +-------------+--------------+
                                  |
          +-----------------------+------------------------+
          |                       |                        |
  +-------v--------+      +-------v--------+       +-------v--------+
  | JSON/OpenAPI   |      | Multipart      |       | SSE/stream      |
  | generated      |      | uploads        |       | typed adapter    |
  +-------+--------+      +-------+--------+       +-------+--------+
          |                       |                        |
          +-----------------------+------------------------+
                                  |
                    +-------------v--------------+
                    | DB / S3 / providers        |
                    +----------------------------+
```

**Architecture findings:**

- **[P0, confidence 10/10]** Browser storage exposes refresh credentials at
  `api.ts:44,64-80,109-135`; OAuth cookies are not HttpOnly/Secure at
  `auth/callback/route.ts:95-107`.
- **[P0, confidence 10/10]** Password reset is not delivered, logs the raw token
  at `auth_service.py:958-970`, and does not clear lockout at
  `auth_service.py:1007-1015`; the frontend claims recovery succeeded.
- **[P0, confidence 9/10]** Refresh rotation marks a session `ROTATED` and
  flushes before issuing a replacement at `auth_service.py:527-550,586-594`;
  concurrent requests need an atomic one-winner test.
- **[P0, confidence 9/10]** Organization mutation handlers call tenant context
  but no role permission check at `organizations.py:78-283`; exact role denial
  tests are absent.
- **[P0, confidence 9/10]** Invitation acceptance adds the member before marking
  the invitation accepted and does not compare invited email with authenticated
  identity at `organization_service.py:427-474`.
- **[P0, confidence 10/10]** SDK API-key headers are not accepted by
  `auth.py:75-79`; the portal's provider-key surface is not a valid Vaeloom
  machine-key lifecycle.
- **[P0, confidence 9/10]** Organization API returns `{items,total}` while
  frontend expects arrays; this is a runtime contract failure in
  `organizations.py:66-75,160-170` versus `api-client.ts:3198-3228` and
  `organizations/page.tsx:230-273`.
- **[P0, confidence 9/10]** `api.ts`, `api-client.ts`, agent streaming, and
  Trigger.dev tasks do not share one transport contract. Agent detail reads the
  wrong token key at `agents/[agentId]/page.tsx:109-122`.
- **[P1, confidence 9/10]** RLS migration `0053` uses `_safe()` to swallow
  policy failures at lines 37-47 and restores `USING (true)` for seven
  operational tables at lines 191-209; staging re-proof is explicitly required
  at lines 23-24.

### Section 2: Error and rescue map

| Codepath            | Nil/empty                              | Conflict/duplicate                               | Timeout/upstream error                  | User rescue                                               |
| ------------------- | -------------------------------------- | ------------------------------------------------ | --------------------------------------- | --------------------------------------------------------- |
| Session refresh     | no session -> login                    | simultaneous refresh -> one winner/revoke family | provider/store timeout -> unknown state | retry once, then re-auth; never clear on transient outage |
| Password reset      | missing/expired token -> explicit 400  | consumed token -> 400                            | email/store failure -> no false success | resend with safe generic copy                             |
| Invitation          | invalid/expired token -> 404/410 UX    | wrong account/replay -> 403/409                  | concurrent consume -> one winner        | contact admin/transfer policy                             |
| Organization writes | missing org/tenant -> 400/404          | role change/conflict -> 403/409                  | DB timeout -> unknown outcome           | refresh and audit receipt                                 |
| SDK request         | no key/workspace -> typed config error | idempotency/replay -> structured conflict        | timeout -> request ID + retry hint      | docs link and request inspection                          |
| Stream/upload       | missing file/stream -> 400             | duplicate job -> idempotent status               | disconnect -> resumable/partial         | show failed slice and retry only it                       |
| Route data          | empty list -> intentional empty        | stale cache -> stale marker                      | API failure -> named error              | retry scope and safe navigation                           |

### Section 3: Security and threat model

Release blockers are security blockers, not frontend polish:

- No browser-readable refresh token.
- No raw reset/OAuth code/token logging.
- No reset success without verifiable delivery.
- No lockout bypass through password reset.
- No organization mutation without role policy.
- No invitation acceptance without identity binding and atomic consumption.
- No API-key advertisement without hashed server issuance, expiry, revocation,
  scopes, tenant/workspace enforcement, and negative tests.
- No RLS release claim until current-commit live PostgreSQL proof covers login,
  verify, invite, workers, and cross-tenant denial.
- No UI gate is treated as authorization; backend policy/RLS remains
  authoritative.

### Section 4: Data flow and interaction edge cases

```text
Input (URL/body/file/stream)
        |
        v
Schema + auth + CSRF + capability check
        |             |              |
        | nil         | invalid      | denied
        v             v              v
    named 400     named 422       exact 401/403
        |
        v
Idempotency/transaction/atomic state transition
        |
   +----+----------+-----------+
   |                |           |
 success          conflict     timeout
   |                |           |
 receipt        server diff   unknown outcome
   |                |           |
   +----------------+-----------+
                    |
              typed response + audit + request ID
```

Required edge cases: double-click, stale page, stale CSRF, concurrent refresh,
concurrent invite acceptance, duplicate upload, partial stream failure,
workspace switch mid-request, logout mid-request, deleted resource, 429 retry,
500 retry, and rollback/unknown outcome. Every mutation must state whether it is
optimistic, server-authoritative, idempotent, reversible, or audit-only.

### Section 5: Code quality review

- **DRY:** one transport boundary, one route/capability registry, one data-mode
  contract, one mutation-state contract, one token authority, one primitive
  semantic contract.
- **Naming:** replace “capabilities”/“agents” overlap with explicit resource
  roles; name `dataMode` and `sourceStatus` rather than hiding fixtures in page
  code.
- **Error handling:** remove swallowed errors and local optimistic success. Use
  typed status classes and preserve request IDs.
- **Complexity:** `api-client.ts` is 3,702 lines; split generated transport,
  resource facades, streams/uploads, and compatibility adapters rather than
  adding more methods.
- **Primitive contract:** `Button`, `DataTable`, `Drawer`, `FormField`, `Card`,
  `StatCard`, and new AI components need behavior tests, not export-only tests.
- **Current quality results:** web typecheck passed; UI-kit typecheck passed;
  web lint returned warnings including missing hook dependencies and sensitive
  console statements; UI-kit lint failed with 5 errors; Jest passed but emitted
  React `act(...)` warnings in `ConnectorsView` tests.

### Section 6: Test review

**Test framework detection:** Jest/React Testing Library for web and UI-kit;
Playwright for real API/browser flows; pytest for backend; Kustomize for
manifests. Web tests are excluded from `apps/web/tsconfig.json:10-12`, so
production typecheck does not typecheck tests.

**Test diagram:**

```text
CODE PATHS                                      USER FLOWS
[+] BFF/session                                 [+] Signup -> verify -> onboarding
  |-- no token                                   [GAP] first value within 10m
  |-- refresh race                               [+] Login/MFA/logout
  |    [GAP] concurrent one-winner               [GAP] reset email -> reset -> login
  |-- CSRF expired                               [GAP] lockout recovery
  `-- server logout/revoke-all                  [GAP] wrong-account/replayed invite
[+] route/capability/dataMode                  [+] workspace switch/cache isolation
  |-- live route                                 [GAP] every nav target resolves
  |-- preview route                              [+] search -> result detail
  |-- disabled capability                        [GAP] no dead fixture links
  `-- forbidden/not-found                       [+] career -> resume/jobs/application
[+] API transport                              [+] AI run -> step -> evidence -> approval
  |-- JSON                                        [GAP] double stop/approve
  |-- multipart                                   [+] files upload -> process -> download
  |-- SSE                                         [GAP] stream disconnect/retry
  `-- 400/401/403/404/409/422/429/500             [+] admin role/policy/audit
[+] organization auth                          [+] developer key -> request -> logs
  |-- viewer/member/lead/admin                   [GAP] key shown once/revoked
  |-- cross-tenant                               [GAP] SDK first call
  `-- invite concurrency                         [GAP] upgrade migration
[+] RLS/live PostgreSQL                        [+] deploy -> smoke -> rollback
  |-- login/verify/invite                         [GAP] immutable image/digest
  |-- scheduler/worker                            [GAP] health and auth after rollback
  `-- cross-tenant denial
[+] UI primitives                              [+] all route/state a11y
  |-- keyboard/focus/labels                     [GAP] full WCAG A/AA route scan
  `-- touch/zoom/reduced-motion                   [GAP] 320-2560 visual evidence
```

**Existing coverage:** web Jest 57/57, UI-kit Jest 5/5, Playwright source list
76 tests. **Gaps:** new routes/states, SDK tests, contract tests, role matrix,
concurrent refresh/invite, RLS live proof, full E2E execution, all-impact axe,
gating visual comparison, Docker/deploy/rollback, bundle/CWV gates.

**Test plan artifact:**
`C:\Users\Dell\.gstack\projects\Driftloom-Vaeloom\Dell-master-eng-review-test-plan-20260924-231500.md`
contains the QA-facing route, state, security, and delivery checklist.

### Section 7: Performance review

- Current build output: landing first-load JS 332 kB, capabilities 258 kB,
  profile 182 kB. These are measured build outputs, not field performance.
- `ChatWindow`, capability panes, and developer pages are large client surfaces.
  Split by route and interaction after correctness contracts are fixed.
- Add route budgets and measured p50/p95 navigation, LCP, INP, CLS, stream
  latency, upload latency, and 200% zoom behavior.
- No N+1 database claim is made from frontend code alone; API query profiling is
  required for live endpoint timing.
- Cache all SWR keys by user, tenant, workspace, region, and capability; purge
  on logout/workspace switch; avoid static fixture payloads in production
  bundles.

### Section 8: Observability and debuggability

- Frontend error tracking is console-only; Web Vitals is a no-op without a
  destination.
- Add release marker, route, workspace-safe correlation, provider freshness,
  auth/session outcome, capability denial, mutation unknown-outcome, and Web
  Vitals metrics.
- Redact OAuth codes, tokens, secrets, email bodies, document content, and
  prompt payloads.
- Add a request inspector for developers with redacted payloads and webhook
  delivery replay with explicit side effects.

### Section 9: Deployment and rollout review

1. Align workflows to `master` or deliberately change the repository default
   branch.
2. Build web/API images from contexts that contain the files they copy.
3. Set `CI=true` and assert `.next/standalone` exists.
4. Use immutable tested image digests; do not deploy `latest`.
5. Align API port, `DATABASE__URL`, internal API URL, ingress/network policy,
   health probes, quotas, and replica counts.
6. Validate Kustomize output semantically, not only by successful render.
7. Deploy to ephemeral staging, run auth/org/RLS smoke, then deploy and rollback
   with the same smoke suite.
8. Make load-test threshold failures fail the job; current print-only behavior
   is not a gate.
9. Re-prove current-commit PostgreSQL RLS before production.

### Section 10: Long-term trajectory

Reversibility is 2/5 for broad implementation and 4/5 for staged stabilization.
The canonical registries and transport boundary create platform leverage;
without them, every new page repeats security, state, and navigation debt. The
plan should leave behind reusable contracts, not only new screens.

### Worktree parallelization

| Step | Modules                                             | Depends on              | Lane |
| ---- | --------------------------------------------------- | ----------------------- | ---- |
| A    | auth/BFF, API auth/reset/session                    | none                    | A    |
| B    | organizations/RLS/invites, API tests                | none or contract freeze | B    |
| C    | OpenAPI generation, web client, SDKs                | contract decisions      | C    |
| D    | route/capability/data-mode manifest, Sidebar/TopNav | C route contract        | D    |
| E    | UI-kit primitives/tokens and app wrapper migration  | C/D contracts           | E    |
| F    | Jest/Playwright/a11y/visual coverage                | A-E behavior contracts  | F    |
| G    | Docker/CI/Kubernetes/rollback/RLS staging proof     | A-C and infra decisions | G    |
| H    | telemetry, budgets, docs/evidence                   | F/G                     | H    |

**Execution order:** launch A and B in separate lanes after a short contract
freeze; then C; D/E can proceed in parallel after C; F follows the first
vertical slice; G follows C and can run alongside F; H is last. A and B touch
API auth/organization, while E touches `packages/ui-kit`, so no direct file
conflict. F and G may conflict on CI files, coordinate or serialize.

### NOT in scope

| Item                                                          | Rationale                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| New product pages beyond live/capability-backed stabilization | The current surface already has breadth; trust and state are the blockers.     |
| Full career/email/task backend persistence                    | Product contracts are not defined in this plan.                                |
| Public SDK ecosystem launch                                   | Private beta and contract gates come first.                                    |
| Broad refactor of every backend module                        | Eng review owns the directly affected trust/contract blast radius only.        |
| New telemetry vendor selection                                | Instrument privacy-safe events first; vendor is a separate operational choice. |

### What already exists

- FastAPI auth, refresh, reset, lockout, organization, invitation, and API-key
  service foundations.
- Next.js App Router, workspace layout, SWR, theme, and real API clients.
- UI-kit core primitives and current app wrappers.
- OpenAPI spec, route inventory, Jest, Playwright, axe, Docker, Kustomize, CI,
  and RLS test infrastructure.
- Exact backend test and security infrastructure to extend rather than replace.

### Failure-mode registry

| ID   | Failure                      | Test                                     | Handling                                    | User impact                     | Status       |
| ---- | ---------------------------- | ---------------------------------------- | ------------------------------------------- | ------------------------------- | ------------ |
| E-01 | Refresh race                 | No concurrent test                       | Atomic rotation + family revoke             | Account/session compromise      | Critical gap |
| E-02 | Reset delivery absent        | Focused reset tests fail                 | Transactional email + durable token         | False recovery/lockout deadlock | Critical gap |
| E-03 | Wrong-account invite         | No identity-binding matrix               | Compare normalized email + atomic consume   | Unauthorized membership         | Critical gap |
| E-04 | Organization role bypass     | No endpoint role matrix                  | Permission dependency on mutations          | Tenant privilege escalation     | Critical gap |
| E-05 | JS-readable refresh token    | No storage security gate                 | BFF/HttpOnly/Secure cookies                 | XSS credential theft            | Critical gap |
| E-06 | SDK route/auth mismatch      | SDK has no tests                         | OpenAPI contract suite                      | First call blocked              | Critical gap |
| E-07 | RLS policy failure swallowed | Live proof not run current commit        | Fail migrations; staging negative matrix    | Cross-tenant exposure           | Critical gap |
| E-08 | E2E false green              | Conditional assertions and direct goto   | Generated route coverage, exact final state | False readiness                 | Critical gap |
| E-09 | Deployment topology mismatch | Kustomize only; no Docker/manifest smoke | Immutable image, health and rollback smoke  | Broken/wrong release            | Critical gap |
| E-10 | UI state false success       | No route/state matrix                    | Data mode + authoritative mutation contract | Trust loss                      | Critical gap |
| E-11 | Primitive a11y failure       | Export-only tests                        | Rendered keyboard/focus tests               | Unusable UI                     | High         |
| E-12 | Build flake                  | One independent build attempt failed     | Repeat clean builds in CI                   | Nondeterministic release        | High         |

### Eng implementation tasks

- [ ] **E-01 (P0, human: ~1-2d / CC: ~2-4h)** — Session boundary — move browser
      auth to HttpOnly Secure same-origin session/BFF and add refresh/logout
      concurrency tests.
  - Files: `api.ts`, OAuth callback, `useAuth.tsx`, Next routes, backend auth
    service/routes/tests.
  - Verify: no refresh token in browser storage/JS; exact concurrent and
    revocation tests.
- [ ] **E-02 (P0, human: ~2-4d / CC: ~3-5h)** — Recovery — implement durable
      reset delivery, one-use tokens, lockout clearing, and safe UI outcomes.
  - Files: `auth_service.py`, auth routes/pages, email service, security tests.
  - Verify: 423→email→reset→login, failed delivery, replay, expiry, wrong token.
- [ ] **E-03 (P0, human: ~2-3d / CC: ~2-4h)** — Organizations — enforce role
      policy on every mutation and atomically bind/consume invitations.
  - Files: organization router/service, frontend organizations/invite pages,
    auth/RLS tests.
  - Verify: viewer/member/lead/admin matrix, wrong email, cross-tenant,
    concurrent accept.
- [ ] **E-04 (P0, human: ~3-5d / CC: ~4-6h)** — Contracts — generate typed
      transport from OpenAPI and repair SDK routes/auth/response models.
  - Files: `api.ts`, `api-client.ts`, SDKs, OpenAPI generation, contract tests.
  - Verify: mounted-route contract suite and local API consumer smoke.
- [ ] **E-05 (P0, human: ~1-2d / CC: ~1-2h)** — Data modes — create
      route/capability/data-mode manifest and quarantine preview surfaces.
  - Files: Sidebar, TopNav, CommandCenter, fixtures/new routes, route tests.
  - Verify: production navigation has no preview route and all links resolve.
- [ ] **E-06 (P0, human: ~2-4d / CC: ~3-5h)** — Test gate — replace conditional
      E2E assertions, add full route/state/a11y/visual coverage.
  - Files: Playwright config/specs, accessibility scripts, Jest configs, CI.
  - Verify: exact status/URL assertions, all routes, all A/AA axe findings,
    gating visual comparison.
- [ ] **E-07 (P0, human: ~2-4d / CC: ~2-4h)** — Delivery — repair
      Docker/CI/Kubernetes contexts, env names, ports, health, immutable images,
      quotas, and rollback smoke.
  - Files: Dockerfiles, workflows, Compose, Kustomize, `next.config.js`,
    deployment scripts.
  - Verify: build images, schema/manifest validation, deploy/auth/RLS smoke,
    rollback smoke.
- [ ] **E-08 (P0, human: ~1-2d / CC: ~1-2h)** — RLS proof — make policy
      migration failures fatal and re-run live PostgreSQL negative matrix.
  - Files: `0052`, `0053`, RLS test harness/evidence.
  - Verify: login, verify, invite, worker, scheduler, and cross-tenant matrix on
    current commit.
- [ ] **E-09 (P1, human: ~1-2d / CC: ~1-2h)** — UI-kit — fix 5 lint errors,
      primitive semantics, token parity, and behavior tests.
  - Files: `packages/ui-kit` and wrappers.
  - Verify: typecheck, lint, Jest, browser keyboard/focus smoke.
- [ ] **E-10 (P1, human: ~1-2d / CC: ~1h)** — Telemetry/performance — add
      release markers, privacy-safe errors/Web Vitals, and route budgets.
  - Files: error tracking, web vitals, CI/config.
  - Verify: redaction tests, p50/p95/CWV/bundle gates.

### Eng decision audit trail

| #   | Phase | Decision                                                         | Classification | Principle | Rationale                                               | Rejected                     |
| --- | ----- | ---------------------------------------------------------------- | -------------- | --------- | ------------------------------------------------------- | ---------------------------- |
| 1   | Eng   | Treat backend/delivery as in-scope release blockers              | Mechanical     | P1        | Frontend cannot certify around auth/RLS/deploy failures | Frontend-only release gate   |
| 2   | Eng   | Use atomic refresh rotation and concurrent test                  | Mechanical     | P1        | Current sequence is race-prone                          | Rely on sequential test      |
| 3   | Eng   | Enforce org RBAC and identity-bound invitations                  | Mechanical     | P1        | Current mutations lack role checks                      | UI-only gating               |
| 4   | Eng   | Generate transport/models from OpenAPI                           | Mechanical     | P1/P4     | Hand-maintained clients already drift                   | Add more handwritten methods |
| 5   | Eng   | Physically separate preview and live data                        | Mechanical     | P1        | Demo badges do not prevent false trust                  | Badge-only labeling          |
| 6   | Eng   | Make RLS migration failures fatal                                | Mechanical     | P1        | Swallowed policy errors hide deployment risk            | Best-effort policy loop      |
| 7   | Eng   | Use immutable image digests and rollback smoke                   | Mechanical     | P6        | `latest` cannot prove tested artifact                   | Mutable latest               |
| 8   | Eng   | Treat UI-kit lint/test warnings as P1 until contract repaired    | Mechanical     | P1        | Current 5 errors block canonical package                | Ignore warnings              |
| 9   | Eng   | Keep public CLI deferred until SDK path is green                 | Mechanical     | P2/P5     | Avoid a second broken integration surface               | Build CLI now                |
| 10  | Eng   | Preserve current user work and re-snapshot before implementation | Mechanical     | P6        | Collaborative dirty tree is active work                 | Reset or overwrite           |

### Eng completion summary

```text
+====================================================================+
|              ENGINEERING PLAN REVIEW — COMPLETION SUMMARY            |
+====================================================================+
| Step 0 Scope Challenge        | executable only as staged stabilization |
| Architecture Review           | 9 P0/P1 issues                         |
| Code Quality Review           | 6 issues; current lint/test evidence    |
| Test Review                   | diagram produced, 12 major gaps         |
| Performance Review            | 5 issues; build sizes measured           |
| Security Review               | 7 P0 blockers                           |
| Observability/Deploy Review   | 9 risks                                 |
| Failure modes                 | 12 total, 10 critical gaps               |
| Parallelization               | 8 lanes; A/B then C then D/E/F/G/H      |
| NOT in scope                  | written (5 items)                       |
| What already exists           | written                                 |
| Test plan artifact            | written externally                      |
| Implementation tasks          | 10                                     |
| Outside voice                 | Claude subagent; Codex unavailable      |
| Current verdict               | NO-GO; conditional stabilization       |
+====================================================================+
```

**Phase 3 complete.** Codex: unavailable. Claude subagent: 10 P0 release
blockers, 12 major test gaps, 7 security blockers, and 8 implementation lanes.
Consensus: 0/6 two-model confirmations. Passing to Phase 4 final gate.

## Cross-Phase Themes

- **Trust before breadth:** CEO, design, and engineering all found that
  simulated success and route count cannot substitute for honest behavior and
  recovery.
- **One contract boundary:** CEO, DX, and engineering all found route,
  capability, token, API, and data-mode ownership drift as a shared root cause.
- **Evidence before claims:** all phases found stale or overbroad documentation
  and test results that could create false confidence.
- **Backend authority:** CEO, DX, and engineering all found that browser/UI
  state cannot safely stand in for auth, RLS, API-key, invitation, or policy
  enforcement.
- **Preview isolation:** CEO and design both found fixture pages in ordinary
  navigation; engineering found the same false-success paths in mutations and
  tests.
- **Foundational cleanup:** design and engineering agree token/UI-kit semantics,
  transport ownership, and route manifests should be fixed before broad page
  expansion.

## Moving-Target Revalidation

The repository changed during the review. The current HEAD is `9bac8cad`
(`fix(web): declare @opentelemetry/api to fix dev vendor chunk resolution`) and
the current uncommitted diff now includes:

- `apps/api/src/api/routers/integrations.py`: adds `get_tenant_id` and passes it
  to creation.
- `apps/api/src/api/services/integration_service.py`: accepts `tenant_id` and
  stores it on the integration.
- `apps/web/next.config.js`: adds server external packages and a
  development-only webpack splitChunks override.

This is relevant to the security plan, but it has not been included in the
current gate's test evidence. Before approval is treated as implementation
authorization, re-run web/UI-kit checks, backend integration tests, the exact
tenant-isolation tests, and a diff review against this HEAD. The autoplan review
remains valid as a plan, not as a certification of the moving tree.

## Pre-Gate Verification

- [x] CEO premise challenge, leverage map, alternatives, error/rescue registry,
      failure modes, and completion summary written.
- [x] Design seven passes, state matrix, implementation tasks, scorecard, and
      completion summary written.
- [x] DX persona, empathy narrative, journey map, TTHW, eight-dimension
      scorecard, and checklist written.
- [x] Engineering architecture diagram, test diagram, failure registry, worktree
      lanes, test plan artifact, and completion summary written.
- [x] Current local verification recorded: web/UI-kit typecheck pass; web lint
      pass with warnings; UI-kit lint fail; Jest pass; build pass; Playwright
      list only.
- [x] User changes preserved; no application files edited by this autoplan run.
- [ ] `jq` is unavailable, so per-phase JSONL task artifacts were not emitted.
      The final gate will state this limitation rather than fabricate task
      metadata.
- [x] Final user approval: Approve as-is.

**Phase 4 approved.** The user selected **Approve as-is** at the final gate.
This approves the staged stabilization plan, not production release. P0
security, authorization, contract, delivery, and evidence gates remain
mandatory. The moving-tree revalidation requirement still applies before any
implementation slice is certified.

## Approval Record

- Decision: Approve as-is.
- Scope approved: truth-first stabilization, route/capability/data-mode
  governance, secure session/recovery work, backend authorization/RLS proof,
  OpenAPI/client/SDK contract repair, UI-kit/token parity, full evidence gates,
  and staged vertical delivery.
- Scope not approved: production release, broad new page expansion, public SDK
  launch, or any claim that current evidence is complete.
- User work: preserve the current branch and all uncommitted changes;
  re-snapshot before implementation.

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                        | Runs | Status      | Findings                                                                     |
| ------------- | --------------------- | -------------------------- | ---- | ----------- | ---------------------------------------------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope and strategy         | 1    | issues_open | 10 concerns, 5 critical trust/security/deployment gaps, 3 premise challenges |
| Codex Review  | `/codex review`       | Independent second opinion | 0    | unavailable | Codex CLI not installed; no cross-model result                               |
| Eng Review    | `/plan-eng-review`    | Architecture and tests     | 1    | issues_open | 10 P0 blockers, 12 major test gaps, 10 critical failure gaps                 |
| Design Review | `/plan-design-review` | UI/UX gaps                 | 1    | issues_open | 14 concerns; score 4/10 to 7.5/10 after amendments                           |
| DX Review     | `/plan-devex-review`  | Developer experience gaps  | 1    | issues_open | 12 workstreams; current DX 2.3/10; TTHW statically blocked                   |

- **CODEX:** Unavailable; all outside-voice entries are Claude-subagent-only.
- **CROSS-MODEL:** Not available; no two-model consensus is claimed.
- **VERDICT:** PLAN APPROVED FOR STABILIZATION; PRODUCTION/ENTERPRISE READINESS
  REMAINS NO-GO until every P0 and evidence gate passes.

**UNRESOLVED DECISIONS:**

- Primary product promise: personal memory/career, enterprise control plane, or
  a unified product with a separately scoped education journey.
- Token authority: runtime CSS/Tailwind now, or generated UI-kit JSON with a new
  build pipeline.
- Preview placement: dedicated `/preview/*` namespace or an explicit preview
  mode.
- SDK posture: private beta before publication, or public SDK launch after all
  contract/install gates.
- Navigation taxonomy and radius semantics: retain current grouping/tokens or
  revise them after the first live vertical slice.
