# MVP-P04 — 04. Dependency Graph & Critical Path (DEL-MVP-P04-02)

> Owner: Engineering Manager · Repo truth: Next.js + FastAPI (no NestJS —
> CF-P04-01)

## 1. Phase dependency graph (MVP track)

```text
P03 (requirements baseline)
 └─ P05 (architecture) ──┬─ P06 (stack/standards) ── P07 (data arch)
                         │                           ├─ P08 (API contracts)
                         └─ P09 (UI/UX)              ├─ P12 (AI/memory) ─┐
                                        ┌────────────┴──────────────────┘
                                        ▼
                          P10 (web) ── P11 (backend) ── P12 done
                                       │
              ┌────────────────────────┴────────────────────┐
              ▼                                             ▼
        P13 (security) ──┐                           P14 (QA) ── P15 (perf/rel)
              └──────────┴────┬──────────────────────────┘
                              ▼
                 P16 (CI/CD) ── P17 (ops) ── P18 (docs)
                              ▼
                  P19 (release) ── P20 (validation) ── P21 (maintenance)
```

## 2. Critical path

P05 → P06 → P07 → P08 → P11 → P13 → P14 → P15 → P16 → P17 → P18 → P19 → P20 →
P21

- Longest chain (design → data → contracts → backend → harden → certify → ship).
- **P10 (web) branches off P08/P09** — not on critical path (can lag P11).
- **P09 (UX)** runs parallel to P07/P08 from P05.
- **P12 (AI/memory)** starts after P07+P08; may overlap P11 (independent
  services).
- **P16 (CI/CD)** partially exists in repo → verify/extend early, not on path.

## 3. Key dependencies (facts, not assumptions)

| Dep                         | Needed by             | Provides                                  | Risk if late              |
| --------------------------- | --------------------- | ----------------------------------------- | ------------------------- |
| P07 RLS/schema design       | P11, P12              | 6-memory model, workspace isolation       | Blocks backend + AI       |
| P08 OpenAPI contracts       | P10, P11, P12         | Typed contract, approval API, OAuth       | Blocks all implementation |
| P08 OAuth design (RFC 9700) | P13, P04 Gmail        | Least-privilege, PKCE, replay resistance  | Security blocker          |
| P12 eval harness            | P14, P13              | ≥90% extraction / ≥80% retrieval evidence | Gate evidence missing     |
| P13 legal review            | T2/T3 enablement only | DPDP + ToS positions                      | NOT on MVP path (gated)   |
| P19 credentials             | P19                   | Production Gmail/OAuth creds              | Blocks go-live (UNK-02)   |
| VB-07 cohort                | P20                   | Validation users                          | Beta validation (UNK-03)  |

## 4. Parallelization & overlap

- P09 ∥ P07/P08; P12 ∥ P11 tail; P16 prep ∥ P10–P12; P14 planning starts at P10.
- Enterprise work (SSO/SCIM, billing, marketplace, multi-region) stays OUT of
  MVP critical path (prompt §12.6) — deferred to enterprise track, not imported.

## 5. Kill switches / rollback points per dependency stage

- Each phase gate = rollback point (`git revert` clean-tree discipline).
- Feature flags: AUTO-01 (T1, ON), AUTO-02 (T2, OFF), AUTO-03 (T3, OFF)
  (DEC-P02-05) — enablement independent of code presence.
- Connector outage isolation (NFR-15/h15 design) keeps one failure domain from
  cascading (no synchronized retries — INT-02 §5).
