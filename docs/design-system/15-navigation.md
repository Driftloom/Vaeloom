# 15. Navigation: Sidebar, TopNav, Breadcrumbs, Pagination

## 1. Primary Navigation (Sidebar)

- Persistent collapsible left navigation rail.
- Expanded width: `256px` (`16rem`), Collapsed rail width: `64px` (`4rem`).
- Navigation groups:
  1. **Core / Knowledge**: Memory, Documents, Graph, Search.
  2. **Agency & Execution**: Agents, Tasks, Workflows, Approvals.
  3. **Career & Workspace**: Resumes, Jobs, Applications.
  4. **Settings & Admin**: Organization, Connectors, Security, Audit.
- Active state: High-contrast indicator line and subtle background tint
  (`var(--color-action-subtle)`).
- All icons sourced from `@vaeloom/ui-kit/icons`.

## 2. TopNav & Command Bar

- Height: `56px` (`3.5rem`).
- Global breadcrumb trail reflecting active workspace and view hierarchy.
- Global quick-action search / command palette trigger (`Cmd+K` / `Ctrl+K`).
- Notification bell, active agent status badge, and user profile switcher.

## 3. Breadcrumbs & Pagination

- `<Breadcrumbs>`: Hierarchical path navigation with truncation for deep nested
  trees.
- `<Pagination>`: Accessible pagination controls with page size selector, direct
  page jump, and total count display.
