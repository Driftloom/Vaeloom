# Module 05: Security Threat Model & STRIDE Analysis
**Audit Identifier**: `AUD-M05-AI-02`
**Scope**: STRIDE threat modeling across workspace boundaries, file ingestion, RAG, and autonomous agent loops.

---

## 1. STRIDE Analysis

| Threat Category | Potential Attack Vector | Applied Mitigation | Verification Test |
|---|---|---|---|
| **Spoofing** | Attacker crafts bearer token or impersonates workspace owner | `TenantMiddleware` validates JWT signatures against 32+ character secrets, verifies tenant binding | `test_module05_auth.py` |
| **Tampering** | Parameter tampering: agent or user specifies `workspace_id` of another workspace in tool arguments | `execute_tool()` enforces `param_ws == ctx_ws`; raises `PermissionDeniedError` on mismatch | `test_module05_tools.py` |
| **Repudiation** | Mutating document operations performed without audit record | `DocumentAction` records every `rename`, `archive`, `restore`, and `share` operation with user ID | `test_module05_core.py` |
| **Information Disclosure** | Cross-tenant document retrieval via vector search or tsvector queries | RLS policies on `documents` table + mandatory `workspace_id` filter in `VectorStore.search()` | `test_module05_multitenancy.py`, `test_module05_rag.py` |
| **Denial of Service** | Oversized file uploads, zip bombs, or infinite agent tool execution loops | `BodySizeLimitMiddleware` (25MB limit), `LoopSafetyTracker` cycle detection + token/cost caps | `test_module05_privacy.py`, `test_module05_cost.py` |
| **Elevation of Privilege** | Attacker uploads polyglot shell script or indirect prompt injection to hijack agent autonomy | `FileSecurityService` magic bytes inspection, `PromptInjectionMiddleware` scanning, and zero-vector quarantine | `test_module05_file_security.py`, `test_module05_prompts.py` |

---

## 2. Adversarial Penetration Findings

1. **IDOR Defense**: Proved in `test_module05_adversarial_suite.py` — an authenticated attacker in `Workspace A` attempting to access `/api/v1/documents/{id}/content?workspace_id=ws_victim` is rejected with `401/403/404` fail-closed.
2. **Polyglot & Script Rejection**: Verified in `test_module05_file_security.py` — files containing Windows PE (`MZ`), Linux ELF (`\x7fELF`), Unix shell scripts (`#!/bin/bash`), or batch files (`.bat`) are rejected immediately prior to storage.
3. **Malware Quarantine**: EICAR test signature triggers `MALICIOUS` scan status and quarantine isolation.
