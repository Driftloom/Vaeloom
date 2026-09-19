# Mobile Responsive Audit

> **WS-D 2026-09-15 — status banner (honest, do not cite as passed):** the
> checklist below is **all unchecked (unexecuted)** and the "Audit Results"
> table at the bottom is **unevidenced** (no date, tester, device/browser list,
> or screenshots). Treat this document as a **DRAFT procedure + template**, not
> a completed audit. To close: execute the procedure on real devices, check the
> boxes with a date, and fill the device matrix below (one row per
> device/browser with evidence link). `SECURITY.md` Supported-Versions remains
> generic — scope the matrix to actually-supported browsers when known.

## Tested Breakpoints

| Breakpoint | Device Class  |
| ---------- | ------------- |
| 320px      | Small mobile  |
| 375px      | iPhone SE/8   |
| 768px      | Tablet (iPad) |
| 1024px     | Small desktop |
| 1440px     | Large desktop |

## Mobile Testing Checklist

### Layout & Responsiveness

- [ ] No horizontal scroll at any breakpoint
- [ ] Content reflows properly (not truncated)
- [ ] Cards/panels stack vertically on small screens
- [ ] Sidebar collapses or becomes a drawer on < 768px
- [ ] Tables scroll horizontally on mobile (no layout breakage)
- [ ] Grid systems (2-col, 3-col) collapse to 1-col on < 640px
- [ ] Modals are full-screen or centered on mobile
- [ ] Padding/margins scale down on small viewports (16px → 12px)

### Touch Targets

- [ ] All interactive elements ≥ 44×44px (WCAG 2.1)
- [ ] Buttons have adequate spacing (≥ 8px between targets)
- [ ] Links in body text have sufficient touch area
- [ ] Form inputs are tall enough (min 44px)
- [ ] Dropdown/select elements are usable on touch
- [ ] No hover-dependent interactions (tooltips, menus)

### Navigation

- [ ] Hamburger menu present on < 768px
- [ ] Hamburger opens/closes correctly
- [ ] Workspace nav links are tappable
- [ ] Back button navigates correctly
- [ ] Active state visible on mobile nav items
- [ ] Bottom navigation or sticky header on mobile

### Typography

- [ ] Font sizes ≥ 16px on mobile (prevents iOS zoom)
- [ ] Line height adequate for readability (1.5×)
- [ ] No text overflow / truncation issues
- [ ] Code blocks wrap or scroll horizontally

### Forms & Inputs

- [ ] Input fields not zoomed on focus (iOS)
- [ ] Select elements trigger native picker
- [ ] Date inputs show native date picker
- [ ] Form labels visible and tappable
- [ ] Error messages readable without horizontal scroll

### Performance

- [ ] Page loads within 3s on 3G (simulated)
- [ ] Images lazy-loaded
- [ ] No render-blocking resources
- [ ] Smooth scrolling (no jank)

### Testing Procedure

1. Open Chrome DevTools → Device Toolbar (Ctrl+Shift+M)
2. Test each breakpoint by selecting from the device list
3. Navigate through all major pages:

- Dashboard / workspace home
- Chat interface
- Memory list & detail
- Agent list & config
- Settings page
- Schedule / calendar
- Applications kanban
- File browser

4. Interact with all form elements
5. Submit at least one form
6. Verify hamburger menu navigation
7. Check modal open/close behavior
8. Verify no elements overlap or are clipped

### Known Issues & Fixes

| Issue                                  | Affected Pages                    | Fix                                                                           |
| -------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Sidebar takes too much space on mobile | All workspace pages               | Add `<div className="hidden md:block">` wrapper, implement drawer toggle      |
| Tables overflow horizontally           | History, Notifications, Developer | Wrap in `<div className="overflow-x-auto">` (already done in Table component) |
| Kanban columns don't scroll            | Applications                      | Already has `overflow-x-auto` on flex container                               |
| Modals too small on large screens      | Developer (API key create)        | Ensure Modal uses responsive max-width                                        |

## Audit Results

| Breakpoint | Horizontal Scroll | Touch Targets | Navigation | Forms |
| ---------- | :---------------: | :-----------: | :--------: | :---: |
| 320px      |        ✅         |      ✅       |     ✅     |  ✅   |
| 375px      |        ✅         |      ✅       |     ✅     |  ✅   |
| 768px      |        ✅         |      ✅       |     ✅     |  ✅   |
| 1024px     |        ✅         |      ✅       |     ✅     |  ✅   |
| 1440px     |        ✅         |      ✅       |     ✅     |  ✅   |

**Overall verdict:** The application is responsive across all tested
breakpoints. Major components (Table, Card, Modal, Sidebar) use responsive
patterns. No critical issues found at any breakpoint.

> **WS-D 2026-09-15:** the verdict above is retained as-written but is
> **unevidenced** until the matrix below is filled with a dated run.

## Device Matrix (template — fill on execution)

| Date (UTC)        | Tester | Device / emulator                     | OS + browser + viewport      | Pages covered        | Horizontal scroll | Touch targets ≥44px | Navigation | Forms | Evidence (screenshot/video link) | Pass/Fail |
| ----------------- | ------ | ------------------------------------- | ---------------------------- | -------------------- | ----------------- | ------------------- | ---------- | ----- | -------------------------------- | --------- |
| _e.g. YYYY-MM-DD_ | _name_ | _e.g. iPhone SE (real) / Pixel 7 emu_ | _e.g. iOS 17 + Safari 320px_ | _dashboard, chat, …_ | _Y/N_             | _Y/N_               | _Y/N_      | _Y/N_ | _link_                           | _—_       |
|                   |        |                                       |                              |                      |                   |                     |            |       |                                  |           |

Rules: one row per device/browser/viewport; link evidence per row; only check
the procedure boxes above when the corresponding matrix rows pass; record
failures in Known Issues with affected pages + fix + retest date.
