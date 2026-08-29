# API Contract Mismatches — Frontend ↔ Backend

**Audit scope:** All frontend API interfaces vs backend Pydantic schemas
**Method:** Read every frontend type and backend schema, compare field-by-field

## Critical (P0)

### 1. Applications Status Case Mismatch

**Frontend** (`api-client.ts`):

```ts
const columns = [
  { id: 'draft', title: 'Draft' },
  ...
];
// Filter: a.status === col.id  → lowercase
```

**Backend** (`schemas/application.py:10`):

```python
status: str = "DRAFT"  # Uppercase
```

**Impact:** Kanban board always shows 0 cards. The Applications page we wired in
P10 is completely broken at runtime.

---

### 2. Applications Pagination Capped at 20

**Frontend** (`api-client.ts:677`):

```ts
list(workspaceId, params?): Promise<ApplicationResponse[]>
// No pagination params passed by default
```

**Backend** (`routers/applications.py:28`):

```python
@router.get("", response_model=list[applicationResponse])
# Internally paginates with page_size=20
```

**Impact:** Only first 20 applications returned. No way for frontend to fetch
more.

---

## High Severity

### 3. ConnectorResponse Missing `name` Field

**Frontend** (`api-client.ts:720-731`):

```ts
interface ConnectorResponseExt {
  name: string;  // REQUIRED
  ...
}
```

**Backend** (`schemas/connector.py` — used by workspace connectors endpoint):

```python
class ConnectorResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    type: str
    # NO name field!
```

**Impact:** `connector.name` is `undefined` for workspace connectors.

---

### 4. NotificationResponse `body` vs `message` Alias

**Frontend** (`api-client.ts:849`):

```ts
interface NotificationResponse {
  body: string; // expects "body" in JSON
}
```

**Backend** (`schemas/notification.py:39`):

```python
class NotificationResponse(BaseModel):
    body: str = Field(validation_alias="message")
```

**Impact:** `validation_alias` is for input deserialization. If DB column is
`message`, serializes as `body` (matches frontend). If DB column is `body`,
validation fails (500 error). Fragile.

---

### 5. MemoryCreateRequest Missing `domain`

**Frontend** (`api-client.ts:259-271`):

```ts
interface MemoryCreateRequest {
  type: string;
  title?: string;
  // NO domain field
}
```

**Backend** (`schemas/memory.py:10`):

```python
class MemoryCreate(BaseModel):
    type: str
    domain: str | None = None  # extra field
```

**Impact:** Not breaking (backend field is optional), but `domain` is always
None for frontend-created memories.

---

### 6. MemoryUpdateRequest Missing `domain`, `supersedes_id`

**Frontend** (`api-client.ts:273-281`):

```ts
interface MemoryUpdateRequest {
  type?: string;
  // NO domain, NO supersedes_id
}
```

**Backend** (`schemas/memory.py:24-33`):

```python
class MemoryUpdate(BaseModel):
    type: str | None = None
    domain: str | None = None
    supersedes_id: uuid.UUID | None = None
```

**Impact:** Cannot update `domain` or `supersedes_id` from frontend.

---

### 7. Workspace Shared Type Missing `description`

**Frontend** (`shared-types/workspace.ts:8-14`):

```ts
interface Workspace {
  id: UUID;
  userId: UUID;
  name: string;
  // NO description
  createdAt: ISO8601;
  updatedAt: ISO8601;
}
```

**Backend** (`schemas/workspace.py:16-23`):

```python
class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None = None  # extra field
    created_at: datetime
    updated_at: datetime
```

**Impact:** `description` silently dropped. Workspace descriptions show
`undefined`.

---

## Medium Severity

### 8. KnowledgeGraphNode — Multiple Mismatches

**Frontend** (`shared-types/memory.ts:29-36`):

```ts
interface KnowledgeGraphNode extends BaseEntity {
  embedding: number[]; // NOT in backend response
  description: string; // required
  importance: number;
}
```

**Backend** (`schemas/knowledge_graph.py:55-66`):

```python
class NodeResponse(BaseModel):
    description: str | None  # optional
    # NO embedding field
    tenant_id: str            # NOT in shared type
    edge_count: int | None    # NOT in shared type
```

**Impact:** `embedding` always `undefined`. `description` may be `undefined` at
runtime.

---

### 9. `duration_ms` vs `duration` Name Mismatch

**Frontend** (`shared-types/agent.ts:55-67`):

```ts
interface AgentExecution {
  duration?: number; // "duration"
}
```

**Backend** (`schemas/agent.py:46-60`):

```python
class ExecutionResponse(BaseModel):
    duration_ms: int | None  # "duration_ms"
```

**Impact:** `duration` is always `undefined` because backend sends
`duration_ms`.

---

### 10. Pagination Ignored in Multiple Endpoints

| Endpoint                  | Frontend                          | Backend                 | Issue                  |
| ------------------------- | --------------------------------- | ----------------------- | ---------------------- |
| `applicationApi.list()`   | `Promise<ApplicationResponse[]>`  | Paginated, page_size=20 | Capped at 20           |
| `schedulerApi.listJobs()` | `Promise<JobResponse[]>`          | Paginated               | No pagination metadata |
| `notificationApi.list()`  | `Promise<NotificationResponse[]>` | Paginated               | No pagination metadata |

Frontend never passes pagination params and never receives total count.

---

### 11. auditApi.export — POST Body vs Query Params

**Frontend** (`api-client.ts:1211-1213`):

```ts
export(params?): Promise<string> {
  return apiClient.post<string>('/audit/export', params);
  // Sends params as POST body JSON
}
```

**Backend** (`routers/audit.py:77-90`):

```python
@router.post("/export")
async def export_events(
    date_from: str | None = Query(None),  # Expects query params
    date_to: str | None = Query(None),
```

**Impact:** Backend expects query parameters, frontend sends POST body. Query
params always None. Exports ALL data unfiltered.

---

### 12. SearchResponse Extra `facet_counts`

**Frontend** (`api-client.ts:1015-1018`):

```ts
interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  // NO facet_counts
}
```

**Backend** (`schemas/search.py:22-25`):

```python
class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    facet_counts: dict[str, dict[str, int]]  # extra
```

**Impact:** `facet_counts` silently dropped. Wasted bandwidth.

---

## Summary Table

| #   | Severity | Endpoint                    | Issue                                     |
| --- | -------- | --------------------------- | ----------------------------------------- |
| 1   | **P0**   | `applicationApi.list()`     | Status case mismatch — Kanban empty       |
| 2   | **P0**   | `applicationApi.list()`     | No pagination, capped at 20               |
| 3   | HIGH     | `workspaceApi.connectors()` | Missing `name` field                      |
| 4   | HIGH     | `notificationApi`           | `body` vs `message` alias fragile         |
| 5   | HIGH     | `memoryApi.create()`        | Missing `domain` field                    |
| 6   | HIGH     | `memoryApi.update()`        | Missing `domain`, `supersedes_id`         |
| 7   | HIGH     | `workspaceApi.list()`       | Shared type missing `description`         |
| 8   | MEDIUM   | `knowledgeGraphApi`         | `embedding` missing, optional vs required |
| 9   | MEDIUM   | `agentApi.execute()`        | `duration_ms` vs `duration`               |
| 10  | MEDIUM   | scheduler/notifications     | Pagination ignored                        |
| 11  | MEDIUM   | `auditApi.export()`         | POST body vs query params                 |
| 12  | MEDIUM   | `searchApi.all()`           | Extra `facet_counts` dropped              |
