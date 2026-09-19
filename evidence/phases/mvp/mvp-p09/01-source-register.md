# MVP-P09 — 01. Source Register

> Prompt §4 + §15. Live repo inspection 2026-08-10 (real evidence). **Re-audited
> 2026-08-18 against `master` @ `a0b9f26`.**

## 1. Internal sources

| ID | Source | Use | Status |
| ---------- | ------------------------------------------------------------------- | ------------------------ | --------- |
| INT-01..10 | gatekeeper, INT-02 (SHA-256 `2FA8966F…69640`), INT-05, INT-07/08/09 | as prior phases | Available |
| REPO | `master` @ `a0b9f26` (re-audit) | Web surface ground truth | Available |
| HANDOFF | `../mvp-p08/10-handoff-to-p09.md` | Scope + restrictions | Available |

## 2. Standards — applicability for UX

| ID | Standard | Verified use |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| EXT-05 | WCAG 2.2 (W3C Rec, 12 Dec 2024) | AA target for all new/changed UI; P14 audit |
| EXT-05a | WAI-ARIA Authoring Practices Guide (APG) | Design patterns for modal, dialog, tablist, menu; keyboard support |
| EXT-15 | EU AI Act transparency (2026-08-02 obligations) | AI disclosure surfaced in UI (chat, suggestions, agents) |
| EXT-16 | DPDP Rules 2025 | Consent + data-right journeys (export/delete/correction) as core UX |
| EXT-06 | RFC 9700 | Connector OAuth UX (exact redirect, scope explainer) |
| EXT-02/03 | OWASP Agentic/LLM Top 10 | Approval UX = human-in-the-loop control |

## 3. Repo evidence (EVD-MVP-P09-001)

Route/component/token inventory captured in README §Evidence snapshot;
individual file reads recorded as EVD-MVP-P09-002..005 (register `08`).

## 4. Conflict log

| ID | Conflict | Resolution | Authority |
| --------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| CF-P09-01 | Prompt lists NestJS + `apps/core-api`/`apps/ai-service` in §14; repo has FastAPI unified backend | Design targets real repo: Next.js web + FastAPI API | INT-02 + REPO |
| CF-P09-02 | Enterprise nav items exist (admin/billing/organizations/marketplace/feature-flags/developer) | Kept visible-but-gated (per existing app); MVP UX treats them as enterprise-gated surfaces, not primary journeys | INT-05 |
| CF-P09-03 | Emoji icons used as sole nav affordance | Design mandates accessible icons (aria-hidden emoji or inline SVG) at P10; no icon library addition | REPO + EXT-05 |
