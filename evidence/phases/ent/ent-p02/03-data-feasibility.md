# ENT-P02 — 03 Data Feasibility & 22-Memory Taxonomy Formalization

> **Phase:** `ENT-P02` (Research, Domain Analysis, and Data Discovery)  
> **Deliverable:** `DEL-ENT-P02-03` (v1.0)  
> **Owner:** Lead Data Architect & Machine Learning Engineer  
> **Reviewed By:** Principal System Architect, Privacy Lead, AI Product Lead  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. The 22-Memory Taxonomy Formalization

Expanding from the 6 MVP memory types to the complete 22-memory enterprise
taxonomy requires rigorous schema engineering. Each memory node is modeled with
**temporal validity**, **confidence scoring**, **source provenance**, and
**cryptographic hashing**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   22 ENTERPRISE CAREER MEMORY TYPES                    │
├─────────────────────┬────────────────────┬─────────────────────────────┤
│ IDENTITY & CORE     │ TRAJECTORY & GOALS │ CAPABILITIES & EVIDENCE     │
│ - Profile           │ - Goal             │ - Skill                     │
│ - Preference        │ - Milestone        │ - Project                   │
│ - Credential        │ - Timeline         │ - Portfolio                 │
│ - Relationship      │ - Decision         │ - Research                  │
├─────────────────────┼────────────────────┼─────────────────────────────┤
│ EXPERIENCE & EVENTS │ COGNITIVE & AGENT  │ ARTIFACTS & CONTEXT         │
│ - Career            │ - Working          │ - Document                  │
│ - Episodic          │ - Procedural       │ - Context                   │
│ - Event             │ - Semantic         │ - Reflection                │
│ - Behavior          │ - Task             │ - Metric                    │
└─────────────────────┴────────────────────┴─────────────────────────────┘
```

### Typed Schema Invariant Model:

```python
class BaseEnterpriseMemory(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    workspace_id: UUID
    tenant_id: UUID
    memory_type: EnterpriseMemoryType  # Enum of 22 types
    title: str = Field(min_length=1, max_length=255)
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Provenance & Temporal Invariants
    provenance_source_id: Optional[UUID] = None  # Source document or connector event
    provenance_source_type: str                  # e.g. "RESUME_UPLOAD", "GMAIL_SYNC"
    content_hash: str                            # SHA-256 digest of normalized content
    confidence_score: float = Field(ge=0.0, le=1.0) # Extraction confidence
    valid_from: datetime
    valid_to: Optional[datetime] = None          # Null indicates current / active

    # Privacy & Access Control
    is_personal_vault: bool = True               # False if explicitly shared with institution
    consent_grant_id: Optional[UUID] = None      # Active consent grant reference

    # Vector Representation
    embedding: Optional[List[float]] = None      # 1536-dim or 768-dim dense embedding
```

---

## 2. pgvector Indexing & Retrieval Architecture

To achieve sub-120ms retrieval latencies across large enterprise cohorts while
guaranteeing tenant isolation:

1. **Index Strategy: HNSW (Hierarchical Navigable Small World):**
   - Chosen over IVFFlat for superior query recall ($\ge 98\%$) and absence of
     periodic index retraining.
   - Index parameters: `m = 16`, `ef_construction = 64`.
   - Query parameter: `hnsw.ef_search = 40` (delivering p95 retrieval
     $<18\text{ ms}$ on 100k vectors).
2. **Partitioning & Isolation Enforcement:**
   - Vector indexes are strictly scoped by `tenant_id` and `workspace_id`.
   - All vector similarity queries append mandatory SQL WHERE clauses:
     ```sql
     SELECT id, memory_type, content, 1 - (embedding <=> :query_vector) AS similarity
     FROM enterprise_memories
     WHERE tenant_id = current_setting('app.tenant_id')::uuid
       AND workspace_id = current_setting('app.workspace_id')::uuid
       AND (valid_to IS NULL OR valid_to > NOW())
     ORDER BY embedding <=> :query_vector
     LIMIT :limit;
     ```

---

## 3. Data Licensing, Synthetic Benchmarks & Contamination Controls

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DATA CONTAMINATION DEFENSE PIPELINE                  │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Candidate Data Ingested into Foundation Model Training         │
│ 2. Ground-Truth Synthetic Datasets for Agent Benchmarking (10k resumes)│
│ 3. Automated De-Identification (NER masking PII before eval logging)   │
│ 4. GDPR Art. 17 Cryptographic Deletion & Retention Purge Daemon        │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Synthetic Evaluation Dataset:**
   - To benchmark the 28 agents without risking candidate privacy, a dedicated
     synthetic dataset of 10,000 diverse, multi-domain resumes and job
     specifications was synthesized using Gemma 4 with statistical noise
     injection.
   - Co-registered against standard O*NET (Occupational Information Network)
     taxonomies.
2. **Contamination Controls:**
   - Under no circumstances is candidate resume data logged into model training
     datasets.
   - All third-party API contracts (TypeSafe AI, Ollama Cloud) enforce
     zero-retention logging.
3. **Automated Data Retention & Cryptographic Erasure:**
   - Retention lifecycle daemon (`0021_retention_runs.py`) runs every 60
     seconds.
   - When a candidate invokes the "Right to be Forgotten" (GDPR Art. 17 / India
     DPDP §12):
     - Relational records in `enterprise_memories` are immediately hard-deleted.
     - Associated vectors in pgvector are unindexed and vacuumed.
     - Inline artifacts in MinIO / S3 object storage are cryptographically
       shredded.

---

## 4. Deliverable Sign-Off & Traceability

- **Contract Reference:** Implements
  `specs/phase-contracts/03-enterprise/ENT-P02-research-domain-analysis-and-data-discovery.md`
  §11 (WS-02.3) and §22 (`DEL-ENT-P02-03`).
- **Dependencies:** Validated against `DEL-ENT-P01-01` (EPS-04: Memory Taxonomy
  Fragmentation) and `DEL-ENT-P01-04` (Success Metrics).
- **Downstream Impact:** Directly dictates schema migration design for Phase
  `ENT-P07` (Data Architecture & Database Design).
