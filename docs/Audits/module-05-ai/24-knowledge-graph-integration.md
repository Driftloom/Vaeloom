# Module 05: Knowledge Graph Integration & Propagation
**Audit Identifier**: `AUD-M05-AI-24`
**Scope**: Entity & Relationship schema, document hub nodes, entity extraction, and sovereign graph querying.

---

## 1. Graph Topology

Implemented in `api/models/schema.py` (`Entity`, `Relationship`) and `api/temporal/activities.py` (`index_graph`):
- **Document as Hub Node**: When a document is indexed, an `Entity` of type `"document"` is created.
- **Extracted Entities**: Concepts, projects, people, technologies, and organizations extracted from document text are represented as `Entity` records.
- **Relationships**: Edges (`Relationship`) connect the document entity to extracted concept nodes (e.g. `MENTIONS`, `DEFINES`, `AUTHORED_BY`).

---

## 2. Graph Scoping & Authorization

All graph operations strictly scope to `workspace_id`. Cross-workspace graph queries or edge traversals are prevented by foreign key and RLS constraints.

---

## 3. Verification Evidence

- `test_module05_knowledge_graph.py`:
  - `test_kg_write_scope_enforcement`: Verifies write scope constraints on graph updates.
  - `test_kg_document_propagation`: Verifies creation of document hub entity and relationship edges.
