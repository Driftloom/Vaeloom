# DEL-ENT-P21-04 — 18-Month Long-Term Roadmap & Multi-Region Expansion

**Deliverable ID:** DEL-ENT-P21-04  
**Phase:** ENT-P21 — Maintenance and Continuous Improvement  
**Version:** 1.0.0  
**Owner:** CTO + VP Product  
**Reviewer:** Cloud Architect + CISO  
**Status:** DELIVERED  
**Date:** 2026-09-29  
**Immutable Path:** `evidence/phases/ent/ent-p21/04-long-term-roadmap.md`

---

## 1. 18-Month Architecture & Feature Roadmap (Q4 2026 - Q1 2028)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     18-MONTH PLATFORM EVOLUTION                         │
│                                                                         │
│  Q4 2026: Institutional Scale & SOC 2 Type II Finalization             │
│    • Conclude SOC 2 Type II 6-month observation window.                 │
│    • Onboard first 50 university pilot cohorts (100,000 candidates).    │
│    • Release candidate mobile application (iOS & Android).             │
│                                                                         │
│  Q1 2027: Multi-Region Sovereign Cells (EU & India)                     │
│    • Deploy EU-Central (Frankfurt) tenant cell for strict GDPR residency│
│    • Deploy AP-South (Mumbai) tenant cell with India DPDP nominee flow  │
│    • Cross-cell global identity federation with zero data egress        │
│                                                                         │
│  Q2 2027: Agent Ecosystem & Governed Plugin Marketplace                │
│    • Open Vaeloom Agent SDK for third-party accredited career tools.   │
│    • Verified MCP connector registry with sandboxed execution.          │
│    • Granular candidate permissions for third-party marketplace tools.  │
│                                                                         │
│  Q3 2027: Privacy-Preserving Institutional Analytics                    │
│    • Differential privacy reporting for university career outcomes.     │
│    • Zero-knowledge skill verification attestations on public ledgers.  │
│                                                                         │
│  Q4 2027 - Q1 2028: Multi-Model Portability & Autonomous Coaching      │
│    • Self-hosted open-weights inference (Llama 4 / Mistral Large).      │
│    • Real-time voice interview simulation agent.                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Deprecation Policy & Backward Compatibility Guarantee

1. **Minimum Support Window:** All published API versions receive a minimum of
   **18 months** active support following formal deprecation announcement.
2. **Deprecation Headers:** Deprecated endpoints return `Sunset: <date>` and
   `Link: <canonical-url>; rel="sunset"` HTTP headers.
3. **Zero Breaking Changes:** Minor releases within OpenAPI 3.x must remain 100%
   backward compatible for all existing client SDKs.

---

_Deliverable DEL-ENT-P21-04 v1.0.0 — CTO — 2026-09-29_
