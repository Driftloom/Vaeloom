# CONT-P04 — 03 RACI / Approval Matrix

**Deliverable:** `DEL-CONT-P04-03` | **Owner:** Release Manager

| Decision               | R       | A                      | C        | I        | Review Board        | Change Authority |
| ---------------------- | ------- | ---------------------- | -------- | -------- | ------------------- | ---------------- |
| Scope `INV-01..06`     | Product | **Program Manager**    | EntArch  | All veto | Arch Board          | Program          |
| Contract `openapi 110` | Arch    | **Solution Architect** | Product  | Eng      | API Review `GFX-08` | Program          |
| Permission `tenant_id` | SecArch | **Security Architect** | Privacy  | Ops      | Sec Review          | Sec              |
| Migration `6→22`       | Data    | **Data Architect**     | Product  | QA       | Data Review         | EntArch          |
| Gate 95                | QA      | **Program Manager**    | All veto | Sponsor  | Gate                | Program          |

_All 6 approvers named per `BQ-01`; backup EntArch._
