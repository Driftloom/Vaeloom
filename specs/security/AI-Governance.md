# AI Governance & Model Card

**Document:** AI-GOV-Vaeloom-001 
**Version:** 1.0 
**Date:** 2026-08-21 
**Status:** COMPLETE 
**Phase:** MVP-P13 (Security, Privacy, and Compliance)

---

## 1. AI System Overview

### 1.1 System Description

Vaeloom is an enterprise AI platform that uses Large Language Models (LLMs) to:

- Orchestrate autonomous agents for task execution
- Manage long-term memory and knowledge graphs
- Parse and analyze documents (resumes, job descriptions)
- Provide conversational AI assistants

### 1.2 Intended Use

- Enterprise workflow automation
- Resume analysis and job matching
- Document summarization and knowledge extraction
- Calendar and communication management

### 1.3 Users

- Primary: Enterprise employees and contractors
- Secondary: Job applicants (resume processing)
- NOT intended for: General public, children, vulnerable populations

---

## 2. Model Selection & Configuration

### 2.1 Supported LLM Providers

| Provider | Models | Default Use |
| -------------- | ------------------------------ | ----------------------------------- |
| Anthropic | Claude Sonnet 4, Claude Opus 4 | Agent reasoning, tool use |
| OpenAI | GPT-4o, GPT-4o-mini | General inference, embeddings |
| Local (Ollama) | Various open-source | Development, air-gapped deployments |

### 2.2 Configuration Parameters

| Parameter | Default | Range | Purpose |
| ----------- | --------- | -------- | ------------------------------ |
| temperature | 0.7 | 0.0-1.0 | Response creativity control |
| max_tokens | 4096 | 1-128000 | Output length limit |
| top_p | 1.0 | 0.0-1.0 | Nucleus sampling |
| model | per-agent | - | Model selection per agent type |

### 2.3 Embeddings

- Provider: OpenAI `text-embedding-3-small`
- Dimensions: 1536
- Use case: Semantic search, memory similarity, knowledge graph

---

## 3. Agent Architecture

### 3.1 Agent Types

| Agent | Purpose | Autonomy Level |
| -------------- | ------------------------------ | -------------- |
| Orchestrator | Task decomposition and routing | Supervised |
| Memory Agent | Long-term memory management | Supervised |
| Tool Executor | External tool invocation | Sandboxed |
| QA Agent | Output validation | Independent |
| Research Agent | Information gathering | Supervised |

### 3.2 Safety Controls

| Control | Implementation | Status |
| ----------------- | ---------------------------------------- | ------ |
| Circuit breaker | Automatic failover after 3 failures | ACTIVE |
| Rate limiting | Per-agent request throttling | ACTIVE |
| Approval gate | Human-in-the-loop for sensitive actions | ACTIVE |
| Fallback policies | Graceful degradation on model failure | ACTIVE |
| Input validation | Prompt injection detection (14 patterns) | ACTIVE |
| Output filtering | Content policy enforcement | ACTIVE |

### 3.3 Tool Sandboxing

- All external tool execution via subprocess isolation
- No direct OS access from agent code
- Network access restricted to whitelisted endpoints
- File system access restricted to workspace directories

---

## 4. Data Governance

### 4.1 Training Data

- Vaeloom does NOT train its own models
- Uses third-party LLM APIs under their terms of service
- No user data is used for model training by providers (enterprise agreements)

### 4.2 Prompt Data Handling

- User prompts are sent to LLM providers for inference only
- No persistent storage of raw prompts (only derived memories)
- PII redaction available for sensitive content
- Consent required before agent data processing

### 4.3 Memory & Knowledge Graph

- Memories are user-scoped and tenant-isolated
- Knowledge graph edges are workspace-scoped
- Automatic expiration per retention policy
- User can delete all memories via GDPR export/delete

---

## 5. Bias & Fairness

### 5.1 Known Limitations

- Resume parsing may reflect existing biases in historical data
- Job matching recommendations are based on semantic similarity, not equity
 metrics
- LLM responses may reflect biases in training data

### 5.2 Mitigations

- No automated hiring decisions (human review required)
- Audit trail for all AI-generated recommendations
- Regular review of agent outputs for bias patterns
- Configurable prompts to reduce biased framing

---

## 6. Transparency & Explainability

### 6.1 User-Facing Transparency

- Clear indication when content is AI-generated
- Agent execution logs visible to workspace admins
- Audit trail for all AI actions (who, what, when)
- Model and provider information in API responses

### 6.2 Admin-Facing Transparency

- Agent performance metrics dashboard
- Token usage tracking per user/workspace
- Error rates and failure modes
- Circuit breaker event logging

---

## 7. Incident Response

### 7.1 AI-Specific Incidents

| Incident Type | Detection | Response |
| ------------------------- | ----------------- | ------------------------------ |
| Prompt injection detected | Middleware alert | Block request, log event |
| Agent runaway execution | Circuit breaker | Terminate, fallback to human |
| Data leak via LLM | Output monitoring | Quarantine, audit review |
| Model provider outage | Health checks | Fallback to secondary provider |

### 7.2 Escalation Path

1. Automated detection (middleware, circuit breaker)
2. Alert to engineering team (correlation ID)
3. Security review within 24 hours
4. DPO notification for PII incidents
5. User notification for data breaches (72-hour GDPR requirement)

---

## 8. Compliance Mapping

| Regulation | Requirement | Implementation |
| ----------------- | --------------------------- | ----------------------------- |
| GDPR Art. 13 | Right to information | Privacy policy, consent UI |
| GDPR Art. 15 | Right of access | GET /gdpr/export |
| GDPR Art. 17 | Right to erasure | POST /gdpr/delete |
| GDPR Art. 22 | Automated decision-making | No fully automated decisions |
| EU AI Act Art. 52 | Transparency for AI systems | AI-generated content labeling |
| SOC2 CC6.1 | Logical access controls | RBAC, JWT auth |
| SOC2 CC7.1 | System monitoring | Audit logs, OTel tracing |

---

## 9. Review & Updates

| Review | Frequency | Owner |
| --------------------- | --------------- | --------------- |
| Model card update | On model change | AI Team |
| Safety control review | Quarterly | Security Team |
| Bias assessment | Bi-monthly | AI Team + DPO |
| Compliance audit | Annually | Compliance Team |
