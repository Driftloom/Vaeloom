# Vaeloom Page Patterns & UX Architecture

**Document:** Canonical Page Patterns & Layout Guidelines  
**Standard:** Enterprise Zero-Trust Frontend Architecture  
**Scope:** Design and Interaction Patterns across all 57 Application Routes

---

## 1. Overview & Pattern Catalog

Vaeloom establishes seven standardized, repeatable layout patterns. Every route
in the application maps to one of these patterns, guaranteeing that users
encounter predictable navigation, consistent visual rhythm, and uniform
interaction behaviors throughout the platform.

```
┌────────────────────────────────────────────────────────┐
│ 1. Dashboard & KPI Pattern                             │
│ 2. List & Enterprise Data Table Pattern                │
│ 3. Master-Detail Split Pane Pattern                    │
│ 4. Single-Column Form & Settings Pattern               │
│ 5. AI Reasoning & Conversational Pattern               │
│ 6. Human-in-the-Loop (HITL) Approval Pattern           │
│ 7. Destructive & Critical Confirmation Pattern         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Pattern 1: Dashboard & KPI Pattern

### 2.1 Applied Routes

`/workspace/[workspaceId]`, `/workspace/[workspaceId]/admin`,
`/workspace/[workspaceId]/cognition`, `/status`

### 2.2 Layout Structure & Anatomy

```
┌────────────────────────────────────────────────────────┐
│ Header: Breadcrumbs + H1 Page Title + Action Group     │
├────────────────────────────────────────────────────────┤
│ 4-Column KPI Metric Row (Space Grotesk + Trend Badges) │
│ [ KPI 1 ]      [ KPI 2 ]      [ KPI 3 ]      [ KPI 4 ] │
├──────────────────────────┬─────────────────────────────┤
│ Primary Chart / Diagram  │ Secondary Activity Feed /   │
│ (2/3 Grid Column)        │ Live Timeline (1/3 Col)     │
├──────────────────────────┴─────────────────────────────┤
│ Bottom Section: Quick Actions / Active Workflows Table │
└────────────────────────────────────────────────────────┘
```

### 2.3 Responsive Rules

- **Desktop (≥1024px):** 4-column KPI grid (`grid-cols-4`), 2/3 + 1/3 split
  below.
- **Tablet (640px - 1024px):** 2-column KPI grid (`grid-cols-2`), stacked chart
  and activity feed.
- **Mobile (<640px):** Single-column stacked KPI cards (`grid-cols-1`),
  sparklines simplified.

---

## 3. Pattern 2: List & Enterprise Data Table Pattern

### 3.1 Applied Routes

`/workspace/[workspaceId]/history`,
`/workspace/[workspaceId]/developer/webhooks`,
`/workspace/[workspaceId]/applications`,
`/workspace/[workspaceId]/organizations`, `/workspace/[workspaceId]/schedule`,
`/workspace/[workspaceId]/developer`

### 3.2 Layout Structure & Anatomy

```
┌────────────────────────────────────────────────────────┐
│ PageHeader: Title + Total Record Count Badge + CTA     │
├────────────────────────────────────────────────────────┤
│ Filter Toolbar: Search Field + Facet Dropdowns + Reset │
├────────────────────────────────────────────────────────┤
│ Enterprise Data Table:                                 │
│ [Checkbox] [Header 1 ⇅] [Header 2 ⇅] [Status] [Actions]│
│ ────────────────────────────────────────────────────── │
│ [ Row 1 data...                                      ] │
│ [ Row 2 data...                                      ] │
├────────────────────────────────────────────────────────┤
│ Table Footer: Record count summary + Pagination (< 1 2 3 >) │
└────────────────────────────────────────────────────────┘
```

### 3.3 Implementation Blueprint

- Tables use `border-collapse`, `border-subtle`, and sticky headers
  (`sticky top-0 bg-surface-200`).
- Text in tables defaults to `text-sm font-normal text-text`.
- Status indicators use `StatusBadge` or `ui-kit/Badge` with dual-theme semantic
  colors.
- Actions column utilizes `<DropdownMenu>` or ghost `<IconButton>` to preserve
  clean whitespace.

---

## 4. Pattern 3: Master-Detail Split Pane Pattern

### 4.1 Applied Routes

`/workspace/[workspaceId]/jobs`, `/workspace/[workspaceId]/files`,
`/workspace/[workspaceId]/capabilities`,
`/workspace/[workspaceId]/agents/[agentId]`, `/workspace/[workspaceId]/memory`

### 4.2 Layout Structure & Anatomy

```
┌────────────────────────────────────────────────────────┐
│ PageHeader + Universal Search Bar                      │
├────────────────────────────┬───────────────────────────┤
│ Left Pane (Master List):   │ Right Pane (Detail View): │
│ - Search & Filter inputs   │ - Selected item header    │
│ - Scrollable item cards    │ - Full specifications     │
│ - Semantic match badge     │ - Execution telemetry     │
│ - Selection highlight      │ - Action CTA (e.g. Apply) │
└────────────────────────────┴───────────────────────────┘
```

### 4.3 Responsive Transformation

- **Desktop (≥1024px):** Fixed-ratio split (38% left pane, 62% right pane) with
  independent scroll areas (`overflow-y-auto`).
- **Mobile / Tablet (<1024px):** List view displays full-width; selecting an
  item navigates or slides in an overlay `<Drawer>` showing the detail view. A
  back button returns to the list.

---

## 5. Pattern 4: Single-Column Form & Settings Pattern

### 5.1 Applied Routes

`/workspace/[workspaceId]/settings`,
`/workspace/[workspaceId]/settings/security`,
`/workspace/[workspaceId]/billing`, `/workspace/[workspaceId]/profile`,
`/workspace/[workspaceId]/vault`, `(auth)/login`, `(auth)/signup`,
`(auth)/forgot-password`

### 5.2 Layout Structure & Anatomy

```
┌────────────────────────────────────────────────────────┐
│ PageHeader: Settings Section Title + Category Subtitle │
├────────────────────────────────────────────────────────┤
│ Card Section 1: General Preferences                    │
│ [FormField: Label + Input + Description]               │
│ [FormField: Label + Switch Toggle]                     │
├────────────────────────────────────────────────────────┤
│ Card Section 2: Model Configuration                    │
│ [FormField: Select Dropdown (System 1 vs System 2)]    │
├────────────────────────────────────────────────────────┤
│ Sticky Bottom Action Bar: [Discard] [Save Changes CTA] │
└────────────────────────────────────────────────────────┘
```

### 5.3 Enforced Rules

- Max container width constrained to `max-w-5xl mx-auto` to prevent excessive
  line length.
- Form fields grouped logically inside `<Card>` containers with `border-subtle`.
- Dirty state detection triggers a sticky floating save bar to prevent
  accidental loss of edits.

---

## 6. Pattern 5: AI Reasoning & Conversational Pattern

### 6.1 Applied Routes

`/workspace/[workspaceId]/chat`, `/workspace/[workspaceId]/council`,
`/workspace/[workspaceId]/career`

### 6.2 Layout Structure & Anatomy

```
┌────────────────────────────────────────────────────────┐
│ Chat Header: Agent Persona + Model Badge + Clean Chat  │
├────────────────────────────────────────────────────────┤
│ Virtualized Message Stream:                            │
│ - User Prompt Bubble (Right aligned, subtle surface)   │
│ - Assistant Message Bubble (Left aligned)              │
│   ├── Chain of Thought Accordion (<ReasoningTrace>)    │
│   ├── Synthesized Answer (Markdown + Code Blocks)      │
│   ├── Source Citations Strip (<SourceCitation>)        │
│   └── Tool Execution Card (<ApprovalCard> if mutation) │
├────────────────────────────────────────────────────────┤
│ Sticky Input Bar: Textarea + Model Selector + Send CTA │
└────────────────────────────────────────────────────────┘
```

### 6.3 Observability Invariants

- Collapsible `<ReasoningTrace>` details System 1 classification vs System 2
  synthesis.
- Grounded statements include clickable `<SourceCitation>` referencing original
  documents.
- Active generation displays an animated pulse indicator with live token counts.

---

## 7. Pattern 6: Human-in-the-Loop (HITL) Approval Pattern

### 7.1 Applied Routes

`/workspace/[workspaceId]/approvals`, inline tool executions across `/chat` and
agent workflows

### 7.2 Anatomy & Invariants

- Clear display of the tool name and risk level (`Low`, `Medium`, `Critical`).
- Explicit presentation of parameters to be passed to external APIs.
- Destructive actions require entering an approval phrase or explicit checkbox
  confirmation.
- Direct Reject and Approve actions with instant feedback and toast
  confirmation.

---

## 8. Pattern 7: Destructive & Critical Confirmation Pattern

### 8.1 Applied Routes

`/workspace/[workspaceId]/settings` (danger zone workspace deletion),
`/workspace/[workspaceId]/vault` (secret revocation),
`/workspace/[workspaceId]/settings/security` (session revocation)

### 8.2 Safety Guardrails

1. **Red Semantic Warning**: Banner with
   `border-error/40 bg-error/10 text-error`.
2. **Double Confirmation Phrase**: Requires typing an explicit challenge string
   (e.g. `DELETE WORKSPACE`).
3. **Timed Delay**: Destructive CTA button remains disabled for a mandatory
   3-second countdown to prevent accidental double-clicks.
4. **Permanent Scope Disclosure**: Clear itemized list of what will be
   irrevocably destroyed vs preserved in offline audit logs.
