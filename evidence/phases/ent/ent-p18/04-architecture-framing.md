# ENT-P18 Architecture Framing — Documentation and Knowledge Transfer

**Phase:** ENT-P18 — Documentation and Knowledge Transfer  
**Version:** 1.0.0  
**Owner:** Technical Writer + Lead Architect  
**Reviewer:** CTO + CISO  
**Date:** 2026-09-29

---

## 1. Living Documentation Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LIVING DOCUMENTATION ARCHITECTURE                    │
│                                                                         │
│  [ OpenAPI Specification ] ──► Automated HTML Developer Portal (Mintlify)│
│  [ Git Committed ADRs ]    ──► Canonical Architecture Portal            │
│  [ Executable Runbooks ]   ──► SRE Operational Knowledgebase             │
│  [ TypeScript/Python SDKs ]──► Auto-generated TypeDoc / Sphinx Portals   │
│  [ Code Comments & Types ] ──► In-IDE Autocomplete & Linting Rules      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Documentation Invariants

### INV-DOC-01: Single Source of Truth

> **Documentation must be generated directly from version-controlled code,
> OpenAPI contracts, and committed markdown files. Separate wiki documentation
> that drifts from code is prohibited.**

### INV-DOC-02: Machine-Readable Executable Contracts

> **All API documentation must validate against OpenAPI Specification 3.2.0.
> Every example request and response in documentation must be executable and
> verified against live test suites.**

### INV-DOC-03: Zero-Assumption Onboarding

> **New engineering team members must be able to boot a fully functional
> development environment in < 30 minutes using only the commands documented in
> `DEL-ENT-P18-04`.**

### INV-DOC-04: Mandatory Architecture Decision Records (ADRs)

> **Any significant change to database schemas, security boundaries, model
> routing, or deployment topologies requires a committed, approved ADR before
> code merge.**

### INV-DOC-05: Plain-Language Privacy Disclosure

> **Candidate-facing privacy documentation must explain data ownership,
> ConsentGrants, and cryptographic erasure in clear, jargon-free language
> accessible to all users.**

---

_Architecture Framing v1.0.0 — Lead Architect — 2026-09-29_
