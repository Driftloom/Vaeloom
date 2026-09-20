# Modules 01–03 Frontend & E2E Verification

**Audit Date:** 2026-09-20  
**Scope:** Next.js 15 Frontend Pages, Components, and Playwright E2E
Verification

---

## 1. Frontend Page & Component Audit

### 1.1 Authentication Pages (`apps/web/src/app/(auth)/`)

- `/login`: Form validation, error alert banner on invalid credentials,
  automatic redirect to `/workspace/{id}` upon success.
- `/signup`: Real-time password strength validation, affirmative checkbox for
  terms of service, automatic onboarding redirection.
- `/onboarding`: Renders `OnboardingWizard` with 4 steps:
  - Step 1: `Profile` (`displayName`, `jobTitle`).
  - Step 2: `Workspace` (`workspaceName`).
  - Step 3: `Resume & Skills` (File drag-and-drop, skill tags, AI extraction
    indicator).
  - Step 4: `Integrations` (Connector toggles for Google Drive, Gmail, GitHub).

### 1.2 E2E Playwright Tests (`apps/web/e2e/`)

- `auth.spec.ts`:
  - `login rejects bad credentials with an inline error`: PASS
  - `login succeeds and lands in workspace`: PASS
  - `signup validates weak password inline`: PASS
  - `unauthenticated workspace access redirects to login`: PASS
- `onboarding.spec.ts`:
  - `onboarding wizard page loads and renders step indicators`: PASS
  - `onboarding wizard allows advancing through steps`: PASS (Overhauled to
    remove `.catch(() => false)` and strictly verify progression from Profile to
    Workspace).
