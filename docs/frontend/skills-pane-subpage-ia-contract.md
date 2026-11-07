# Skills: Detail Pane ↔ Full Skill Page IA Contract

Governs the relationship between the skills workbench, its embedded detail pane,
and the full-page skill route. Authored ahead of the B5/B6/B8 refactors that
touch these surfaces (`skills-feature-master-plan.md` B10) and pinned by tests
per DG-9 (`skills-feature-review-design.md`) so a refactor cannot silently
change it.

## Surfaces

| Surface | Route | Implementation |
| --- | --- | --- |
| Workbench (master list + embedded pane) | `/workspace/{ws}/capabilities?category=skills` | `apps/web/src/components/capabilities/SkillsView.tsx` hosting `SkillDetailPane` |
| Full skill page | `/workspace/{ws}/capabilities/skills/{skillId}` | `apps/web/src/app/workspace/[workspaceId]/capabilities/skills/[skillId]/page.tsx` hosting the same `SkillDetailPane` |

Both surfaces render the **same** `SkillDetailPane` component: one action
surface (instructions, enable/disable, install, delete, test playground, copy,
download), two hosts. Parity work (B6) keeps the action set identical.

## The rules

1. **The pane is the inspector; the full page is the deep-linkable surface.**
2. **"Open Full Page" is the single bridge from pane to subpage.**
   `SkillDetailPane` renders it whenever a `workspaceId` and a selected
   slug/key exist; the href is
   `/workspace/{ws}/capabilities/skills/{encodeURIComponent(slug || key)}`.
   Without a workspace target the link is not rendered (no dead bridge).
3. **Back-navigation carries the selection.** The subpage's breadcrumb "Skills"
   and its "Back to Skills" button both target
   `/workspace/{ws}/capabilities?category=skills&skill={decodedSkillId}`; delete
   on the subpage returns to `...?category=skills`. The workbench consumes
   `?skill=` (`capabilities/page.tsx` seeds the selected row from it), so the
   round trip keeps the skill selected.
4. **Mobile (<1024px) never navigates between list and pane.** Selecting a row
   swaps the two columns in place (`mobileDetailOpen`); Escape or the pane's
   close control returns to the list and restores focus to the card. At
   ≥1024px the columns sit side by side. On the *subpage*, the same close
   control navigates back to the workbench back-URL instead — the callback is
   host-provided per surface.
5. **Deep links resolve leniently.** `skillId` matches a merged seed+server row
   by key, id, slug, or name (case-insensitive last resort). An unresolvable id
   renders the not-found state with a "View all Skills" exit.

Known adjacency (not a bug to fix silently): on the subpage itself the pane host
passes a `workspaceId`, so "Open Full Page" renders and resolves to the current
URL. Harmless self-link; if a future pass hides it on the subpage, update this
doc and the pins together.

## Pins (DG-9, referenced by E3)

| Behavior | Test |
| --- | --- |
| Pane → subpage bridge href + workspace required | `apps/web/src/components/capabilities/__tests__/SkillsView.test.tsx` — "pins the IA contract: the detail pane links to the full skill page" |
| Mobile in-place swap + Escape return + no navigation | same file — "pins the IA contract: on narrow viewports, selecting a skill swaps the pane in place" |

These are the E3 containment regressions for the pane/subpage surfaces; B5/B6/B8
must keep them green.
