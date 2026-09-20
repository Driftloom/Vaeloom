# 17. AppShell & Page Templates

## 1. AppShell Architecture

The `<AppShell>` is the single top-level container for all authenticated Vaeloom
routes. It coordinates:

- Left Sidebar navigation (collapsible).
- TopNav with breadcrumbs, command palette, notifications, and profile.
- Main content area (`#main-content`) with skip link.
- Global modal and drawer mount points.
- Live agent status notification rail.

## 2. Standard Page Templates

Vaeloom defines 4 standard page layout archetypes:

1. **Dashboard / Overview**:
   - Header: Title, workspace switcher, primary action (e.g. "New Agent",
     "Ingest Memory").
   - Top Row: StatCards (4-column grid).
   - Middle: Dual-column main workbench (Activity timeline + Entity graph).
   - Bottom: Recent items table.
2. **List / Table View**:
   - Header: Title, total count badge, search filter bar, density switch, export
     action.
   - Body: Full-width responsive `DataTable`.
   - Footer: Pagination controls.
3. **Split Inspector / Workbench**:
   - Left: Scrollable master list or tree (35% width).
   - Right: Detail view or editor with sticky action bar (65% width).
4. **Focused Document / Editor**:
   - Centered constrained layout (`max-w-4xl`), distraction-free, sticky
     toolbar.
