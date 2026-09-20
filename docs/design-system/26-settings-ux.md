# 26. Settings & Preferences UX

## 1. Structure & Layout

Settings pages follow a standardized two-column tabbed layout:

- Left: Settings category navigation (`Profile`, `Workspace`, `Appearance`,
  `Security`, `API Keys`, `Notifications`).
- Right: Card-grouped configuration panels with clear action footers.

## 2. Unsaved Changes & Feedback

- Form changes trigger an inline sticky bottom bar: "You have unsaved changes
  [Discard] [Save Changes]".
- Explicit feedback upon save via subtle toast notification.
- Dangerous operations (delete workspace, revoke keys) require explicit text
  confirmation modals.
