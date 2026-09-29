# DEL-ENT-P18-02 — Architecture Decision Records (ADRs) Enterprise Registry

**Deliverable ID:** DEL-ENT-P18-02  
**Phase:** ENT-P18 — Documentation and Knowledge Transfer  
**Version:** 1.0.0  
**Owner:** Principal Architect  
**Reviewer:** CTO + CISO  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:**
`evidence/phases/ent/ent-p18/02-architecture-decision-records.md`

---

## 1. Enterprise ADR Catalog (ADR-041 through ADR-050)

This deliverable formalizes and links the 10 foundational architectural
decisions made across the Enterprise track (ENT-P11 through ENT-P17):

| ADR ID      | Title                                                 | Phase Origin | Decision Summary                                                                                                      | Status       |
| ----------- | ----------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| **ADR-041** | Two-Tier Cognitive Model Routing                      | ENT-P12      | TypeSafe AI Jev System 1 (<50ms deterministic action routing) + Ollama Gemma 4 31B System 2 (grounded synthesis).     | **APPROVED** |
| **ADR-042** | Mandatory ConsentGrant Gating                         | ENT-P13      | Institutional administrators cannot query individual candidate memories without an active cryptographic ConsentGrant. | **APPROVED** |
| **ADR-043** | Two-Tier Key Management & Cryptographic Erasure       | ENT-P13      | Master Key + Workspace DEK (AES-256-GCM); rotating DEK guarantees GDPR Art. 17 permanent inaccessibility.             | **APPROVED** |
| **ADR-044** | 7-Layer Enterprise Test Pyramid & Exact Assertions    | ENT-P14      | Ban broad assertions (`assert res.status_code in (...)`); mandate exact status codes & zero mocks in live suites.     | **APPROVED** |
| **ADR-045** | Multi-Window Multi-Burn-Rate SLO Alerting             | ENT-P15      | Adopt Google SRE 2%/5% burn alerting to prevent alert fatigue while catching rapid degradation.                       | **APPROVED** |
| **ADR-046** | Zero-Downtime Expand/Contract Database Evolution      | ENT-P16      | 3-step schema migration (additive expand, async dual-read, subtractive contract) for zero outage.                     | **APPROVED** |
| **ADR-047** | Blue-Green Rollouts via Istio VirtualService Canary   | ENT-P16      | 10% canary traffic shifting with automated rollback on error rate >0.5% or latency >150ms.                            | **APPROVED** |
| **ADR-048** | SLSA Level 3 Supply-Chain Security & Cosign Signing   | ENT-P16      | Keyless container signing via Sigstore OIDC; Syft SPDX 2.3 SBOM generation and Kyverno admission gate.                | **APPROVED** |
| **ADR-049** | Strict Zero-PII OpenTelemetry Span Sanitization       | ENT-P17      | Automatic telemetry attribute scrubber removing emails, names, and memory text before OTLP export.                    | **APPROVED** |
| **ADR-050** | EU AI Act Article 50 Compliance & Transparency Banner | ENT-P17      | Persistent UI banner indicating AI-assisted generation and candidate right to inspect ReAct reasoning steps.          | **APPROVED** |

---

## 2. Invariant Traceability & ADR Enforcement

All 10 ADRs are permanently registered in the project documentation under
`docs/adr/` and are enforced continuously by pre-commit hooks, CI/CD gates, and
runtime middleware.

---

_Deliverable DEL-ENT-P18-02 v1.0.0 — Principal Architect — 2026-09-29_
