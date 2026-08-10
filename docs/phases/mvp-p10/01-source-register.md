# MVP-P10 — 01. Source Register

> Prompt §4 + §15. Baseline `master` @ `0e75bdf` (P09, ratified 2026-08-10).

## 1. Internal sources

| ID         | Source                                                   | Use                      | Status    |
| ---------- | -------------------------------------------------------- | ------------------------ | --------- |
| INT-01..10 | gatekeeper, INT-02, INT-05, INT-07/08/09                 | as prior phases          | Available |
| REPO       | `master` @ `0e75bdf`                                     | Implementation canvas    | Available |
| HANDOFF    | `../mvp-p09/10-handoff-to-p10.md`                        | Restrictions 1–4 + scope | Available |
| DESIGN     | `../mvp-p09/*` (IA, screens, tokens, content, a11y plan) | Implementation spec      | Available |

## 2. Standards applicability

| ID     | Standard               | Use in phase                                                                                             |
| ------ | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| EXT-05 | WCAG 2.2 AA            | skip link (2.4.1), focus visible (2.4.7), live regions (4.1.3), reduced motion (2.3.3), aria-current nav |
| EXT-06 | RFC 9700               | consent scope explainer copy in Settings (connector OAuth UX prep)                                       |
| EXT-15 | EU AI Act transparency | AI disclosure in ChatWindow agent messages                                                               |
| EXT-16 | DPDP Rules 2025        | consent scopes + typed-confirm erasure + backup-expiry receipt                                           |

## 3. Conflict log

| ID        | Conflict                                                                                           | Resolution                                                                                                                    | Authority      |
| --------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------- |
| CF-P10-01 | P09 §05 said new components live in `packages/ui-kit`; they are domain (trust/approval) components | Placed in `apps/web/src/components/shared/` (P09 §05 allows web/shared for app-specific); ui-kit Modal a11y hardened in place | P09 §05 + REPO |
| CF-P10-02 | P09 spec: approval card shows `expires in 4h` countdown; P08 contract has no live approval API yet | Component complete vs P08 contract types; not wired to backend until P11 (handoff restriction)                                | HANDOFF        |
