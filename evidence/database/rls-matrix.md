# PostgreSQL Row Level Security (RLS) Policy Matrix

**Coverage**: 44 / 44 Tables Enabled & Forced  
**Policies Applied**: Migration chain `0010`, `0012`, `0013`, `0014`, `0019`,
`0020`, `0045`

---

## 1. Multi-Tenant & Workspace Policy Inventory

| Table Name                  | Policy Name                | Permitted Commands | Policy Definition (USING / WITH CHECK)                                                                                                                                                                                   |
| :-------------------------- | :------------------------- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email_verification_tokens` | `p_email_tokens_user`      | ALL                | `USING (user_id::text = current_setting('app.user_id', true))`                                                                                                                                                           |
| `onboarding_states`         | `p_onboarding_tenant_user` | ALL                | `USING (user_id::text = current_setting('app.user_id', true) OR (tenant_id IS NOT NULL AND tenant_id::text = current_setting('app.tenant_id', true))) WITH CHECK (user_id::text = current_setting('app.user_id', true))` |
| `memories`                  | `p_memories_workspace`     | ALL                | `USING (workspace_id = current_setting('app.workspace_id', true)::uuid) WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)`                                                                     |
| `documents`                 | `p_documents_workspace`    | ALL                | `USING (workspace_id = current_setting('app.workspace_id', true)::uuid) WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)`                                                                     |
| `users`                     | `tenant_isolation_users`   | ALL                | `USING (tenant_id::text = current_setting('app.tenant_id', true) OR id::text = current_setting('app.user_id', true))`                                                                                                    |
| `workspaces`                | `p_workspaces_tenant`      | ALL                | `USING (user_id::text = current_setting('app.user_id', true) OR id IN (SELECT workspace_id FROM workspace_users WHERE user_id::text = current_setting('app.user_id', true)))`                                            |
| `auth_sessions`             | `p_auth_sessions_user`     | ALL                | `USING (user_id::text = current_setting('app.user_id', true))`                                                                                                                                                           |

---

## 2. Enforcement Verification

- All 44 tables have `FORCE ROW LEVEL SECURITY` applied, ensuring that even the
  application role (`vaeloom_app`) cannot bypass RLS.
- Only superusers bypass RLS; application connections never run as superuser.
