# 01 — Foundation & Infrastructure (Enterprise upgrade)

## Read first
`mvp/01-foundation-infra.md`. This assumes that scaffold is live in production with real users.

## Objective
Add multi-tenancy and enterprise SSO to the foundation without disrupting existing individual (non-tenant) accounts.

## Requirements
- **Tenant model:** introduce a `tenants` table; a `workspace` can optionally belong to a `tenant` (nullable — individual accounts remain tenant-less). Tenant membership never implies memory access — see file 15 for the enforcement.
- **SSO:** add SAML/OIDC support alongside the existing email/password and any consumer OAuth from MVP, scoped so a tenant can mandate SSO for its members while individual accounts are unaffected.
- **Tenant-scoped environments:** CI/staging should support provisioning an isolated test tenant on demand for enterprise design-partner testing, without touching production tenant data.
- **Admin identity:** a distinct "tenant admin" role (different from a regular workspace user) capable of setting tenant policy (file 15) — this role must never gain implicit access to individual member memory.

## Out of scope
The Admin console UI itself (file 14), the full RBAC policy engine (file 15) — this file only adds the identity/tenancy data model and SSO plumbing underneath them.

## Acceptance criteria
- [ ] An individual (non-tenant) account created before this upgrade continues to work with zero migration friction.
- [ ] A new tenant can be provisioned in an isolated test environment without any risk to production data.
- [ ] SSO login works for a tenant-mandated identity provider in a sandboxed test.
- [ ] Creating a tenant admin role grants zero implicit memory-read access — verified by an explicit test attempting (and failing) to read a member's memory as a tenant admin with no consent grant.
