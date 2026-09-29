# DEL-ENT-P15-04 — Cost Model and FinOps Analysis

**Deliverable ID:** DEL-ENT-P15-04  
**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** FinOps Lead  
**Reviewer:** Performance Engineer + CTO  
**Status:** DELIVERED  
**Date:** 2026-09-29

---

## 1. Cost Model by Tier

### 1.1 Unit Cost Baseline (per document / per session)

| Operation                     | Unit            | Cost (estimated) | Provider                   |
| ----------------------------- | --------------- | ---------------- | -------------------------- |
| Resume compile (Chromium PDF) | per compile     | \$0.0787         | Compute (verified ENT-P04) |
| Gemma 4 31B synthesis         | per 1K tokens   | \$0.0006         | Ollama Cloud               |
| Jev S1 action routing         | per 1K calls    | \$0.04           | TypeSafe AI                |
| pgvector HNSW query           | per 1K queries  | \$0.002          | DB compute                 |
| S3 object storage             | per GB/month    | \$0.023          | MinIO → GCS/S3             |
| S3 PUT/GET                    | per 1K requests | \$0.005          | Cloud object storage       |

### 1.2 Monthly Cost Model by Tier

| Component                | Tier 1 (Startup)      | Tier 2 (SMB)      | Tier 3 (Enterprise) |
| ------------------------ | --------------------- | ----------------- | ------------------- |
| Compute (API + Web pods) | \$80/month            | \$800/month       | \$8,000/month       |
| PostgreSQL (managed)     | \$50/month            | \$300/month       | \$2,000/month       |
| pgvector HNSW queries    | \$20/month            | \$200/month       | \$2,000/month       |
| Object storage (S3)      | \$10/month            | \$100/month       | \$1,000/month       |
| Jev S1 (cognitive)       | \$15/month            | \$150/month       | \$1,500/month       |
| Gemma 4 (synthesis)      | \$40/month            | \$400/month       | \$4,000/month       |
| Chromium PDF renders     | \$30/month (400 docs) | \$300/month       | \$3,000/month       |
| Infisical secrets        | \$20/month            | \$50/month        | \$200/month         |
| Monitoring + logs        | \$15/month            | \$80/month        | \$500/month         |
| **Total monthly**        | **\$280/month**       | **\$2,380/month** | **\$22,200/month**  |
| **Revenue model target** | \$50/user/month       | \$30/user/month   | \$20/user/month     |
| **Break-even users**     | 6 users               | 79 users          | 1,110 users         |

### 1.3 Cost per User (Monthly)

| Tier                | Users | Monthly cost | Cost/user | Gross margin (at pricing) |
| ------------------- | ----- | ------------ | --------- | ------------------------- |
| Tier 1 (Startup)    | 10    | \$280        | \$28      | 44%                       |
| Tier 2 (SMB)        | 500   | \$2,380      | \$4.76    | 84%                       |
| Tier 3 (Enterprise) | 5,000 | \$22,200     | \$4.44    | 78%                       |

---

## 2. Cost Optimization Policies

| Optimization                                         | Saving                                      | Status                        | Owner                |
| ---------------------------------------------------- | ------------------------------------------- | ----------------------------- | -------------------- |
| Rate-limit Chromium renders (5/hour/workspace)       | 20% compute reduction                       | ✅ IMPLEMENTED                | Performance Engineer |
| HNSW `ef_search` tuned to 40 (vs default 50)         | 15% latency reduction; same accuracy        | ✅ IMPLEMENTED                | Data Architect       |
| Gemma 4 response caching (semantic similarity >0.95) | 30% LLM cost reduction                      | 🔄 DESIGNED — NOT_IMPLEMENTED | AI Lead              |
| pgvector index compression (IVFFlat hybrid)          | 40% storage reduction for large tenants     | 🔄 DESIGNED — ENT-P17         | Data Architect       |
| S3 lifecycle policies (90-day archive tier)          | 60% storage cost reduction on old artifacts | 🔄 DESIGNED — ENT-P16         | DevOps               |
| Jev S1 batch grouping (destructive action queue)     | 25% S1 call reduction                       | 🔄 DESIGNED — ENT-P17         | AI Lead              |

---

## 3. Cost Guardrails

| Guardrail                                       | Mechanism                            | Owner       | Status                |
| ----------------------------------------------- | ------------------------------------ | ----------- | --------------------- |
| Per-workspace Chromium render quota             | `SCRAPE_QUOTA_PER_HOUR` default 20/h | Product     | ✅ IMPLEMENTED        |
| Per-workspace agent step budget                 | `max_steps` enforced in registry     | AI Lead     | ✅ IMPLEMENTED        |
| Gemma 4 token budget (4,000 char context fence) | `[UNTRUSTED_DATA]` max 4,000 chars   | AI Lead     | ✅ IMPLEMENTED        |
| Cost attribution per tenant                     | Tenant ID in all OTel spans + DB     | SRE         | ✅ IMPLEMENTED        |
| S3 quota per workspace                          | Feature flag `STORAGE_QUOTA_GB`      | DevOps      | 🔄 DESIGNED           |
| Monthly spend alert                             | Cloud billing alert threshold        | FinOps Lead | 🔄 DESIGNED — ENT-P17 |

---

## 4. FinOps Compliance

| Requirement                  | Status         | Notes                                  |
| ---------------------------- | -------------- | -------------------------------------- |
| Cost attribution per tenant  | ✅ IMPLEMENTED | OTel `tenant_id` tag on all spans      |
| Cost-per-document tracked    | ✅ VERIFIED    | \$0.0787/doc (verified ENT-P04)        |
| No unbounded background jobs | ✅ IMPLEMENTED | All async jobs have TTL                |
| AI model cost monitoring     | 🔄 DESIGNED    | Requires Gemma + Jev API cost webhooks |

---

_Deliverable DEL-ENT-P15-04 v1.0.0 — FinOps Lead — 2026-09-29_
