# GATE 34 — Production Configuration Audit

## Key Findings

1. **Insecure Storage SSL Defaults (`apps/api/src/api/services/storage_service.py`)**
   - The code contains logic to explicitly disable SSL if the `endpoint_url` starts with `http://`: 
     ```python
     elif endpoint.startswith("http://"):
         use_ssl = False
     ```
   - This makes it possible to completely downgrade production storage to cleartext HTTP just by manipulating the `storage_endpoint` environment variable, bypassing any other production enforcement.

2. **Cross-Origin Resource Sharing (CORS) (`apps/api/src/api/main.py`)**
   - CORS is highly permissive, allowing `allow_credentials=True` across `allowed_origins`.
   - The validation for localhost in production logs an error and refuses to start, which is a good guardrail, but the origin list fundamentally relies on external environment variables.

3. **Weak Secrets / Defaults (`apps/api/src/api/config.py`)**
   - The validation catches weak secrets like "changeme" or lengths < 32, but permits `JWT_SECRET` in local dev and fails closed otherwise.
   - However, `INFISICAL_ENABLED` is checked via `os.environ.get("INFISICAL_ENABLED")` directly, sidestepping Pydantic settings management.

## Verdict: P1 (High)
The auto-downgrade of `use_ssl=False` based purely on the `http://` prefix in `storage_endpoint` is a major risk for production exfiltration. There is no hard block forcing `use_ssl=True` in production if an admin misconfigures the URL.
