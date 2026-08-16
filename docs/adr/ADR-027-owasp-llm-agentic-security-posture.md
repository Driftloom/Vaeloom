# ADR-027: OWASP LLM/Agentic Security Posture

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **Status**   | Accepted                         |
| **Date**     | 2026-08-16                       |
| **Deciders** | Security Architect, AI Architect |
| **Owner**    | Security Team                    |
| **Tags**     | security, ai, owasp, compliance  |

## Context

Vaeloom runs 24 specialized AI agents with tool access, persistent memory, and
multi-agent orchestration. The OWASP Top 10 for LLM Applications (2025 v2.0) and
the newer OWASP Top 10 for Agentic Applications (ASI01-ASI10, 2026) define the
relevant threat landscape. Without a formal mapping, security controls are
ad-hoc and audit evidence is incomplete.

## Decision

We will formally map Vaeloom's security controls to both OWASP frameworks and
maintain this mapping as a living document.

### OWASP LLM Top 10 Mapping

| OWASP LLM Risk                              | Vaeloom Exposure                                          | Current Mitigation                               | Status                                      |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| **LLM01: Prompt Injection**                 | High — agents process user documents, emails, web content | Pydantic validation; agent system prompts        | ⚠️ No dedicated prompt injection classifier |
| **LLM02: Sensitive Information Disclosure** | High — memory stores personal data                        | AES-256 encryption; tenant isolation             | ⚠️ No output filtering for PII leaks        |
| **LLM03: Supply Chain**                     | Medium — OpenAI/Anthropic API dependencies                | API key rotation; circuit breaker (ADR-017)      | ⚠️ No model provider failover               |
| **LLM04: Data and Model Poisoning**         | High — knowledge graph ingest                             | Append-only audit trail                          | ⚠️ No embedding validation                  |
| **LLM05: Improper Output Handling**         | Medium — agent outputs in UI                              | React auto-escaping; DOMPurify                   | ✅ Adequate                                 |
| **LLM06: Excessive Agency**                 | Critical — tool access, memory write, email draft         | Permission Engine (4-axis); suggest-mode default | ⚠️ Static tool allowlist                    |
| **LLM07: System Prompt Leakage**            | Medium — system prompts contain mission details           | Not addressed                                    | ❌ No guard                                 |
| **LLM08: Vector and Embedding Weaknesses**  | High — pgvector store                                     | Tenant-scoped queries                            | ⚠️ No embedding integrity check             |
| **LLM09: Misinformation**                   | Medium — agent hallucination                              | QA Agent; confidence threshold (<0.8)            | ⚠️ No grounding verification                |
| **LLM10: Unbounded Consumption**            | Medium — LLM API costs                                    | Rate limiting (ADR-012); per-agent limits        | ⚠️ No token budget per request              |

### OWASP Agentic Top 10 Mapping

| ASI Risk                                      | Vaeloom Exposure                          | Mitigation                           | Status                               |
| --------------------------------------------- | ----------------------------------------- | ------------------------------------ | ------------------------------------ |
| **ASI01: Agent Goal Hijack**                  | Critical — orchestrator routes agents     | Orchestrator + QA Agent              | ⚠️ No behavioral baseline            |
| **ASI02: Tool Misuse**                        | High — MCP tools (Gmail, GitHub, Drive)   | Permission Engine per tool call      | ✅ Runtime enforcement               |
| **ASI03: Identity/Privilege Abuse**           | High — shared workspace credentials       | Per-agent tool scope                 | ⚠️ No per-agent credential isolation |
| **ASI04: Agentic Supply Chain**               | Medium — plugin SDK, MCP tools            | Plugin sandbox (ADR-008)             | ✅ Subprocess isolation              |
| **ASI05: Unexpected Code Execution**          | Medium — plugin sandbox                   | Subprocess isolation                 | ⚠️ No egress restriction             |
| **ASI06: Memory/Context Poisoning**           | Critical — memory is core product         | No input validation on memory writes | ❌ No anomaly detection              |
| **ASI07: Insecure Inter-Agent Communication** | Medium — via Orchestrator                 | No direct agent-to-agent calls       | ✅ Star topology                     |
| **ASI08: Cascading Agent Failures**           | High — agent chain: Memory→Org→Resume→ATS | Circuit breaker (ADR-017)            | ⚠️ No inter-agent breaker            |
| **ASI09: Rogue Agents**                       | Low — statically configured               | Agent config validated in CI         | ✅                                   |
| **ASI10: Resource/Rate Abuse**                | Medium — LLM API costs                    | Per-agent rate limits                | ⚠️ No per-workflow budget            |

## Rationale

A formal OWASP mapping is required by:

- NIST AI RMF (GOVERN function: risk identification)
- EU AI Act (transparency obligations from 2026-08-02)
- SOC 2 Type II (security control documentation)
- The MVP-P05 prompt (Section 4: "OWASP Top 10 for Agentic Applications")

Without this mapping, we cannot claim any security posture is "designed" rather
than "accidental."

## Alternatives Considered

| Option                        | Pros                        | Cons                     | Why Not            |
| ----------------------------- | --------------------------- | ------------------------ | ------------------ |
| Ad-hoc security reviews       | Low effort                  | Incomplete, unrepeatable | Audit failure risk |
| Third-party pen test only     | External validation         | Point-in-time, expensive | Not continuous     |
| Formal OWASP mapping (chosen) | Complete, auditable, living | Initial effort ~2 days   | —                  |

## Consequences

**Positive:**

- Security controls are explicitly documented and auditable
- Gaps are identified and tracked (see Status column above)
- Compliance evidence for NIST AI RMF, EU AI Act, SOC 2

**Negative:**

- Maintenance burden: must update when OWASP releases new versions
- Exposes gaps that need remediation (ASI06, LLM07 are currently ❌)

**Risks:**

- Mapping may become stale if not reviewed quarterly

## Compliance & Safety Notes

- EU AI Act: Transparency obligations applicable from 2026-08-02 require
  documented risk identification for AI systems.
- NIST AI RMF: GOVERN function requires "risk management practices are
  established, implemented, and continuously improved."
- SOC 2: Security control documentation is a Trust Services Criteria
  requirement.

## Verification

1. Grep for `OWASP` in `docs/security/` — mapping document exists
2. Verify each ✅/⚠️/❌ status against actual code
3. Quarterly review: update statuses, track gap remediation

## Related ADRs

- ADR-007: JWT Auth (authentication controls)
- ADR-012: Rate Limiting (LLM10 mitigation)
- ADR-017: Circuit Breaker (ASI08 mitigation)
- ADR-008: Plugin Sandbox (ASI04/ASI05 mitigation)

## Reversibility

Easy — this is a documentation-only ADR. No code changes required.
