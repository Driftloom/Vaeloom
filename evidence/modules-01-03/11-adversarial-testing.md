# Modules 01–03 Adversarial Security Testing Report

**Audit Date:** 2026-09-20  
**Role:** Adversarial Security Researcher & Red Team Engineer  
**Standard:** OWASP Top 10 API Security / Zero-Trust Attack Verification

---

## 1. Adversarial Attack Scenarios & Results

### Attack 1: Forged Supabase JWT Injection

- **Vector:** Attacker generates an arbitrary RS256 / HS256 / `alg: none` JWT
  claiming `iss: "supabase"` and sends it in the `Authorization` header.
- **Payload:**
  ```json
  {
    "sub": "attacker-uuid",
    "email": "attacker@evil.com",
    "iss": "supabase",
    "exp": 9999999999
  }
  ```
- **Observed Result:** HTTP 401 Unauthorized
  (`test_reject_unsigned_supabase_jwt`).
- **Verdict:** BLOCKED.

### Attack 2: High-Speed Password Brute-Force Burst

- **Vector:** Attacker sends 35 rapid login attempts with varied passwords from
  a single IP address.
- **Observed Result:** HTTP 429 Too Many Requests
  (`test_login_rate_limiting_and_ip_throttling`).
- **Verdict:** BLOCKED.

### Attack 3: SAML XML Signature Wrapping (XSW)

- **Vector:** Attacker injects an unsigned malicious `<saml:Assertion>` inside a
  valid SAML response envelope.
- **Observed Result:** Rejected by `signxml` XML signature validator
  (`test_saml_xml_signature_wrapping_rejection`).
- **Verdict:** BLOCKED.

### Attack 4: Unauthorized Workspace Hijacking via `/onboarding/join`

- **Vector:** Attacker signs up as User B and invokes
  `POST /api/v1/onboarding/join` with `workspace_id = <Workspace A UUID>`.
- **Observed Result:** HTTP 403 Forbidden:
  `"Forbidden: You have not been invited to join this workspace"`
  (`test_unauthorized_workspace_join_rejected`).
- **Verdict:** BLOCKED.

### Attack 5: Malicious Executable Disguised as Resume

- **Vector:** Attacker uploads a PE executable with `MZ` magic bytes named
  `resume.pdf`.
- **Observed Result:** HTTP 400 Bad Request:
  `"File content signature does not match PDF format"`
  (`test_resume_magic_byte_spoofing_rejected`).
- **Verdict:** BLOCKED.

### Attack 6: Post-Completion Onboarding Step Tampering

- **Vector:** Attacker completes onboarding and subsequently attempts to
  overwrite profile data via `POST /api/v1/onboarding/step`.
- **Observed Result:** HTTP 400 Bad Request:
  `"Onboarding has already been completed and cannot be modified"`
  (`test_onboarding_immutable_post_completion`).
- **Verdict:** BLOCKED.

### Attack 7: Privilege Escalation via Member Invitation

- **Vector:** Workspace user with `VIEWER` role calls
  `POST /api/v1/workspaces/{id}/invites`.
- **Observed Result:** HTTP 403 Forbidden:
  `"Forbidden: Only workspace owners and admins can invite members"`
  (`test_viewer_cannot_invite_workspace_member`).
- **Verdict:** BLOCKED.
