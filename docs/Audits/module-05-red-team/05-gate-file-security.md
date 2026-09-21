# Gate 05 — Real File Security

## Verdict: PARTIAL

## Findings
| ID | Severity | File:Line | Description |
|----|----------|-----------|-------------|
| G05-1 | P1 | `apps/api/src/api/services/file_security_service.py:8-39` | File security does not use a real AV engine (e.g., ClamAV). It relies entirely on hardcoded byte signatures and pattern matching. |
| G05-2 | P1 | `apps/api/tests/test_module05_file_security.py:41` | EICAR detection is only tested via a direct unit test on `FileSecurityService.inspect_file`, rather than an integration test via the HTTP upload endpoint. |

## Evidence
`apps/api/tests/test_module05_file_security.py` line 41:
`verdict = FileSecurityService.inspect_file("test_virus.txt", EICAR_SIGNATURE)`

`apps/api/src/api/services/file_security_service.py` line 102-103:
```python
        if EICAR_SIGNATURE in content:
            logger.warning(f"Malware signature detected in uploaded file: {filename}")
```

## Conclusion
While file security checks (magic bytes, EICAR signatures) are implemented, they are naive pattern-matches rather than robust AV scanning, and they are not tested end-to-end through the API.
