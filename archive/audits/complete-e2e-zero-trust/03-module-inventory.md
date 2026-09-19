# Module Inventory

| ID  | Module           | Submodule          | Capability                 | Implementation Status | Runtime Verified | Risk Level |
| --- | ---------------- | ------------------ | -------------------------- | --------------------- | ---------------- | ---------- |
| 01  | Auth             | Local Login        | Password/Bcrypt Auth       | IMPLEMENTED           | UNVERIFIED       | P1         |
| 01  | Auth             | JWT Issuance       | Access & Refresh Tokens    | IMPLEMENTED           | UNVERIFIED       | P1         |
| 01  | Auth             | CSRF Protection    | Double-submit cookie       | IMPLEMENTED           | UNVERIFIED       | P1         |
| 01  | Auth             | Rate Limiting      | Sliding Window (Redis)     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 01  | Auth             | OAuth              | Google/Microsoft SSO       | IMPLEMENTED           | UNVERIFIED       | P2         |
| 01  | Auth             | Revocation         | In-memory token blocklist  | IMPLEMENTED           | UNVERIFIED       | P0         |
| 02  | Tenant Isolation | RLS                | PostgreSQL Row-Level Sec   | IMPLEMENTED           | UNVERIFIED       | P0         |
| 02  | Tenant Isolation | Tenant Middleware  | JWT tenant extraction      | IMPLEMENTED           | UNVERIFIED       | P0         |
| 02  | Tenant Isolation | GUC Context        | SET LOCAL GUCs             | IMPLEMENTED           | UNVERIFIED       | P0         |
| 02  | Tenant Isolation | Bypass RLS         | vaeloom_app role checks    | IMPLEMENTED           | UNVERIFIED       | P1         |
| 02  | Tenant Isolation | Cross-tenant       | Workspace boundary check   | IMPLEMENTED           | UNVERIFIED       | P0         |
| 03  | Onboarding       | Workspace Creation | Init workspace defaults    | PARTIAL               | UNVERIFIED       | P2         |
| 03  | Onboarding       | User Setup         | Profile and settings       | PARTIAL               | UNVERIFIED       | P2         |
| 03  | Onboarding       | Flow Routing       | Initial experience routing | PARTIAL               | UNVERIFIED       | P3         |
| 04  | Connectors       | OAuth Flows        | Token exchange & refresh   | IMPLEMENTED           | UNVERIFIED       | P1         |
| 04  | Connectors       | Integrations       | Calendar, email, GH, etc   | IMPLEMENTED           | UNVERIFIED       | P2         |
| 04  | Connectors       | MCP Integration    | Server capabilities        | IMPLEMENTED           | UNVERIFIED       | P1         |
| 04  | Connectors       | Webhooks           | Event sync processing      | IMPLEMENTED           | UNVERIFIED       | P2         |
| 05  | Workspace        | CRUD               | Create/Read/Update/Del     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 05  | Workspace        | Files              | File management/Storage    | IMPLEMENTED           | UNVERIFIED       | P2         |
| 06  | Ingestion        | Upload             | Document ingest API        | IMPLEMENTED           | UNVERIFIED       | P2         |
| 06  | Ingestion        | Parsing            | Unstructured extraction    | IMPLEMENTED           | UNVERIFIED       | P2         |
| 07  | Organization     | Org Agent          | Top-level orchestrator     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 07  | Organization     | Hierarchy          | Org structure mapping      | IMPLEMENTED           | UNVERIFIED       | P2         |
| 08  | Memory           | Entities           | Graph entity storage       | IMPLEMENTED           | UNVERIFIED       | P1         |
| 08  | Memory           | Vectors            | pgvector storage           | IMPLEMENTED           | UNVERIFIED       | P1         |
| 08  | Memory           | Relationships      | Edge persistence           | IMPLEMENTED           | UNVERIFIED       | P2         |
| 09  | Knowledge Graph  | Traversal          | Graph query resolution     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 09  | Knowledge Graph  | Inference          | Relationship deduction     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 10  | RAG              | Hybrid Search      | Vector + Keyword search    | IMPLEMENTED           | UNVERIFIED       | P2         |
| 10  | RAG              | Graph RAG          | Graph-augmented gen        | IMPLEMENTED           | UNVERIFIED       | P2         |
| 11  | Orchestration    | ReAct Loop         | Main reasoning loop        | IMPLEMENTED           | UNVERIFIED       | P1         |
| 11  | Orchestration    | Supervisor         | Sub-agent management       | IMPLEMENTED           | UNVERIFIED       | P1         |
| 11  | Orchestration    | Gates              | Human-in-loop approvals    | IMPLEMENTED           | UNVERIFIED       | P1         |
| 12  | Agents           | Registry           | Agent card discovery       | IMPLEMENTED           | UNVERIFIED       | P2         |
| 12  | Agents           | Execution          | Agent isolation context    | IMPLEMENTED           | UNVERIFIED       | P2         |
| 13  | Chat             | Streaming          | SSE message delivery       | IMPLEMENTED           | UNVERIFIED       | P2         |
| 13  | Chat             | Multi-agent        | Thread handover            | IMPLEMENTED           | UNVERIFIED       | P2         |
| 14  | Resume           | Templates          | Generation formats         | IMPLEMENTED           | UNVERIFIED       | P3         |
| 14  | Resume           | Tailoring          | JD-specific adaptation     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 15  | ATS              | Scoring            | Semantic match metrics     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 15  | ATS              | Keywords           | Required term extraction   | IMPLEMENTED           | UNVERIFIED       | P2         |
| 16  | Career           | Gap Analysis       | Skill delta assessment     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 16  | Career           | Pathing            | Next-role suggestions      | IMPLEMENTED           | UNVERIFIED       | P3         |
| 17  | Applications     | Tracking           | Pipeline progression       | IMPLEMENTED           | UNVERIFIED       | P2         |
| 17  | Applications     | Autofill           | Form completion assist     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 18  | Gmail            | Sync               | Message extraction         | IMPLEMENTED           | UNVERIFIED       | P1         |
| 18  | Gmail            | Classification     | Relevance tagging          | IMPLEMENTED           | UNVERIFIED       | P2         |
| 19  | Scheduler        | Calendar           | Event synchronization      | IMPLEMENTED           | UNVERIFIED       | P2         |
| 19  | Scheduler        | Conflicts          | Double-booking prevent     | IMPLEMENTED           | UNVERIFIED       | P2         |
| 20  | Dashboard        | Home               | Aggregated metrics         | IMPLEMENTED           | UNVERIFIED       | P3         |
| 20  | Dashboard        | Activity           | Recent event feed          | IMPLEMENTED           | UNVERIFIED       | P3         |
| 21  | Search           | Global             | Cross-entity indexing      | IMPLEMENTED           | UNVERIFIED       | P2         |
| 21  | Search           | Filters            | Faceted refinement         | IMPLEMENTED           | UNVERIFIED       | P3         |
| 22  | Events           | Daemon             | Background processing      | PARTIAL               | UNVERIFIED       | P2         |
| 22  | Events           | Event Bus          | Message distribution       | PARTIAL               | UNVERIFIED       | P2         |
| 23  | Audit            | Logging            | AuditMiddleware            | IMPLEMENTED           | UNVERIFIED       | P1         |
| 23  | Audit            | Events             | audit_events storage       | IMPLEMENTED           | UNVERIFIED       | P2         |
| 24  | Permissions      | Scopes             | Route-level scopes         | IMPLEMENTED           | UNVERIFIED       | P1         |
| 24  | Permissions      | Gates              | Action approvals           | IMPLEMENTED           | UNVERIFIED       | P1         |
| 25  | Security         | Middleware         | 13 protection layers       | IMPLEMENTED           | UNVERIFIED       | P0         |
| 25  | Security         | Headers            | CSP/HSTS/Frame-Opt         | IMPLEMENTED           | UNVERIFIED       | P1         |
| 26  | Data Lifecycle   | Erasure            | GDPR deletion service      | IMPLEMENTED           | UNVERIFIED       | P1         |
| 26  | Data Lifecycle   | Retention          | Age-out policies           | IMPLEMENTED           | UNVERIFIED       | P2         |
| 27  | Observability    | OTel               | Distributed tracing        | IMPLEMENTED           | UNVERIFIED       | P2         |
| 27  | Observability    | Metrics            | Prometheus endpoints       | IMPLEMENTED           | UNVERIFIED       | P2         |
| 27  | Observability    | Logs               | Correlation IDs            | IMPLEMENTED           | UNVERIFIED       | P2         |
| 28  | Performance      | Latency            | API response times         | UNKNOWN               | UNVERIFIED       | P2         |
| 28  | Performance      | Throughput         | Req/sec limits             | UNKNOWN               | UNVERIFIED       | P2         |
| 29  | Cost             | Tracking           | Token usage metrics        | PARTIAL               | UNVERIFIED       | P2         |
| 29  | Cost             | Billing            | Invoice generation         | PARTIAL               | UNVERIFIED       | P2         |
| 30  | UX               | Responsiveness     | Mobile/Desktop views       | UNKNOWN               | UNVERIFIED       | P3         |
| 30  | UX               | State              | Loading indicators         | UNKNOWN               | UNVERIFIED       | P3         |
| 31  | Accessibility    | ARIA               | Screen reader support      | UNKNOWN               | UNVERIFIED       | P3         |
| 31  | Accessibility    | Contrast           | Color ratios               | UNKNOWN               | UNVERIFIED       | P3         |
| 32  | Documentation    | ADRs               | Architecture records       | IMPLEMENTED           | UNVERIFIED       | P3         |
| 32  | Documentation    | OpenAPI            | Swagger/Redoc specs        | IMPLEMENTED           | UNVERIFIED       | P3         |
