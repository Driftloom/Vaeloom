# Vaeloom Support

> **Last updated:** 2026-09-15 — **Owner:** Platform Team

## Channels

| Channel          | Use for                                    | Address                                                             |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| Email (security) | Vulnerabilities only — never public issues | `security@vaeloom.dev` (48h ack, PGP available — see `SECURITY.md`) |
| Email (support)  | Account, billing, workspace issues         | `support@vaeloom.dev`                                               |
| GitHub Issues    | Bugs and feature requests on public repos  | Issue tracker (include template below)                              |
| Docs             | Self-serve setup, architecture, API        | `docs/README.md` → `docs/usage-guide.md`                            |
| Onboarding       | New-developer walkthrough                  | `docs/DEVELOPER_ONBOARDING.md`                                      |

## Response SLA

| Severity    | Definition                                 | First response   | Target resolution  |
| ----------- | ------------------------------------------ | ---------------- | ------------------ |
| S1 Critical | Production down, data loss, active exploit | 4 business hours | 1 business day     |
| S2 High     | Major feature broken, no workaround        | 1 business day   | 3 business days    |
| S3 Normal   | Bug with workaround, docs gap              | 2 business days  | Next minor release |
| S4 Low      | Question, nit, docs typo                   | 3 business days  | Best effort        |

Security reports follow `SECURITY.md` (90-day coordinated disclosure window),
not this table.

## Before You Ask

1. Read [AGENTS.md](../AGENTS.md) gotchas — most fresh-setup failures are
   `DATABASE__URL` (double underscore), CSP `connect-src`, `transformKeys`
   casing, or CSRF exemptions.
2. Check the [Glossary](GLOSSARY.md) for term definitions.
3. Reproduce on the latest `0.2.0` release; unsupported versions get no fixes.

## Bug Report Template

```markdown
## Summary

<!-- One-line description -->

## Environment

- Vaeloom version: (e.g. 0.2.0)
- Frontend: (browser + URL, e.g. localhost:3000)
- Backend: (e.g. local uvicorn :8000, sqlite / postgres)
- Commit SHA:

## Steps to Reproduce

1.
2.
3.

## Expected vs Actual

<!-- What should happen / what happens instead -->

## Logs / Screenshots

<!-- Redact JWTs, API keys, PII. Never paste secrets. -->

## Severity

<!-- S1 / S2 / S3 / S4 per table above -->
```

## Data to Redact

Never include `JWT_SECRET`, `ENCRYPTION_KEY`, tokens, cookies, or personal data
in tickets or screenshots. Rotate any credential pasted by accident.
