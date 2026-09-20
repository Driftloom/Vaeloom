# Verification Report 02: Architecture & Dataflow Audit

**Target Scope:** Modules 01–03 (Authentication, Tenant Isolation &
Multi-Tenancy, Onboarding)  
**Audit Timestamp:** 2026-09-20  
**Source of Truth Commit:** `89b246e7`  
**Auditor:** Zero-Trust System Architect

---

## 1. Zero-Trust Architectural Topology

Vaeloom enforces a layered, defense-in-depth architecture across Modules 01–03.
In a genuine zero-trust architecture:

1. **No component trusts another component implicitly.**
2. **Every boundary transition must validate identity, tenant scope, and
   permissions.**
3. **No client-supplied headers are trusted as authoritative.**

```mermaid
flowchart TD
    subgraph ClientLayer [Client & Edge Layer]
        C1[Next.js 15 Web Client]
        C2[API Clients / Mobile]
        C3[External IdPs: Okta / Google / Azure]
    end

    subgraph MiddlewarePipeline [FastAPI ASGI Middleware Pipeline]
        M1[CORSMiddleware: Origin Validation]
        M2[AuthMiddleware: JWT Signature & Session Verification]
        M3[TenantMiddleware: ContextVar & Authoritative Scope]
        M4[CSRF & Rate Limiting Guard]
    end

    subgraph RouterAndService [Routers & Application Services]
        R1[Auth Router: /auth/*]
        R2[Workspaces Router: /workspaces/*]
        R3[Onboarding Router: /onboarding/*]
        S1[AuthService: Argon2/Bcrypt & Session Store]
        S2[WorkspaceService: Membership & Ownership]
        S3[OnboardingService: State Machine]
    end

    subgraph DataAndRLS [Database & Storage Layer]
        DB[(PostgreSQL Database)]
        RLS[Row Level Security Engine]
        GUC1[GUC: app.tenant_id]
        GUC2[GUC: app.workspace_id]
        GUC3[GUC: app.user_id]
    end

    C1 & C2 -->|Bearer JWT / Headers| M1
    C3 -->|SAML / OAuth Assertion| M1
    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> R1 & R2 & R3
    R1 --> S1
    R2 --> S2
    R3 --> S3
    S1 & S2 & S3 -->|AsyncSession + set_rls_session_vars| DB
    DB --- RLS
    RLS --- GUC1 & GUC2 & GUC3
```

---

## 2. End-to-End Dataflows

### 2.1 Authentication & Session Lifecycle Dataflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Web Client
    participant AuthMW as AuthMiddleware
    participant AuthR as Auth Router
    participant AuthS as AuthService
    participant DB as Database (Users/Sessions)

    User->>Web: Enter credentials (email, password)
    Web->>AuthR: POST /api/v1/auth/login {email, password}
    AuthR->>AuthS: authenticate(email, password)
    AuthS->>DB: Query User by email (Case-Insensitive)
    DB-->>AuthS: User Record (password_hash, failed_attempts, locked_until)

    alt Account is Locked (failed_attempts >= 10 and locked_until > now)
        AuthS-->>AuthR: HTTPException(423 Locked)
        AuthR-->>Web: 423 Locked (Retry after 15 min)
    else Invalid Password
        AuthS->>DB: Increment failed_attempts (if 10, set locked_until)
        AuthS-->>AuthR: HTTPException(401 Unauthorized)
        AuthR-->>Web: 401 Unauthorized
    else Valid Password
        AuthS->>DB: Reset failed_attempts = 0, locked_until = NULL
        AuthS->>DB: Insert AuthSession (family_id, refresh_token, status='ACTIVE')
        AuthS-->>AuthR: {access_token, refresh_token, user}
        AuthR-->>Web: 200 OK + JWT Tokens
    end

    Note over Web, AuthMW: Subsequent Request to Protected Route
    Web->>AuthMW: GET /workspaces (Authorization: Bearer <access_token>)
    AuthMW->>AuthMW: Verify JWT signature using settings.jwt_secret
    AuthMW->>DB: Verify session revocation status (SharedRevocation / AuthSession)
    AuthMW-->>AuthMW: Set request.state.user_id & request.state.tenant_id
```

### 2.2 Multi-Tenant Request Isolation & RLS Dataflow

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant TenantMW as TenantMiddleware
    participant ContextVar as TenantContext
    participant Router as Workspaces Router
    participant DB as AsyncSession / PostgreSQL
    participant RLS as PostgreSQL RLS Policies

    Client->>TenantMW: GET /workspaces/{id} (Headers: X-Workspace-ID, X-Tenant-ID)
    Note over TenantMW: Zero-Trust: Untrusted headers are ignored.<br/>Only verified JWT claims & DB lookup determine tenant.
    TenantMW->>DB: check_user_workspace_access(workspace_id, user_id, tenant_id)
    alt Access Denied
        TenantMW-->>Client: 404 Not Found (Anti-Enumeration)
    else Access Authorized
        TenantMW->>ContextVar: set(tenant_id, workspace_id, user_id)
        TenantMW->>Router: Forward request
        Router->>DB: execute(select(Workspace).where(id == workspace_id))
        DB->>DB: set_rls_session_vars: SELECT set_config('app.tenant_id', ...)<br/>SELECT set_config('app.workspace_id', ...)<br/>SELECT set_config('app.user_id', ...)
        DB->>RLS: Evaluate RLS policies against GUCs
        RLS-->>DB: Filtered rows (Only matching workspace/tenant)
        DB-->>Router: Workspace record
        Router-->>Client: 200 OK + Workspace Data
        TenantMW->>ContextVar: clear()
    end
```

### 2.3 Onboarding State Machine Dataflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Web Client
    participant Router as Onboarding Router
    participant Service as OnboardingService
    participant DB as Database (onboarding_states)

    Note over User, Web: User logs in after initial registration
    Web->>Router: GET /api/v1/onboarding
    Router->>Service: get_or_create_state(user_id, tenant_id)
    Service->>DB: Query or insert default state (current_step: 'PROFILE')
    DB-->>Service: OnboardingState record
    Service-->>Web: 200 OK {currentStep: 'PROFILE', isCompleted: false, stepData: {}}

    User->>Web: Fill profile info (displayName, jobTitle)
    Web->>Router: POST /api/v1/onboarding/step {step: 'WORKSPACE', step_data: {...}}
    Router->>Service: update_step(user_id, step, step_data)
    Service->>DB: Update state (current_step: 'WORKSPACE', completed_steps: ['PROFILE'])
    DB-->>Service: Updated record
    Service-->>Web: 200 OK

    Note over Web, Service: Progression through RESUME and CONNECTORS
    User->>Web: Complete final step
    Web->>Router: POST /api/v1/onboarding/complete {final_data: {...}}
    Router->>Service: complete(user_id, final_data)
    Service->>DB: Mark is_completed = true, current_step = 'COMPLETED'
    DB-->>Service: Final record
    Service-->>Web: 200 OK {isCompleted: true}
    Web->>Web: Redirect user to /dashboard
```

---

## 3. Trust Boundary Audit & Architectural Vulnerabilities

| Boundary                          | Intended Contract                             | Reality / Actual State                                                                                                 | Zero-Trust Verdict                          |
| :-------------------------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ |
| **Client -> AuthMiddleware**      | Verify signature of all JWTs                  | **Bypassed** in `auth.py:108-114` for tokens with `"iss": "supabase"`. Unsigned tokens accepted.                       | **FAIL (CRITICAL)**                         |
| **Client -> TenantMiddleware**    | Never trust client headers (`X-Tenant-ID`)    | Authoritative identity verified against user session; client headers ignored.                                          | **PASS**                                    |
| **Router -> DB (RLS)**            | All queries scoped by PostgreSQL RLS GUCs     | `set_rls_session_vars` sets `app.tenant_id` and `app.workspace_id` via `SET LOCAL`. Safe with PgBouncer.               | **PASS** (PostgreSQL only; no-op on SQLite) |
| **Router -> OnboardingService**   | Strict sequential state progression           | Accepts any step in `VALID_ONBOARDING_STEPS` without verifying prerequisites. Accepts unvalidated JSON in `step_data`. | **CONDITIONAL**                             |
| **Agent / Orchestrator Boundary** | Agents cannot access cross-workspace memories | `UserRequest` passes `workspace_id` and `tenant_id`; agent tools inherit caller context.                               | **PASS**                                    |
