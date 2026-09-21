# Module 05: Privacy, Secret Scrubbing & PII Redaction
**Audit Identifier**: `AUD-M05-AI-29`
**Scope**: Secret detection (`api/temporal/validation.py`), recursive log redaction (`api/logging.py`), and 20KB payload limits.

---

## 1. Secret Scrubbing Architecture

Implemented in `api/logging.py` (`_redact`) and `api/temporal/validation.py`:
- Canonical `SECRET_KEYS` list: Contains 30+ sensitive keys (`password`, `access_token`, `refresh_token`, `api_key`, `client_secret`, `private_key`, `session_secret`, etc.).
- Recursive Redaction: Deeply traverses dictionaries and lists, replacing secret values with `"[REDACTED]"` before writing to log streams or external telemetry.
- Fail-Closed History Validation: Workflows reject any input payload containing unscrubbed secrets with `ValueError`.
- Payload Budgeting: Workflow inputs are capped at 20KB to prevent state store bloat.

---

## 2. Verification Evidence

- `test_module05_privacy.py`:
  - `test_secret_scrubbing_in_payloads`: Verifies nested key redaction.
  - `test_fail_closed_secret_rejection`: Confirms unscrubbed keys trigger `ValueError`.
  - `test_payload_size_enforcement`: Confirms oversized payloads exceeding 20KB are rejected.
