# Authorization & Role-Based Access Control (RBAC) Matrix

**Scope**: Modules 01–03 & Core Workspaces  
**Enforcement**: Service Layer + Middleware + PostgreSQL Row Level Security

---

## 1. Role Definitions

- **OWNER**: Creator/primary administrator of the workspace. Full read, write,
  invite, transfer, and delete permissions.
- **ADMIN**: Delegated workspace manager. Can invite members, update settings,
  execute agents, and manage connectors. Cannot delete workspace.
- **MEMBER**: Standard collaborator. Can read resources, write
  documents/memories, run agents. Cannot delete workspace or modify sensitive
  settings.
- **VIEWER**: Read-only collaborator. Can inspect documents, runs, and workspace
  data. Cannot run agents or mutate resources.
- **CROSS-TENANT / ANONYMOUS**: No authorization. Blocked with 401 or 404 (IDOR
  prevention).

---

## 2. Granular Permission Matrix

| Resource / Endpoint              | Action           | Anonymous   | Viewer         | Member      | Admin       | Owner       | Cross-Tenant User |
| :------------------------------- | :--------------- | :---------- | :------------- | :---------- | :---------- | :---------- | :---------------- |
| `POST /api/v1/auth/signup`       | Register         | ALLOW (201) | ALLOW (201)    | ALLOW (201) | ALLOW (201) | ALLOW (201) | ALLOW (201)       |
| `POST /api/v1/auth/login`        | Authenticate     | ALLOW (200) | ALLOW (200)    | ALLOW (200) | ALLOW (200) | ALLOW (200) | ALLOW (200)       |
| `GET /api/v1/auth/sessions`      | List Sessions    | DENY (401)  | ALLOW (200)    | ALLOW (200) | ALLOW (200) | ALLOW (200) | DENY (401)        |
| `DEL /api/v1/auth/sessions/{id}` | Revoke Session   | DENY (401)  | OWN ONLY       | OWN ONLY    | OWN ONLY    | OWN ONLY    | DENY (404/401)    |
| `GET /api/v1/workspaces`         | List Workspaces  | DENY (401)  | OWN/MEMBER     | OWN/MEMBER  | OWN/MEMBER  | OWN/MEMBER  | DENY (0 Rows)     |
| `GET /api/v1/workspaces/{id}`    | Read Workspace   | DENY (401)  | ALLOW (200)    | ALLOW (200) | ALLOW (200) | ALLOW (200) | DENY (404)        |
| `PATCH /api/v1/workspaces/{id}`  | Update Workspace | DENY (401)  | DENY (404/403) | ALLOW (200) | ALLOW (200) | ALLOW (200) | DENY (404)        |
| `DELETE /api/v1/workspaces/{id}` | Delete Workspace | DENY (401)  | DENY (404)     | DENY (404)  | DENY (404)  | ALLOW (204) | DENY (404)        |
| `GET /api/v1/onboarding`         | Get Onboarding   | DENY (401)  | OWN (200)      | OWN (200)   | OWN (200)   | OWN (200)   | DENY (401)        |
| `POST /api/v1/onboarding/step`   | Update Step      | DENY (401)  | OWN (200)      | OWN (200)   | OWN (200)   | OWN (200)   | DENY (401)        |
| `POST /api/v1/agents/chat`       | Execute Agent    | DENY (401)  | DENY (403)     | ALLOW (200) | ALLOW (200) | ALLOW (200) | DENY (404)        |
