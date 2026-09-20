# 22. Permissions & Approval Gates

## 1. Human-in-the-Loop Architecture

No autonomous agent in Vaeloom is permitted to perform external side-effects
(sending emails, modifying calendars, applying for jobs, updating remote
codebases) without human authorization unless explicitly granted pre-approved
policy scopes.

## 2. Approval Gate Components

- `<AgentApproval>`: Dedicated interactive card presenting:
  - Proposed Action: "Send follow-up email to recruiter at Acme Corp"
  - Target & Scope: `recruiter@acme.com` (External recipient)
  - Draft Payload Preview: Complete rendered message body
  - Impact Warning: "This action cannot be undone once dispatched"
  - Actions: `Approve & Send`, `Edit Draft`, `Reject Proposal`
- `<PermissionScopeSelector>`: Granular matrix of tool and resource permissions
  allowing workspace admins to define agent autonomy boundaries (`Never`,
  `Always Ask`, `Autonomous within Quota`).
