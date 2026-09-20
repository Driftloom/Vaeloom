# Master Requirement -> Control -> Test -> Metric -> Evidence Matrix

**Target Modules**: Module 01 (Auth), Module 02 (Multi-Tenancy), Module 03
(Onboarding)  
**Standard**: 100% Zero-Trust Verified

---

| Req ID        | Requirement            | Control                                | Implementation               | Test Proof                                | Observed Metric        | Status   | Gate |
| :------------ | :--------------------- | :------------------------------------- | :--------------------------- | :---------------------------------------- | :--------------------- | :------- | :--- |
| **REQ-01.1**  | Password Policy        | 8+ chars, upper, lower, digit, special | `auth_service.signup`        | `test_enterprise_modules_01_03.py:19`     | 100% enforcement       | **PASS** | P0   |
| **REQ-01.2**  | Account Lockout        | 10 failures -> 15m lock                | `auth_service.login`         | `test_enterprise_modules_01_03.py:81`     | 423 Locked on 10th     | **PASS** | P0   |
| **REQ-01.3**  | Lockout Anti-Bypass    | Email case normalization               | `auth_service.py`            | `test_adversarial_zero_trust_01_03.py:18` | Case-insensitive lock  | **PASS** | P0   |
| **REQ-01.4**  | Email Verification     | Single-use SHA-256 token               | `auth_service.verify_email`  | `test_enterprise_modules_01_03.py:148`    | Replay rejected (400)  | **PASS** | P1   |
| **REQ-01.5**  | Token Theft Guard      | Family replay revocation               | `auth_service.refresh_token` | `test_enterprise_modules_01_03.py:200`    | Entire family revoked  | **PASS** | P0   |
| **REQ-01.6**  | Session Management     | Granular list & revoke                 | `auth.py` router             | `test_enterprise_modules_01_03.py:260`    | Revoked token rejected | **PASS** | P1   |
| **REQ-01.7**  | Anti-Enumeration       | Generic response messages              | `auth.py` router             | `test_zero_trust_deep_audit_01_03.py:160` | 0 user discovery       | **PASS** | P1   |
| **REQ-02.1**  | Workspace Membership   | Owner + member access                  | `workspace_service.py`       | `test_enterprise_modules_01_03.py:315`    | IDOR blocked (404)     | **PASS** | P0   |
| **REQ-02.2**  | Fail-Closed Tenant     | Missing tenant raises 400              | `organizations.py`           | `test_enterprise_modules_01_03.py:464`    | 400 Bad Request        | **PASS** | P0   |
| **REQ-02.3**  | RLS Enforcement        | 44/44 tables forced                    | Migration `0045`             | `test_rls_live_pg.py` (5/5)               | 0 cross-tenant rows    | **PASS** | P0   |
| **REQ-03.1**  | Onboarding Machine     | Sequential step transitions            | `onboarding_service.py`      | `test_enterprise_modules_01_03.py:408`    | Invalid step rejected  | **PASS** | P1   |
| **REQ-03.2**  | Onboarding IDOR        | User bound to JWT `sub`                | `onboarding.py` router       | `test_adversarial_zero_trust_01_03.py:57` | 0 cross-user leak      | **PASS** | P0   |
| **REQ-03.3**  | Onboarding Concurrency | Atomic step updates                    | `onboarding_service.py`      | `test_zero_trust_deep_audit_01_03.py:23`  | Clean merged state     | **PASS** | P1   |
| **REQ-AGT.1** | Agent Boundary         | Membership checked                     | `agents.py` router           | `agents.py:_verify_workspace_access`      | Non-member 404         | **PASS** | P0   |
