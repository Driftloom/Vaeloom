# Forbidden AST Dependency Audit: Zero-Trust Violations

## 1. Executive Summary

AST static analysis across all agent modules in `apps/api/src/api/agents/`
identified **28 illegal direct database and ORM imports**.

### Strict Architectural Rule Violated

> **Agents must NEVER import `database`, `models`, `sqlalchemy`, or execute
> direct database queries.**  
> All persistence, retrieval, and state mutations must be mediated exclusively
> through typed contracts in `packages/agent-contracts/` and domain services in
> `packages/domain/` or `packages/agent-memory/`.

---

## 2. Complete Inventory of Discovered Prohibited Dependencies

| Offending Agent File               | Line Number | Illegal Import Statement                                        | Violated Boundary            |    Severity     | Required Remediation            |
| :--------------------------------- | :---------- | :-------------------------------------------------------------- | :--------------------------- | :-------------: | :------------------------------ |
| `agents\memory\consolidator.py`    | Line 12     | `from sqlalchemy import select`                                 | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory\consolidator.py`    | Line 14     | `from api.database import scoped_session`                       | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory\consolidator.py`    | Line 15     | `from api.models.schema import Entity`                          | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory\consolidator.py`    | Line 213    | `from sqlalchemy.exc import IntegrityError`                     | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory\consolidator.py`    | Line 241    | `from api.models.schema import LearningEvent`                   | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\handler.py`   | Line 10     | `from sqlalchemy import func`                                   | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\handler.py`   | Line 94     | `from database import scoped_session`                           | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\handler.py`   | Line 95     | `from models.schema import Entity, Memory, Relationship`        | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\handler.py`   | Line 107    | `from sqlalchemy import select`                                 | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\merge.py`     | Line 35     | `from sqlalchemy import select`                                 | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\merge.py`     | Line 37     | `from api.database import scoped_session`                       | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\merge.py`     | Line 38     | `from api.models.schema import Entity`                          | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 32     | `from sqlalchemy import select, text`                           | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 34     | `from api.database import scoped_session`                       | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 35     | `from api.models.schema import Embedding, Entity, MemoryRecord` | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 70     | `from api.models.schema import DocumentChunk`                   | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 137    | `from api.models.schema import DocumentChunk`                   | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 145    | `from api.models.schema import Memory`                          | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 155    | `from api.models.schema import Memory`                          | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 184    | `from sqlalchemy import select`                                 | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 186    | `from api.models.schema import Embedding`                       | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 215    | `from sqlalchemy import or_, select`                            | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 217    | `from api.database import scoped_session`                       | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 218    | `from api.models.schema import Entity, MemoryRecord`            | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 267    | `from api.models.schema import DocumentChunk`                   | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 294    | `from sqlalchemy import or_, select`                            | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 296    | `from api.database import scoped_session`                       | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |
| `agents\memory_agent\retrieval.py` | Line 297    | `from api.models.schema import Entity, Relationship`            | Direct Database / SQL Import | **P0 SECURITY** | Route via Memory/Domain Service |

---

## 3. Forensic Impact Analysis

1. **Schema Coupling & Information Leakage**:
   - `consolidator.py`, `merge.py`, and `retrieval.py` directly instantiate
     SQLAlchemy models (`Entity`, `Memory`, `Relationship`, `Embedding`,
     `DocumentChunk`) and run raw SQL `select(...)` statements.
   - Any database migration or schema refactor breaks agent execution directly.
2. **Bypass of RLS and Authorization Gates**:
   - Direct session queries inside agents risk executing outside
     `TenantMiddleware` context or using naked session parameters, potentially
     leaking memory records across workspace boundaries.
3. **Naked Imports Bug**:
   - `agents/memory_agent/handler.py:94-95` imports
     `from database import scoped_session` and `from models.schema import ...`.
     This only succeeds if the working directory or `PYTHONPATH` includes
     `apps/api/src/api`, causing failures in modular package setups.
