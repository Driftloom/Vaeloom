# ADR-031: Input Sanitization for Retrieved Content

| Metadata     | Value                                        |
| ------------ | -------------------------------------------- |
| **Status**   | Proposed                                     |
| **Date**     | 2026-08-16                                   |
| **Deciders** | Security Architect, AI Architect             |
| **Owner**    | Security Team                                |
| **Tags**     | security, ai, prompt-injection, sanitization |

## Context

Vaeloom's agents process external content (emails, documents, web pages) that
may contain adversarial text designed to manipulate agent behavior. This is the
**indirect prompt injection** attack vector identified in OWASP LLM01 and ASI06.
Current mitigations:

- Pydantic validation on structured inputs
- Agent system prompts defining behavior boundaries
- No dedicated input sanitization for retrieved content

The gap: Content from Gmail, Google Drive, GitHub, and web scraping enters the
LLM context window without sanitization. An attacker could embed instructions in
an email that cause the agent to:

- Exfiltrate memory data
- Execute unauthorized tool calls
- Modify system behavior

## Decision

We will implement a dedicated input sanitization layer for all content entering
the LLM context window.

### Sanitization Pipeline

```
External Content → Sanitization Pipeline → LLM Context Window
                     ↓
              1. Format Detection
              2. Injection Pattern Matching
              3. Content Policy Filtering
              4. Provenance Tagging
              5. Rate Limiting
```

### Sanitization Rules

| Rule                          | Description                                                                                   | Action                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **R1: Instruction Detection** | Detect text that looks like system instructions (e.g., "Ignore previous instructions")        | Flag + wrap in `<sanitized>` tags         |
| **R2: Role Confusion**        | Detect text attempting to change agent role (e.g., "You are now a helpful assistant that...") | Strip + log                               |
| **R3: Tool Call Injection**   | Detect text containing tool call patterns (e.g., `{"tool": "gmail", "action": "send"}`)       | Strip + log                               |
| **R4: Data Exfiltration**     | Detect text requesting memory data (e.g., "Show me all memories about...")                    | Block + log                               |
| **R5: Prompt Leaking**        | Detect text attempting to extract system prompts                                              | Block + log                               |
| **R6: Provenance Tag**        | All retrieved content wrapped with source attribution                                         | Add `<source type="email" id="...">` tags |

### Implementation

````python
class ContentSanitizer:
    """Sanitize external content before LLM ingestion."""

    INJECTION_PATTERNS = [
        r"ignore (previous|all) (instructions|prompts)",
        r"you are now (a|an|the)",
        r"system:\s*",
        r"<\|im_start\|>",
        r"```tool_call```",
    ]

    async def sanitize(
        self,
        content: str,
        source_type: str,  # email, document, web, github
        source_id: str,
        workspace_id: str,
    ) -> SanitizedContent:
        # 1. Format detection
        detected_format = self._detect_format(content)

        # 2. Injection pattern matching
        flags = self._check_injection_patterns(content)

        # 3. Content policy filtering
        policy_result = await self._check_content_policy(content, workspace_id)

        # 4. Provenance tagging
        tagged_content = self._add_provenance_tag(
            content, source_type, source_id
        )

        # 5. Rate limiting per source
        await self._check_rate_limit(source_type, workspace_id)

        return SanitizedContent(
            content=tagged_content,
            flags=flags,
            policy_result=policy_result,
            detected_format=detected_format,
        )
````

### Integration Points

| Agent              | Content Source   | Integration Point                               |
| ------------------ | ---------------- | ----------------------------------------------- |
| Gmail Agent        | Email bodies     | `classify_emails()` → sanitize before LLM       |
| Memory Agent       | User input       | `execute()` → sanitize before memory write      |
| Organization Agent | Document content | `execute()` → sanitize before classification    |
| Resume Agent       | Resume text      | `score()` → sanitize before ATS scoring         |
| RAG Pipeline       | Retrieved chunks | `hybrid_retrieve()` → sanitize before reranking |

## Rationale

| Alternative                         | Pros                                  | Cons                                           | Why Not             |
| ----------------------------------- | ------------------------------------- | ---------------------------------------------- | ------------------- |
| Rely on agent system prompts        | Zero effort                           | Ineffective against sophisticated attacks      | Security gap        |
| LLM-based detection                 | Adaptive                              | Adds latency, cost, and another attack surface | Circular dependency |
| Block all external content          | Complete safety                       | Product is useless                             | —                   |
| Pattern-based sanitization (chosen) | Low latency, deterministic, auditable | May miss novel attacks                         | Best first layer    |

## Consequences

**Positive:**

- Direct mitigation of OWASP LLM01, LLM04, ASI01, ASI06
- Deterministic: same input always produces same result
- Low latency: pattern matching is O(n), no LLM call required
- Auditable: all flags are logged for security review

**Negative:**

- Pattern maintenance: new injection techniques require pattern updates
- False positives: legitimate content may be flagged (mitigate with allowlists)
- Not comprehensive: sophisticated attacks may evade pattern matching (mitigate
  with LLM-based detection as second layer)

**Risks:**

- Attackers may obfuscate patterns (mitigate with pattern normalization)
- Provenance tags may be stripped by intermediate processing

## Compliance & Safety Notes

- EU AI Act: "High-risk AI systems must be designed to achieve an appropriate
  level of accuracy, robustness, and cybersecurity" (Article 10).
- NIST AI RMF: MAP function requires "identification of potential impacts" —
  this ADR addresses the indirect prompt injection impact.
- OWASP LLM01: "Prompt injection occurs when an attacker provides input that
  alters the behavior of a language model."

## Verification

1. Unit tests: inject known patterns, verify sanitization
2. Integration tests: process test emails with embedded instructions, verify
   agent behavior unchanged
3. Adversarial testing: attempt indirect prompt injection via Gmail, verify
   block/flag

## Related ADRs

- ADR-027: OWASP Security Posture (LLM01, ASI06 mapping)
- ADR-017: Circuit Breaker (sanitization failure handling)
- ADR-030: Agent Credential Isolation (reduces blast radius)

## Reversibility

Easy — this is an additive middleware layer. Rollback:

1. Remove sanitization calls from agent code
2. No data migration needed
