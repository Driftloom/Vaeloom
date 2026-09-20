# Verification Report 04: API & Contract Audit

**Target Scope:** Modules 01–03 (Authentication, Tenant Isolation &
Multi-Tenancy, Onboarding)  
**Audit Timestamp:** 2026-09-20  
**Source of Truth Commit:** `89b246e7`  
**Auditor:** Staff API Security Engineer & Contract Auditor

---

## 1. API Surface & Endpoint Inventory

The API endpoints governing Modules 01–03 were evaluated against Pydantic
schemas, OpenAPI 3.1 specifications (`specs/api/openapi.yaml`), authentication
dependencies, authorization guards, and error responses.

### 1.1 Module 01: Authentication Endpoints (`apps/api/src/api/routers/auth.py`)

| Method   | Endpoint                           | Request Schema              | Response Schema                  | Auth Required | Zero-Trust & Anti-Enumeration Assessment                                                                                                                             |
| :------- | :--------------------------------- | :-------------------------- | :------------------------------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/auth/signup`              | `SignupRequest`             | `AuthResponse` (201)             | Public        | Validates email format and password >= 8 characters. Creates default workspace, email token, and onboarding state.                                                   |
| `POST`   | `/api/v1/auth/login`               | `LoginRequest`              | `AuthResponse` (200)             | Public        | Case-insensitive email lookup. Verifies password. Enforces 10-attempt lockout -> HTTP 423. Anti-enumeration: returns generic 401 for wrong password or missing user. |
| `POST`   | `/api/v1/auth/refresh`             | `RefreshTokenRequest`       | `TokenRefreshResponse` (200)     | Public        | Rotates refresh token. Detects replay attacks on rotated tokens; revokes entire session family on reuse attempt.                                                     |
| `POST`   | `/api/v1/auth/logout`              | `None` / `Bearer`           | `StatusResponse` (200)           | Required      | Marks current session `REVOKED` in `auth_sessions` and records JTI in shared revocation store.                                                                       |
| `GET`    | `/api/v1/auth/me`                  | `None`                      | `AuthMeResponse` (200)           | Required      | Resolves caller identity, user profile, tenant ID, and associated workspaces.                                                                                        |
| `GET`    | `/api/v1/auth/sessions`            | `None`                      | `UserSessionsListResponse` (200) | Required      | Returns active sessions for caller. Flags `is_current: true` for the active token session.                                                                           |
| `DELETE` | `/api/v1/auth/sessions/{id}`       | `Path(id: UUID)`            | `None` (204)                     | Required      | Granular session revocation. Verifies session belongs to caller before marking `REVOKED`.                                                                            |
| `POST`   | `/api/v1/auth/verify-email`        | `VerifyEmailRequest`        | `StatusResponse` (200)           | Public        | SHA-256 hashes incoming token, checks expiration, marks `user.email_verified = true`, and purges consumed token.                                                     |
| `POST`   | `/api/v1/auth/resend-verification` | `ResendVerificationRequest` | `StatusResponse` (200)           | Public        | Anti-enumeration: returns HTTP 200 `{status: "success"}` even if the email does not exist in the database.                                                           |
| `POST`   | `/api/v1/auth/forgot-password`     | `ForgotPasswordRequest`     | `StatusResponse` (200)           | Public        | Anti-enumeration: returns HTTP 200 `{status: "success"}` regardless of whether email exists.                                                                         |
| `POST`   | `/api/v1/auth/reset-password`      | `ResetPasswordRequest`      | `StatusResponse` (200)           | Public        | Validates reset token hash and updates `password_hash`. Purges token upon success.                                                                                   |
| `GET`    | `/api/v1/auth/saml/metadata`       | `None`                      | XML String (200)                 | Public        | Generates SP EntityDescriptor metadata with valid ACS URL.                                                                                                           |
| `GET`    | `/api/v1/auth/saml/login`          | `Query(redirect_url)`       | Redirect 302 / 503               | Public        | Fail-closed: returns 503 if `SAML_IDP_SSO_URL` is unconfigured. Redirects to IdP with signed SAMLRequest.                                                            |
| `POST`   | `/api/v1/auth/saml/callback`       | Form `SAMLResponse`         | `AuthResponse` (200)             | Public        | Validates SAML XML response and signature via `signxml`. Auto-provisions user.                                                                                       |

---

### 1.2 Module 02: Workspaces & Multi-Tenancy Endpoints (`apps/api/src/api/routers/workspaces.py`)

| Method   | Endpoint                           | Request Schema           | Response Schema                 | Auth Required | Zero-Trust & Authorization Guards                                                     |
| :------- | :--------------------------------- | :----------------------- | :------------------------------ | :------------ | :------------------------------------------------------------------------------------ |
| `POST`   | `/api/v1/workspaces`               | `CreateWorkspaceRequest` | `WorkspaceResponse` (201)       | Required      | Creates workspace owned by caller and associates with caller's `tenant_id`.           |
| `GET`    | `/api/v1/workspaces`               | `None`                   | `list[WorkspaceResponse]` (200) | Required      | Lists workspaces where user is owner OR member via `WorkspaceUser`. Filtered by RLS.  |
| `GET`    | `/api/v1/workspaces/{id}`          | `Path(id: UUID)`         | `WorkspaceResponse` (200)       | Required      | IDOR Protected: returns 404 (anti-enumeration) if user has no access.                 |
| `PATCH`  | `/api/v1/workspaces/{id}`          | `UpdateWorkspaceRequest` | `WorkspaceResponse` (200)       | Required      | Enforces Owner role check. Rejects unauthorized mutation with 404.                    |
| `DELETE` | `/api/v1/workspaces/{id}`          | `Path(id: UUID)`         | `None` (204)                    | Required      | Enforces Owner role check. Deletes workspace. Cascade sets null on onboarding states. |
| `GET`    | `/api/v1/workspaces/{id}/agents`   | `Path(id: UUID)`         | `list[AgentResponse]` (200)     | Required      | Verifies workspace access before listing agents scoped to workspace.                  |
| `GET`    | `/api/v1/workspaces/{id}/memories` | `Path(id: UUID)`         | `list[MemoryResponse]` (200)    | Required      | Verifies workspace access before querying memories scoped to workspace.               |

---

### 1.3 Module 03: Onboarding Endpoints (`apps/api/src/api/routers/onboarding.py`)

| Method | Endpoint                      | Request Schema                | Response Schema                 | Auth Required | State Machine & Contract Assessment                                                                                                         |
| :----- | :---------------------------- | :---------------------------- | :------------------------------ | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/onboarding`          | `None`                        | `OnboardingStateResponse` (200) | Required      | Resolves caller's `user_id` and `tenant_id`. Creates initial state (`PROFILE`) if none exists.                                              |
| `POST` | `/api/v1/onboarding/step`     | `UpdateOnboardingStepRequest` | `OnboardingStateResponse` (200) | Required      | Validates step against `VALID_ONBOARDING_STEPS`. Merges `step_data`. Gaps: does not validate prerequisite completion or `step_data` schema. |
| `POST` | `/api/v1/onboarding/complete` | `CompleteOnboardingRequest`   | `OnboardingStateResponse` (200) | Required      | Marks `is_completed = true` and `current_step = 'COMPLETED'`. Merges `final_data`.                                                          |

---

## 2. Request/Response Contract & Error Format Analysis

1. **Unified Error Structure:**
   - Production FastAPI uses `unified_exception_handler` and
     `generic_exception_handler` in
     `apps/api/src/api/middleware/exception_handler.py`.
   - Returns standard JSON:
     ```json
     {
       "detail": "Descriptive error message",
       "error_code": "ERROR_IDENTIFIER",
       "request_id": "c1a2b3c4-..."
     }
     ```
2. **Anti-Enumeration Contract:**
   - For `/auth/login`, invalid email and invalid password return identical 401
     responses: `{"detail": "Invalid email or password"}`.
   - For `/workspaces/{id}`, accessing another user's workspace returns
     `404 Not Found` rather than `403 Forbidden` to prevent resource existence
     enumeration.
   - For `/auth/forgot-password` and `/auth/resend-verification`, the API
     returns HTTP 200 `{status: "success"}` regardless of whether the target
     account exists.

3. **Contract Gaps Identified:**
   - `UpdateOnboardingStepRequest.step_data` is defined as
     `dict[str, Any] = {}`. It lacks a strict Pydantic model for each step (e.g.
     `ProfileStepData`, `WorkspaceStepData`, `ResumeStepData`,
     `ConnectorsStepData`).
   - The onboarding endpoints do not reject modification requests once
     `is_completed` is `true`.
