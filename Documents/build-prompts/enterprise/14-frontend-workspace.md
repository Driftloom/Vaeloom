# 14 — Frontend & Workspace UI (Enterprise upgrade)

## Read first
`mvp/14-frontend-workspace.md`.

## Objective
Add the tenant-facing and platform-facing screens MVP deliberately deferred, and close out a formal accessibility pass.

## Requirements
- **Admin console:** tenant policy editor (ABAC rules from `enterprise/11`), member list (aggregated, consent-respecting — no individual memory content ever visible here), consent status overview.
- **Analytics screen:** usage and pattern insights, per-tenant where applicable (`enterprise/12`'s dashboards surfaced here).
- **Developer Mode / Plugin management screen:** for users/tenants managing their own installed plugins (`enterprise/07`), viewing plugin scopes and revoking access.
- **Formal accessibility audit:** a full WCAG-level pass (not MVP's basic keyboard-navigable check) — screen reader testing, color contrast verification, focus management audit — across every screen, MVP and enterprise both.
- **Internationalization scaffold:** MVP's resume formatting already accounted for regional conventions (see the companion Enterprise Paper §10); this phase adds the broader UI localization scaffold (string extraction, locale routing) even if only one locale ships initially.

## Out of scope
A full mobile app (still a companion/notification surface, not full parity, per the roadmap).

## Acceptance criteria
- [ ] A tenant admin can view and edit tenant policy and member consent status without any path to individual memory content.
- [ ] The accessibility audit is performed by/against a recognized standard (WCAG 2.1 AA is a reasonable bar) with documented findings and fixes, not just a self-check.
- [ ] The Plugin management screen correctly reflects and can revoke a real installed plugin's scope.
- [ ] The i18n scaffold correctly renders at least one non-default locale end to end, even if translation coverage is partial.
