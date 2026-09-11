# 01 Product Reality Assessment

## Product Surfaces Actually Present

- **Web App**: Next.js 15 App Router, 26+ workspace-scoped pages, 13+ global
  pages
- **Authentication**: Login, signup, forgot-password, reset-password,
  verify-email, OAuth callback, session-expired
- **Dashboard**: Workspace home with KPIs
- **Chat**: SSE streaming, multi-agent routing, approval flows
- **Agents**: 24 specialist agents with tool calling, memory access, approval
  gates
- **Memory**: Entity-based memory with vector embeddings (pgvector), knowledge
  graph
- **Resume**: Full editor, templates, PDF/DOCX generation, tailoring, ATS
  optimization
- **ATS**: Semantic scoring, keyword extraction, formatting audit
- **Jobs**: Job search, matching, ranking, applications
- **Files**: Upload, download, preview, document management
- **Connectors**: GraphQL, REST, MCP connectors + 6 integrations (calendar,
  email, github, google-drive, notion, slack)
- **Gmail**: OAuth, inbox sync, classification, deadline extraction
- **Schedule**: Calendar events, reminders, conflict detection
- **Settings**: Profile, workspace settings, privacy
- **Admin**: Enterprise-gated admin panel (falls back to mock data)
- **Approvals**: Human-in-the-loop approval for agent actions
- **Notifications**: Event-driven notifications
- **Search**: Global search across entities
- **History**: Audit trail viewing
- **Knowledge Graph**: Entity/relationship visualization
- **Billing**: Billing page (implementation depth unknown)
- **Vault**: Secrets/credentials management page
- **Organizations**: Multi-org management (enterprise-gated)
- **Feature Flags**: Enterprise feature flag management
- **Developer**: Developer portal with webhooks
- **Marketplace**: Plugin marketplace

## Classification Table

| Surface                 | Classification                  | Notes                                                  |
| ----------------------- | ------------------------------- | ------------------------------------------------------ |
| Web App                 | UNVERIFIED (IMPLEMENTED+REAL)   | Code inspection shows extensive implementation.        |
| Authentication          | UNVERIFIED (IMPLEMENTED+REAL)   | Full flow present in codebase.                         |
| Dashboard               | UNVERIFIED (IMPLEMENTED+REAL)   | UI and backend endpoints present.                      |
| Chat                    | UNVERIFIED (IMPLEMENTED+REAL)   | SSE and agent routing coded.                           |
| Agents                  | UNVERIFIED (IMPLEMENTED+REAL)   | Agent configs and ReAct loop present.                  |
| Memory                  | UNVERIFIED (IMPLEMENTED+REAL)   | pgvector and graph endpoints exist.                    |
| Resume                  | UNVERIFIED (IMPLEMENTED+REAL)   | Editor and generation logic present.                   |
| ATS                     | UNVERIFIED (IMPLEMENTED+REAL)   | Scoring algorithms and NLP implemented.                |
| Jobs                    | UNVERIFIED (IMPLEMENTED+REAL)   | Tracking and search implemented.                       |
| Files                   | UNVERIFIED (IMPLEMENTED+REAL)   | MinIO integration exists.                              |
| Connectors/Integrations | UNVERIFIED (IMPLEMENTED+REAL)   | OAuth and MCP connector logic present.                 |
| Gmail                   | UNVERIFIED (IMPLEMENTED+REAL)   | Sync and classification code present.                  |
| Schedule                | UNVERIFIED (IMPLEMENTED+REAL)   | Calendar logic present.                                |
| Settings                | UNVERIFIED (IMPLEMENTED+REAL)   | Standard settings implemented.                         |
| Admin                   | UNVERIFIED (IMPLEMENTED+MOCKED) | Falls back to mock data if backend endpoints disabled. |
| Approvals               | UNVERIFIED (IMPLEMENTED+REAL)   | Human-in-the-loop logic present.                       |
| Notifications           | UNVERIFIED (IMPLEMENTED+REAL)   | Event-driven architecture present.                     |
| Search                  | UNVERIFIED (IMPLEMENTED+REAL)   | Global search endpoints coded.                         |
| History                 | UNVERIFIED (IMPLEMENTED+REAL)   | Audit trail logs exist.                                |
| Knowledge Graph         | UNVERIFIED (IMPLEMENTED+REAL)   | Visualizations and graph models exist.                 |
| Billing                 | UNVERIFIED (UNKNOWN)            | Page exists, depth unknown.                            |
| Vault                   | UNVERIFIED (IMPLEMENTED+REAL)   | Secrets management coded.                              |
| Organizations           | UNVERIFIED (IMPLEMENTED+REAL)   | Multi-org endpoints present.                           |
| Feature Flags           | UNVERIFIED (IMPLEMENTED+REAL)   | Flag management exists.                                |
| Developer               | UNVERIFIED (IMPLEMENTED+REAL)   | Webhooks and portal present.                           |
| Marketplace             | UNVERIFIED (IMPLEMENTED+REAL)   | Plugin logic exists.                                   |

_Note: Most features are IMPLEMENTED+REAL based on code inspection, but are
completely UNVERIFIED at runtime._
