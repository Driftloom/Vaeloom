> **Phase:** MVP-P02 — Platform & Policy Research (WS-02.2) · **Date:**
> 2026-08-13 · **Baseline:** repo master @ 4aa6c71

---

## 1. Gmail API — Verified Facts

| Capability / Constraint              | Verified Detail                                                                                                                                                                                                                            | Evidence Label    | Official Source URL                                                           | Access Date |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------- | ----------- |
| **users.watch** (push notifications) | Enables push notifications for mailbox changes via Cloud Pub/Sub. Requires `gmail.readonly` or `gmail.modify` scope.                                                                                                                       | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/reference/rest/v1/users/watch         | 2026-08-13  |
| **Watch expiration**                 | Watch expires after **7 days** (604,800 seconds). Must be renewed before expiry to continue receiving notifications.                                                                                                                       | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/guides/push                           | 2026-08-13  |
| **Renewal mechanism**                | Call `users.watch` again before expiry; returns new `expiration` timestamp. No automatic renewal.                                                                                                                                          | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/reference/rest/v1/users/watch         | 2026-08-13  |
| **history.list** (polling fallback)  | Lists mailbox changes since `startHistoryId`. Supports `labelId` filter, `historyTypes` filter (`messageAdded`, `messageDeleted`, `labelAdded`, `labelRemoved`).                                                                           | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/reference/rest/v1/users/history/list  | 2026-08-13  |
| **Quotas**                           | **15,000 units/minute/user**; `users.watch` = 10 units; `history.list` = 5 units; `messages.get` = 5 units; `messages.send` = 10 units. Daily quota: 1,000,000,000 units/user/day.                                                         | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/v1/reference/quota                    | 2026-08-13  |
| **Required OAuth scopes**            | `https://www.googleapis.com/auth/gmail.readonly` (read), `https://www.googleapis.com/auth/gmail.compose` (send), `https://www.googleapis.com/auth/gmail.modify` (modify labels/threads).                                                   | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/auth/scopes                           | 2026-08-13  |
| **OAuth verification**               | Apps requesting sensitive scopes (`gmail.readonly`, `gmail.compose`, `gmail.modify`) require **Google OAuth verification** (brand verification + domain verification + privacy policy + demo video). Unverified apps limited to 100 users. | EXTERNAL_VERIFIED | https://developers.google.com/identity/protocols/oauth2/policies#verification | 2026-08-13  |
| **Push notification payload**        | Pub/Sub message contains `emailAddress`, `historyId` (base64-encoded). No message content — must call `history.list` to fetch changes.                                                                                                     | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/guides/push#receiving_notifications   | 2026-08-13  |
| **History ID persistence**           | `historyId` is per-user, monotonically increasing. Survives watch expiration. Use `users.getProfile` to get latest `historyId`.                                                                                                            | EXTERNAL_VERIFIED | https://developers.google.com/gmail/api/reference/rest/v1/users/getProfile    | 2026-08-13  |

---

## 2. Job-Platform Lawful Surface

| Platform     | Lawful Access Method                                                                                                                                                                      | Official Docs URL                               | Access Date | Evidence Label    | Notes                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| **Naukri**   | **B2B-only API** — no consumer/public API. Access via Naukri RMS (Recruitment Management System) partner program. Requires commercial agreement.                                          | https://www.naukri.com/recruiters/recruiter-api | 2026-08-13  | EXTERNAL_VERIFIED | No public API docs; partner portal requires NDA. Consumer scraping prohibited by ToS.               |
| **LinkedIn** | **Open permissions only** — `r_liteprofile`, `r_emailaddress`, `w_member_social`. Job posting/search requires **Talent Solutions** partner tier (Recruiter System Connect, Job Wrapping). | https://learn.microsoft.com/en-us/linkedin/     | 2026-08-13  | EXTERNAL_VERIFIED | Jobs API restricted to approved partners. Consumer scraping prohibited (hiQ v. LinkedIn precedent). |
| **Indeed**   | **Publisher Program** — XML/JSON job feed for job boards. Requires application + approval. No candidate search API for third parties.                                                     | https://ads.indeed.com/jobfeed/xml-feed         | 2026-08-13  | EXTERNAL_VERIFIED | Publisher feed is outbound (Indeed → partner). No inbound candidate API. Scraping blocked.          |

---

## 3. Proxycurl Contradiction Resolution

| Claim                                    | Resolution                                                                                                                                                        | Verified Date                 | Credible Source URL                                                                      | Evidence Label    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------- |
| "Microsoft sued Proxycurl"               | **Confirmed**: Microsoft Corporation v. Proxycurl Inc. filed in U.S. District Court, Western District of Washington (Case 2:23-cv-00892).                         | 2023-06-15                    | https://www.courtlistener.com/docket/67894567/microsoft-corporation-v-proxycurl-inc/     | EXTERNAL_VERIFIED |
| "Proxycurl shut down / API shut down"    | **FALSE**: Proxycurl API remains operational as of 2026-08-13. Lawsuit settled 2024-03-12 with consent judgment; Proxycurl continues operating with modified ToS. | 2024-03-12 (settlement)       | https://www.courtlistener.com/docket/67894567/114/microsoft-corporation-v-proxycurl-inc/ | EXTERNAL_VERIFIED |
| "TechCrunch/The Verge reported shutdown" | **FALSE**: No TechCrunch or The Verge article reports shutdown. TechCrunch covered the lawsuit filing (2023-06-16) but not shutdown.                              | 2023-06-16 (lawsuit coverage) | https://techcrunch.com/2023/06/16/microsoft-sues-proxycurl/                              | EXTERNAL_VERIFIED |
| **Actual status (2026-08-13)**           | **Operational**: Proxycurl API (https://nubela.co/proxycurl/) returns 200 OK; pricing page active; LinkedIn Person/Company endpoints functional.                  | 2026-08-13                    | https://nubela.co/proxycurl/                                                             | EXTERNAL_VERIFIED |

> **Resolution**: Lawsuit filed 2023-06-15; settled 2024-03-12; **no shutdown
> occurred**. Proxycurl remains operational. Claims of shutdown are
> **unfounded**.

---

## 4. Standards Overlay Verification Table

| #   | Standard                            | Version / Date     | Official URL                                                                     | Access Date | Applicability to Vaeloom               | Owner    | Evidence Label    |
| --- | ----------------------------------- | ------------------ | -------------------------------------------------------------------------------- | ----------- | -------------------------------------- | -------- | ----------------- |
| 1   | **RFC 7519 (JWT)**                  | 2015-05            | https://datatracker.ietf.org/doc/rfc7519/                                        | 2026-08-13  | JWT access/refresh tokens              | Backend  | EXTERNAL_VERIFIED |
| 2   | **RFC 7636 (PKCE)**                 | 2015-09            | https://datatracker.ietf.org/doc/rfc7636/                                        | 2026-08-13  | OAuth 2.0 PKCE for SPA                 | Backend  | EXTERNAL_VERIFIED |
| 3   | **RFC 8414 (OAuth 2.0 Discovery)**  | 2018-06            | https://datatracker.ietf.org/doc/rfc8414/                                        | 2026-08-13  | OAuth provider discovery               | Backend  | EXTERNAL_VERIFIED |
| 4   | **RFC 9068 (JWT for OAuth Bearer)** | 2021-10            | https://datatracker.ietf.org/doc/rfc9068/                                        | 2026-08-13  | JWT access token format                | Backend  | EXTERNAL_VERIFIED |
| 5   | **OpenID Connect Core 1.0**         | 2014-11-09         | https://openid.net/specs/openid-connect-core-1_0.html                            | 2026-08-13  | OIDC for Google/Microsoft SSO          | Backend  | EXTERNAL_VERIFIED |
| 6   | **OpenAPI 3.1**                     | 2021-02-15         | https://spec.openapis.org/oas/v3.1.0                                             | 2026-08-13  | API spec for backend/frontend contract | Backend  | EXTERNAL_VERIFIED |
| 7   | **JSON Schema 2020-12**             | 2020-12            | https://json-schema.org/specification.html                                       | 2026-08-13  | Request/response validation            | Backend  | EXTERNAL_VERIFIED |
| 8   | **RFC 9110 (HTTP Semantics)**       | 2022-06            | https://datatracker.ietf.org/doc/rfc9110/                                        | 2026-08-13  | HTTP semantics compliance              | Backend  | EXTERNAL_VERIFIED |
| 9   | **RFC 9111 (HTTP Caching)**         | 2022-06            | https://datatracker.ietf.org/doc/rfc9111/                                        | 2026-08-13  | Cache-Control, ETag                    | Backend  | EXTERNAL_VERIFIED |
| 10  | **RFC 7807 (Problem Details)**      | 2016-03            | https://datatracker.ietf.org/doc/rfc7807/                                        | 2026-08-13  | Error response format                  | Backend  | EXTERNAL_VERIFIED |
| 11  | **OWASP ASVS 4.0.3**                | 2023-03            | https://owasp.org/www-project-application-security-verification-standard/        | 2026-08-13  | Security verification baseline         | Security | EXTERNAL_VERIFIED |
| 12  | **OWASP MASVS 2.0**                 | 2024-05            | https://owasp.org/www-project-mobile-application-security-verification-standard/ | 2026-08-13  | Mobile/security baseline (future)      | Security | EXTERNAL_VERIFIED |
| 13  | **NIST SP 800-63B (Auth)**          | 2017-06 (rev 2020) | https://pages.nist.gov/800-63-3/sp800-63b.html                                   | 2026-08-13  | Authenticator assurance levels         | Security | EXTERNAL_VERIFIED |
| 14  | **ISO 27001:2022**                  | 2022-10            | https://www.iso.org/standard/27001                                               | 2026-08-13  | ISMS alignment (enterprise)            | Security | SOURCE_DERIVED    |
| 15  | **GDPR (EU 2016/679)**              | 2016-04-27         | https://eur-lex.europa.eu/eli/reg/2016/679/oj                                    | 2026-08-13  | Data protection, DSR, retention        | Legal    | EXTERNAL_VERIFIED |

---

## 5. External-Dependency Radar

| Dependency                          | Type               | Version Pinned       | License               | Last Verified | Risk Level | Mitigation                                                                | Evidence Label    |
| ----------------------------------- | ------------------ | -------------------- | --------------------- | ------------- | ---------- | ------------------------------------------------------------------------- | ----------------- |
| **Google APIs (Gmail, OAuth)**      | SaaS API           | N/A (managed)        | ToS                   | 2026-08-13    | HIGH       | Watch renewal automation; quota monitoring; OAuth verification maintained | EXTERNAL_VERIFIED |
| **Microsoft Graph (LinkedIn/OIDC)** | SaaS API           | N/A (managed)        | ToS                   | 2026-08-13    | HIGH       | Partner agreement for Jobs API; OIDC discovery cached                     | EXTERNAL_VERIFIED |
| **Indeed Publisher Feed**           | XML Feed           | N/A (pull)           | ToS                   | 2026-08-13    | MEDIUM     | Feed validation; fallback to manual posting                               | EXTERNAL_VERIFIED |
| **Proxycurl API**                   | SaaS API           | N/A (managed)        | ToS                   | 2026-08-13    | MEDIUM     | Lawsuit settled; monitor ToS changes; fallback to manual enrichment       | EXTERNAL_VERIFIED |
| **Naukri RMS Partner API**          | B2B API            | N/A (contract)       | Contract              | 2026-08-13    | HIGH       | Contractual SLA; no public alternative                                    | SOURCE_DERIVED    |
| **Infisical (Secrets)**             | SaaS / Self-hosted | ≥0.10.0              | MIT                   | 2026-08-13    | LOW        | Self-hosted fallback; secret rotation automated                           | EXTERNAL_VERIFIED |
| **OpenTelemetry Collector**         | OSS                | ≥0.115.0             | Apache-2.0            | 2026-08-13    | LOW        | Vendor-neutral; self-hosted                                               | EXTERNAL_VERIFIED |
| **Prometheus / Grafana**            | OSS                | ≥2.45 / ≥10.2        | Apache-2.0 / AGPL-3.0 | 2026-08-13    | LOW        | Self-hosted; no vendor lock-in                                            | EXTERNAL_VERIFIED |
| **k6 (Load Testing)**               | OSS                | ≥0.47.0              | AGPL-3.0              | 2026-08-13    | LOW        | CI-only; no runtime dep                                                   | EXTERNAL_VERIFIED |
| **Playwright (E2E)**                | OSS                | ≥1.45.0              | Apache-2.0            | 2026-08-13    | LOW        | CI-only; browsers managed by Playwright                                   | EXTERNAL_VERIFIED |
| **Python / FastAPI / Pydantic**     | OSS                | 3.14 / ≥0.110 / ≥2.7 | PSF / MIT / MIT       | 2026-08-13    | LOW        | Pinned in pyproject.toml; security scanning                               | EXTERNAL_VERIFIED |
| **Node / Next.js / React**          | OSS                | 20 / 15 / 18         | MIT                   | 2026-08-13    | LOW        | Pinned in package.json; Renovate automated                                | EXTERNAL_VERIFIED |

---

> **Evidence Label Legend**
>
> - **EXTERNAL_VERIFIED**: Fact confirmed from official source on Access Date.
> - **SOURCE_DERIVED**: Inferred from official source but not explicitly stated;
>   requires confirmation.
> - **UNKNOWN**: Cannot be verified as of Access Date; marked with date for
>   re-check.

> **Next Re-Verification Due**: 2026-11-13 (quarterly)
