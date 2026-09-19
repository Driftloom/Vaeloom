# CONT-P02 — 01 Research Plan / Repository — Evidence-Gated

**Deliverable:** `DEL-CONT-P02-01` | **Owner:** User Researcher + Domain
Specialist | **Date:** 2026-08-28

## 1. Research Questions (tied to decisions & stop criteria)

| ID    | Question                                                                                                      | Decision it Serves                         | Falsifiable Stop?                                                      | Owner        |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- | ------------ |
| RQ-01 | Do enterprise buyers (university `tenant_id` pooled→cell) need 22 memories or does `6 + vector LIKE` suffice? | `6→22 expand via shadow reads` `CONT-P12`  | `NO` if `Entity canonical_name` collisions guess fields                | Data/EntArch |
| RQ-02 | Does `Gmail push renewal` (`EXT-12`) miss deadlines vs polling?                                               | `scheduler` jitter 60s `CONT-P11`          | `YES` if `push-watch renewal` gap found                                | Integration  |
| RQ-03 | Which Gmail/GitHub scopes buyer procurement requires?                                                         | `Tool-Catalog 49` least-privilege `06 441` | Avoid one-customer architecture — `procurement questionnaire` required | Security     |
| RQ-04 | Can `pgvector` at 10k entities still `p95 120ms <200`?                                                        | `NFR p99<500ms`                            | Measure at `CONT-P15` capacity                                         | Data         |

## 2. Sampling & Limitations

- **Sampling:** `User-Personas 3 primary +4 secondary` already segmented
  `02-persona-jtbd 8 rows` — CONT-P02 expands with **consented design-partner
  evidence only** (`U-01` pilot windows still UNKNOWN per `CONT-P00` —
  `BLOCKING for pilot` not baseline research)
- **Limitations:** No university tenant sponsor yet (`BQ-05 UNKNOWN`), so
  research is `05-non-goals horizon/owner` per 109 without invented
  `tenant; sponsor; window`
- **External radar (overlay 142):** Track MCP `2026-07-28`, Gmail `EXT-12` push
  terms, GitHub `EXT-13` fine-grained, DPDP Rules 2025 staged, EU AI 2026-08-02
  `transparency`

## 3. Repository / Evidence Control

- **Harus:** `git SHA 78c2d71` + `SHA256SUMS 79` per `00-master-index`,
  `apps/services`, `packages/contracts`, `migrations`, `infra`,
  `docs/migration`, `tests/migration`, `.github/workflows` inspected
  (`rg skip_auth tenant_id 0 NOT_EXECUTED` none)
- **Contamination control:** Synthetic `test_product_closure_e2e 10` uses
  `mock_llm 0.1*1536` + `tmp_path sqlite` per-test DB via `NullPool` —
  `eval 12 cases` (`mvp-p12 88.4`) used orchestrator `mock_embedding` not
  licensed data
- **Traceability:** `requirement → design → file → test → evidence → risk` per
  `CONT-P01-R07`

---

_Versioned `DEL-CONT-P02-01 v1.0` `78c2d71`._
