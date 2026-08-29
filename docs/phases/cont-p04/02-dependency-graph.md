# CONT-P04 — 02 Dependency Graph — Critical Path

**Deliverable:** `DEL-CONT-P04-02` | **Owner:** Engineering Manager

## Critical Path

```mermaid
flowchart TD
    A["CONT-P00 baseline 95.47"] --> B["CONT-P03 invariants 95.88"]
    B --> C["CONT-P07 tenant-data migration 6→22"]
    C --> D["CONT-P08 API compat adapters"]
    D --> E["CONT-P12 agent shadow eval"]
    E --> F["CONT-P14 migration testing reconciliation"]
    F --> G["CONT-P19 pilot canary"]
    G --> H["CONT-P20 rollback decision"]
    H --> I["CONT-P21 retirement zero traffic"]
    style C fill:#1e1b4b,stroke:#a78bfa,color:#fff
    style G fill:#14532d,stroke:#4ade80,color:#fff
```

## Dependencies

| Dependency             | Blocks           | Gate             |
| ---------------------- | ---------------- | ---------------- |
| `01 8 REQ +6 INV`      | `CONT-P04 waves` | `CONT-P03 95.88` |
| `6→22 mapping_version` | `CONT-P12 eval`  | `CONT-P07 42/42` |
| `42/42 RLS`            | `tenant cells`   | `787053a`        |
| `temporal 8 queues`    | `pilot`          | `worker×2`       |

Resource: no procurement values invented — `BWS-02.2 deferred` per
`05-non-goals horizon`.
