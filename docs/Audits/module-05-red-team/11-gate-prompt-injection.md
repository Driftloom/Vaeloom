# Gate 11 — Prompt-Injection Red Team
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| 1 | P0 | `apps/api/src/api/agents/document_agent/handler.py:85` | Unsanitized document content (`d['excerpt']`) is blindly concatenated into the LLM prompt. |
| 2 | P1 | `apps/api/tests/test_prompt_injection_guard.py:81-104` | The prompt injection guard is only unit-tested against static payloads using a regex scanner (`PromptInjectionMiddleware._scan()`). There are no integration tests validating end-to-end injection blocking. |
| 3 | P1 | `apps/api/tests/test_prompt_injection_guard.py:81-104` | The quarantine logic requires the `PromptInjectionMiddleware` to be invoked manually on chunks; it is not automatically wired into the document generation pipeline at runtime. |

## Evidence
- `handler.py`:
```python
prompt += f"- Document ID: {d['id']}, Title: {d['title']}\n  Excerpt: {d['excerpt']}\n"
```
- `test_prompt_injection_guard.py`:
```python
for ch in chunks:
    flag = scanner._scan(ch.content)
    if flag:
        ch.metadata["quarantined"] = True
```
(Manual scanning in tests, not enforced by the actual pipeline natively).

## Conclusion
The prompt injection defenses are superficial. The `PromptInjectionMiddleware` is only a regex scanner on HTTP requests. During RAG synthesis, document excerpts are directly concatenated into the system prompt without secondary sanitization. An attacker who successfully ingests a malicious document (e.g., evading the regex or bypassing the middleware) can execute arbitrary prompt injections.
