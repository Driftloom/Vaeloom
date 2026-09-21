# Module 05: Connectors & External Trust Boundaries
**Audit Identifier**: `AUD-M05-AI-25`
**Scope**: Ingestion from Google Drive, OneDrive, Slack, GitHub; credential encryption; untrusted input sanitization.

---

## 1. Connector Trust Perimeter

When documents enter Vaeloom via third-party connectors:
1. **OAuth Credential Isolation**: OAuth tokens stored in `Connector.config` are encrypted using AES-256-GCM.
2. **Untrusted Payload Sanitization**: External document downloads undergo identical `FileSecurityService` magic-byte and malware inspection as direct user uploads. Disguised binaries or malicious scripts are rejected fail-closed.
3. **Audit Trails**: Ingestions record the connector ID and source external account ID in `audit_events`.

---

## 2. Verification Evidence

- `test_module05_connectors.py`:
  - `test_connector_isolation_and_sanitization`: Confirms files imported from Google Drive or external integrations undergo mandatory inspection and reject disguised executables.
