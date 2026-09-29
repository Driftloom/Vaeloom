# DEL-ENT-P15-01 — Capacity Model and Workload Profiles

**Deliverable ID:** DEL-ENT-P15-01  
**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** Performance Engineer  
**Reviewer:** SRE + Data Architect  
**Status:** DELIVERED  
**Date:** 2026-09-29

---

## 1. Workload Profiles

### 1.1 Baseline Workload (Single-Tenant MVP)

| Dimension                     | Value  | Notes                                                                   |
| ----------------------------- | ------ | ----------------------------------------------------------------------- |
| Concurrent active users       | 50     | Single workspace; typical session 45min                                 |
| API requests/sec (avg)        | 12 rps | Mix: memory reads (40%), agent triggers (20%), auth (20%), resume (20%) |
| API requests/sec (peak 5-min) | 60 rps | Morning login burst                                                     |
| pgvector queries/min          | 180    | HNSW top-k=10 per agent step                                            |
| Jev S1 calls/min              | 40     | Destructive action triage + semantic routing                            |
| Gemma 4 calls/min             | 8      | Full synthesis responses                                                |
| S3 object ops/min             | 25     | Resume uploads + artifact downloads                                     |
| WebSocket connections         | 20     | SSE streams per agent session                                           |

### 1.2 Enterprise Workload (Multi-Tenant Target)

| Dimension                 | Tier 1 (Startup) | Tier 2 (SMB) | Tier 3 (Enterprise) |
| ------------------------- | ---------------- | ------------ | ------------------- |
| Tenants                   | 1-10             | 11-100       | 101-500             |
| Users per tenant          | 5-50             | 50-500       | 500-5000            |
| Concurrent users (peak)   | 500              | 5,000        | 50,000              |
| API requests/sec (peak)   | 600              | 6,000        | 60,000              |
| pgvector queries/min      | 1,800            | 18,000       | 180,000             |
| Daily job search sessions | 2,000            | 20,000       | 200,000             |
| Resume compilations/day   | 500              | 5,000        | 50,000              |

### 1.3 Cognitive Architecture Capacity

| Component                    | Throughput           | Latency P95 | Scale Unit                         |
| ---------------------------- | -------------------- | ----------- | ---------------------------------- |
| Jev S1 (action routing)      | 200 calls/min        | 32ms        | Stateless; scale to provider limit |
| Jev S1 (HITL triage)         | 50 events/min        | 50ms        | Queue-backed                       |
| Gemma 4 31B (synthesis)      | 8 concurrent streams | 3,200ms     | GPU-bound; scale by API quota      |
| pgvector HNSW (retrieval)    | 300 queries/sec      | 14.2ms      | PG connection pool; scale replicas |
| Memory write (w/ provenance) | 150 writes/sec       | 8ms         | PG primary; horizontal via RLS     |

---

## 2. Resource Capacity Model

### 2.1 Compute

| Layer        | Dev (current)     | Tier 2 (target)                | Tier 3 (target)                 |
| ------------ | ----------------- | ------------------------------ | ------------------------------- |
| FastAPI pods | 1 (local Uvicorn) | 4 replicas (2 vCPU / 4GB each) | 16 replicas (4 vCPU / 8GB each) |
| Next.js pods | 1                 | 2 replicas                     | 8 replicas                      |
| PostgreSQL   | 1 (local)         | 1 primary + 2 read replicas    | Multi-AZ + pgBouncer            |
| MinIO        | 1 container       | MinIO distributed 4-node       | Cloud object storage (GCS/S3)   |

### 2.2 Connection Pool Targets

| Service                    | Dev      | Tier 2 | Tier 3 |
| -------------------------- | -------- | ------ | ------ |
| DB connections (pgBouncer) | 10       | 100    | 500    |
| Redis connections          | Not used | 50     | 200    |
| Jev S1 concurrent calls    | 5        | 50     | 200    |
| Gemma 4 concurrent calls   | 2        | 10     | 50     |

### 2.3 Storage Capacity

| Type                           | Dev   | Tier 2 | Tier 3 |
| ------------------------------ | ----- | ------ | ------ |
| PostgreSQL total               | 500MB | 50GB   | 2TB    |
| pgvector index                 | 50MB  | 5GB    | 100GB  |
| S3 objects (resumes/artifacts) | 1GB   | 100GB  | 5TB    |
| Audit log (WORM)               | 100MB | 10GB   | 500GB  |

---

## 3. Bottleneck Analysis

| Bottleneck                     | Current      | Headroom              | Resolution                              |
| ------------------------------ | ------------ | --------------------- | --------------------------------------- |
| Gemma 4 throughput (GPU-bound) | 8 concurrent | Provider API quota    | Scale via additional API keys; queue    |
| pgvector HNSW under high load  | 14.2ms p95   | 5.8ms headroom to SLO | Add read replicas; tune ef_search       |
| PDF render (Chromium)          | 3.2s p95     | 1.8s headroom         | Rate limit + async queue; Chromium pool |
| JWT key derivation             | 2.1ms p95    | 2.9ms headroom        | Cache active sessions                   |
| S3 object upload               | 180ms p95    | 820ms headroom        | Presigned URLs; multipart for >5MB      |

---

_Deliverable DEL-ENT-P15-01 v1.0.0 — Performance Engineer — 2026-09-29_
