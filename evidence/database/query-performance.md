# Database Query Performance & Index Coverage Report

**Date**: 2026-09-20  
**Scope**: Index Coverage, Query Execution Plans, N+1 Analysis

---

## 1. Index Coverage for Modules 01–03

| Table                       | Index Name                           | Indexed Columns       | Purpose                                            |
| :-------------------------- | :----------------------------------- | :-------------------- | :------------------------------------------------- |
| `users`                     | `users_email_key`                    | `email` (UNIQUE)      | Case-insensitive user lookup & login               |
| `auth_sessions`             | `idx_auth_sessions_family_id`        | `family_id`           | Refresh token theft family lookup & revocation     |
| `auth_sessions`             | `idx_auth_sessions_refresh_token`    | `refresh_token`       | Refresh token exchange lookup                      |
| `email_verification_tokens` | `idx_email_verification_token_hash`  | `token_hash` (UNIQUE) | Constant-time token verification lookup            |
| `email_verification_tokens` | `idx_email_verification_user_id`     | `user_id`             | User token lifecycle management                    |
| `onboarding_states`         | `onboarding_states_user_id_key`      | `user_id` (UNIQUE)    | Primary user onboarding state lookup               |
| `onboarding_states`         | `idx_onboarding_states_tenant_id`    | `tenant_id`           | Tenant onboarding analytics queries                |
| `onboarding_states`         | `idx_onboarding_states_workspace_id` | `workspace_id`        | Workspace onboarding binding                       |
| `workspace_users`           | `idx_workspace_users_user_id`        | `user_id`             | Membership queries in `list_for_user`              |
| `workspace_users`           | `idx_workspace_users_workspace_id`   | `workspace_id`        | Authorization checks in `_verify_workspace_access` |

---

## 2. N+1 Query Audit

- **Workspace Listing**: `WorkspaceService.list_for_user` utilizes a single SQL
  query joining `workspaces` and `workspace_users` with an `OR` condition,
  avoiding per-workspace N+1 membership queries.
- **Session Listing**: Single query on `auth_sessions` filtered by `user_id`
  with ordering by `created_at DESC`.
