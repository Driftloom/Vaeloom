# Gate 19 — Connectors/MCP

## Verdict: FAIL

## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P1 | `apps/api/tests/test_module05_connectors.py:8` | Test does not evaluate MCP connectors at all. It only checks `FileSecurityService` for malware detection, completely missing MCP interaction, isolation, and malicious response testing. |
| 2 | INFO | `apps/api/src/api/services/mcp_client_service.py:14` | The code comments claim "multi-tenancy enforced at CALL time", but the tests completely fail to verify this behavior. |

## Evidence
- `test_module05_connectors.py` only contains `test_connector_isolation_and_sanitization` which passes a byte string `b"MZ\x90\x00\x03\x00"` to `FileSecurityService.inspect_file`. No MCP service is mocked, called, or validated.

## Conclusion
The claim that MCP connectors are verified is false. The test suite does not actually test MCP connector execution or workspace isolation, leaving potential security gaps in tool bridging.
