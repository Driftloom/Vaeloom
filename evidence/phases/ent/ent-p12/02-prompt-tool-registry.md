# ENT-P12 — 02 Prompt & Tool Registry Specification

> **Phase:** `ENT-P12` (AI Agent Memory and Data Pipeline Implementation)  
> **Deliverable:** `DEL-ENT-P12-02` (v1.0)  
> **Owner:** Principal AI Safety Engineer & Tooling Architect  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Tool Classification & Trust Tiers

Tools available to the Vaeloom agent ecosystem are strictly partitioned into
five verifiable trust tiers to enforce least privilege, deterministic execution
bounds, and zero-trust isolation:

| Category              | Default Timeout | Max Retries | Required Scope          | Trust Tier                            | Idempotent |
| :-------------------- | :-------------: | :---------: | :---------------------- | :------------------------------------ | :--------: |
| `memory_read`         |       2s        |     3x      | `memory.read`           | `core_trusted`                        |  **Yes**   |
| `memory_write`        |       2s        |     3x      | `memory.write`          | `core_trusted`                        |   **No**   |
| `connector_read`      |       5s        |     3x      | `connector.<int>.read`  | `first_party`                         |  **Yes**   |
| `connector_write`     |       10s       |     3x      | `connector.<int>.write` | `first_party` (approval gated)        |   **No**   |
| `system`              |       1s        |     1x      | `system.execute`        | `core_trusted`                        |  **Yes**   |
| `mcp.read`            |       5s        |     2x      | `connector.mcp.execute` | `mcp.read`                            |  **Yes**   |
| `mcp.workspace.write` |       10s       |     2x      | `connector.mcp.execute` | `mcp.workspace.write`                 |   **No**   |
| `mcp.external.write`  |       15s       |     1x      | `connector.mcp.execute` | `mcp.external.write` (approval gated) |   **No**   |

---

## 2. MCP v2 Capability Bridging & Sandboxing Boundaries

External integrations adhering to the Model Context Protocol (MCP v2 profile
2026-07-28) operate within strict capability sandboxes
(`services/mcp_client_service.py`):

1. **Network SSRF Guard:** All outbound network connections must pass
   `utils/url_guard.py`. The guard enforces `https://` only and drops loopback
   (`127.0.0.1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`,
   `192.168.0.0/16`), and AWS/GCP cloud metadata endpoints (`169.254.169.254`).
2. **Interpreter Ban:** Shell interpreters (`bash`, `sh`, `cmd.exe`,
   `powershell`, `pwsh`) and shell metacharacters (`|`, `;`, `&`, `$`, `` ` ``)
   are denied at connector validation time.
3. **Automatic Approval Enrollment:** Any MCP tool whose schema does not
   explicitly declare `read_only_hint: true` is automatically categorized as
   `mcp.external.write` and enrolled into the Human-in-the-Loop (HITL) approval
   gate.
4. **Untrusted Data Fencing:** All tool execution responses returned by external
   MCP servers or web scraping tools are truncated to 4,000 characters and
   enclosed in `[UNTRUSTED_DATA]` structural fences to neutralize indirect
   prompt injection attacks.

---

## 3. Cryptographic Human-in-the-Loop (HITL) Approval Gating

Destructive, financial, or legally binding operations require an authentic
Human-in-the-Loop approval grant (`services/approval.py`):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENT PROPOSES ACTION                           │
│  - ApplicationAgent, GmailAgent, OrganizationAgent, or MCP write       │
│  - System 1 (TypeSafe AI Jev noul) triages action as destructive       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   HMAC-SHA256 APPROVAL TOKEN GENERATION                │
│  - Token = HMAC_SHA256(secret, action_id + workspace_id + payload_hash)│
│  - Nonce registered with 15-minute expiration in Redis cache           │
│  - Action paused in agent state store (orchestrator/state_store.py)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION VIA APPROVALCARD                   │
│  - UI renders explicit diff: target recipient, email body, resume diff │
│  - User submits cryptographically signed APPROVE / REJECT decision     │
│  - Replay prevention: Nonce instantly consumed; duplicate calls 409    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Prompt Template Engineering & XML Context Fencing

System prompts enforce strict separation between system instructions, candidate
context, and untrusted retrieval data:

```xml
<system_instructions>
You are an expert career advisory intelligence agent for Vaeloom.
You MUST NOT invent experience, employers, metrics, or credentials not present in the verified context.
All candidate claims must cite specific source memory IDs.
</system_instructions>

<document_context>
[UNTRUSTED_DATA]
<!-- Retrieved candidate profile, resume history, and job listings -->
</document_context>

<user_query>
Tailor my resume for the Senior Systems Architect position at Anthropic.
</user_query>
```

- **Prompt Versioning:** All prompts maintain Git-tracked semantic versions
  under `specs/prompts/` and `apps/api/src/api/prompts/`.
- **Negative Invariants:** Strictly prohibits generating fabricated quantitative
  achievements or altering candidate contact credentials.

---

_Signed: Principal AI Safety Engineer & Tooling Architect — 2026-09-29_
