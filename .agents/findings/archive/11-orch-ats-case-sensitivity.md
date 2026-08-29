# Finding: ATSAgent Case-Insensitive Check but Case-Sensitive Split

| Metadata     | Value                                       |
| ------------ | ------------------------------------------- |
| **ID**       | FIND-ORCH-002                               |
| **Severity** | P2-MEDIUM                                   |
| **Status**   | OPEN                                        |
| **Source**   | Orchestrator Loop Audit                     |
| **File**     | `apps/api/src/api/orchestrator/loop.py:139` |

## Description

The ATSAgent branch checks `" vs " in message.lower()` (case-insensitive) but
then splits with `message.split(" vs ")` (case-sensitive). Input like "Resume A
vs. Resume B" (with period) or "Resume A VS Resume B" (uppercase) won't split
correctly.

## Evidence

```python
parts = message.split(" vs ", 1) if " vs " in message.lower() else (message, "")
```

## Impact

- ATS scoring fails to compare two resumes when input format varies
- User gets confusing single-resume scoring instead of comparison

## Remediation

Use case-insensitive split:
`re.split(r'\s+vs\.?\s+', message, maxsplit=1, flags=re.IGNORECASE)`
