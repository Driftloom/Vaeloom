# ENT-P00 — 08 Consolidated Registers

> **Phase:** `ENT-P00` (Intake and Existing-State Assessment)  
> **Deliverable:** `DEL-ENT-P00-08` (v1.0)  
> **Status:** APPROVED BASELINE  
> **Commit:** `74a7550` | **Date:** 2026-09-19  
> **Authoritative Owner:** Program Office & Architecture Review Board

---

## 1. Architectural Decisions Log

| Decision ID    | Context & Problem                                          | Selected Architecture                                          | Impact & Rationale                                                                                        |
| :------------- | :--------------------------------------------------------- | :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **DEC-ENT-01** | Multi-tenancy isolation boundary in shared databases.      | Native PostgreSQL Row-Level Security (RLS) on all 42 tables.   | Eliminates cross-tenant data leakage at engine layer; eliminates need for expensive per-tenant DB spinup. |
| **DEC-ENT-02** | Agent hallucination recovery for unrecognized tool calls.  | Multi-stage fuzzy Levenshtein ranking + MCP namespace routing. | Prevents ReAct trajectory aborts; guides model to valid tools or explicit connector setup instructions.   |
| **DEC-ENT-03** | Scanned paper resume processing without external binaries. | In-memory PyMuPDF (`fitz`) rendering + PyTesseract OCR.        | Zero external Poppler dependencies; containerized and local execution works out-of-the-box.               |
| **DEC-ENT-04** | Knowledge graph traversal bounds in dense workspaces.      | Hard clamp `depth \in [1, 10]` and `max_nodes = 500`.          | Eliminates exponential BFS memory exhaustion and server crashes.                                          |

---

## 2. Active Waivers & Exceptions

| Exception ID   | Target Scope                                    | Justification                                                                                                  | Expiration Date | Owner      |          Status           |
| :------------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :-------------- | :--------- | :-----------------------: |
| **EXC-ENT-01** | Local Windows pytest parallelization (`-n 16`). | Windows named-pipe IPC locks on multi-worker SQLite runs; serial execution (`-o addopts=""`) is 100% reliable. | 2026-12-31      | DevEx Lead | **ACTIVE (NON-BLOCKING)** |

---

## 3. Change Requests & Backlog Ledger

| CR ID         | Module         | Requested Change                                                      | Priority | Target Phase |
| :------------ | :------------- | :-------------------------------------------------------------------- | :------: | :----------: |
| **CR-ENT-01** | Multi-Tenancy  | Enterprise SAML IdP SCIM 2.0 automatic user provisioning.             |    P1    |   ENT-P08    |
| **CR-ENT-02** | Admin Console  | Role-based fine-grained audit log export with tamper-evident hashing. |    P1    |   ENT-P09    |
| **CR-ENT-03** | Infrastructure | Terraform multi-region AWS/GCP cell deployment blueprints.            |    P1    |   ENT-P16    |
