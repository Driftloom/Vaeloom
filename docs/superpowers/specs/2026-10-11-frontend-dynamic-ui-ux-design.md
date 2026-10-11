# Frontend Dynamic UI & UX Architecture Specification

**Date:** 2026-10-11  
**Status:** Approved for Implementation Planning  
**Scope:** `@vaeloom/web` Workspace Shell, Chat Header, Subpages, Chat Stream & Composer  
**Reference Design System:** Vaeloom Dark System (Pure Black Canvas `#000000`, Radix UI / shadcn/ui primitives, Tailwind CSS, WCAG 2.1 AA)

---

## 1. Executive Summary & Problem Analysis

### 1.1 Context
Vaeloom's primary workspace surface is the multi-agent chat interface at `/workspace/[workspaceId]/chat`. The platform orchestrates autonomous career intelligence, document synthesis, and memory recall across specialized AI squads.

### 1.2 Observed Usability & Visual Defects (Screenshot Analysis)
Inspection of the running web application (`localhost:3000/workspace/.../chat`) revealed three critical UI/UX friction points:
1. **Header Congestion & Widget Collision**:
   - `ChatHeader.tsx` compresses 11 distinct widgets into a single 48px flex bar:
     `[Chat Title]`, `[Workspace ID]`, `[Agent Pill]`, `[Squad Pill]`, `[Connection Status]`, `[ContextWindowGauge]`, `[ModelSelector]`, `[Vault Button]`, `[Agent Count]`, `[Durable Checkbox]`, and `[New Chat Button]`.
   - In viewports between 1024px and 1440px, the left metadata container (`min-w-0`) and right action container (`shrink-0`) collide without adequate gap isolation.
   - Specifically, the `connectionStatus` badge (`connected`) and `ContextWindowGauge` (`0/32.8k 0% Compact`) overlap directly on top of each other, creating unreadable text collision.
   - The active agent pill (`@resume`) collapses into an empty dot due to nested `truncate` constraints without a resilient minimum width.
2. **Subpage Dynamism Gaps**:
   - The subpage navigation bar (`Chat Stream`, `Agent Squads`, `Model Matrix`, `Memory Vault`) provides navigation, but the underlying views have limited interactivity:
     - `Agent Squads`: Displays cards without squad presets, pipeline visualization, or 1-click squad activation.
     - `Model Matrix`: Lacks comparative latency/capability metrics and interactive parameter tuning.
     - `Memory Vault`: Renders static informative text cards rather than an interactive searchable knowledge browser.
3. **Chat Stream & Composer Polish**:
   - Empty state prompt starters are static and do not adapt to active agent parameters (e.g. `agent=resume` deep-links).
   - Streamed tool executions, reasoning steps ("Thinking..."), and generated artifacts (resumes, cover letters, diffs) need first-class collapsible accordions and interactive export/preview actions.
   - The composer needs fluid `@` and `/` popovers, drag-and-drop file chips, token warning thresholds, and an extensible architecture for future voice/audio transcription.

---

## 2. Design Principles & Token Standards

Consistent with `ui-ux-pro-max`, `ui-styling`, and `web-design-guidelines`:
- **Surface Elevation Ramp**:
  - Canvas: Pure Black (`#000000`, `--bg`)
  - Subtle containers: `--surface-50` (`#0A0A0C`)
  - Cards & panels: `--surface-100` (`#0E0E11`)
  - Interactive controls / hover: `--surface-200` (`#141418`) / `--surface-hover` (`#121216`)
  - Borders: `--border` (`#222228`) and `--border-subtle` (`#18181C`)
- **Typography & Scale**:
  - Primary text: `--text` (`#F5F7FF`, contrast ratio > 10:1 on black)
  - Secondary text: `--text-muted` (`#8A8E9E`, contrast ratio > 4.5:1)
  - Monospace tokens: Tabular figures for token counts, latencies, and code chips.
- **Micro-Interactions**:
  - Standard transition duration: `150ms-200ms ease-out`.
  - Accessible touch targets: Minimum `44x44px` interactive area.
  - Reduced motion: Strict adherence to `motion-reduce:transition-none`.

---

## 3. Phase 1: Workspace Shell & Unified Header Architecture

### 3.1 Header Decomposition & Priority-Based Disclosure
Instead of packing 11 items linearly into `ChatHeader.tsx`, the header is partitioned into two clear zones:

```
+-------------------------------------------------------------------------------------------------------+
| [=] Chat · 212ed9ca [@resume Agent] [⚡ Squad: 3] | [Ollama Cloud Gemma 4 v] [Session Inspector v] [+ New] |
+-------------------------------------------------------------------------------------------------------+
```

1. **Left Zone: Identity & Routing**
   - Mobile thread drawer toggle (hidden on `md+`).
   - Page title `Chat` (`text-sm font-medium text-text`).
   - Truncated workspace pill (`· 212ed9ca`).
   - Resilient Agent Badge: Guaranteed minimum width (`min-w-[4.5rem]`), status dot, agent name with tooltip on truncation.
   - Connection Health Indicator: Consolidated into a clean status dot + text badge with `shrink-0` isolation to eliminate overlap.
2. **Right Zone: Actions & Session Inspector Popover**
   - **Primary Controls (Top-Level)**:
     - `ChatModelSelector`: Clean dropdown displaying current model with provider badge and temperature indicator.
     - `Session Inspector Trigger` (`Session Controls`): A compact, elegant badge displaying current context usage (`ZapIcon 0/32.8k 0%`) and status. Clicking opens a popover containing:
       - Detailed Context Window Gauge & token budget progress.
       - "Compact Conversation" button with confirmation.
       - "Durable Mode" workflow toggle.
       - "📌 Open Obsidian Vault Drawer" shortcut.
       - Active agent count and provider health.
     - Primary `+ New Chat` action button.
   - **Responsive Behavior**:
     - On wide screens (`xl+`), the Context Window Gauge can expand inline with proper spacing (`gap-3`).
     - On smaller screens (`<1200px`), dense metrics collapse neatly into the Session Inspector Popover without clipping or overlapping.

### 3.2 Thread Rail & Global Sidebar Alignment
- **Global Sidebar**: High-contrast active indicators, verified tooltips on hover for icon-only navigation, smooth collapsing transition.
- **Thread Rail**:
  - Filter input with clear button.
  - Active thread item with subtle background elevation (`--surface-100`) and border glow.
  - Keyboard shortcut: `Cmd+B` / `Ctrl+B` toggle drawer indicator.

---

## 4. Phase 2: Dynamic Interactive Subpages

### 4.1 Subpage Navigation (`ChatSubpagesNav`)
- Preserves 4 tabs: `Chat Stream` (💬), `Agent Squads` (👥), `Model Matrix` (⚡), and `Memory Vault` (📌).
- Animated active indicator pill with keyboard navigation (`ArrowRight`, `ArrowLeft`).

### 4.2 Dynamic Agent Squads (`AgentSquadsView`)
- **Squad Presets**:
  - *Full Executive Squad*: Executive Resume Writer + Interview Prep + Bar Raiser.
  - *ATS Technical Screener*: ATS Resume Builder + Keyword Optimizer + Technical Screener.
  - *Career Transition Squad*: Career Changer Translator + Salary Negotiator.
- **Interactive Multi-Agent Builder**:
  - Checkbox toggles with real-time capability tags (e.g. `Parse PDF`, `SSRF Protected`, `Obsidian Grounded`).
  - Visual pipeline diagram showing sequential vs. parallel execution flow.
  - "Activate Squad in Chat" primary CTA that configures the session and switches directly to the Stream tab.

### 4.3 Dynamic Model Matrix (`ModelMatrixView`)
- **Interactive Parameter Tuner**:
  - Temperature slider (0.0 to 1.0) with presets (`Precise 0.2`, `Balanced 0.7`, `Creative 1.0`).
  - Context window ceiling and token pricing display.
- **Comparative Model Cards**:
  - Provider chips (`Ollama Cloud`, `Gemini`, `Claude`, `OpenAI`).
  - Real-time provider connectivity & latency indicator.
  - 1-click "Select for Current Chat" button.

### 4.4 Dynamic Memory Vault Explorer (`MemoryVaultView`)
- Replaces static informational cards with a live workspace memory viewer:
  - **Search & Tag Filter**: Real-time filtering by category (`career`, `project`, `skills`, `education`, `feedback`).
  - **Memory Cards Grid**:
    - Fact/note snippet with timestamp and provenance source.
    - 1-click "Cite in Chat" action: Appends context directly to composer textarea.
    - Delete and edit controls.
  - **Obsidian Vault Status**: Sync status badge, vault directory path, and manual "Sync Vault Now" trigger.

---

## 5. Phase 3: Chat Stream, Message Interactivity, and Composer Polish

### 5.1 Dynamic Empty State (`ChatEmptyState`)
- **Smart Category Tabs**: Filter starter prompts by intent:
  - `Career & Resumes`, `Obsidian Vault`, `Document Analysis`, `Job Hunting`.
- **Deep-Link Awareness**:
  - When `?agent=resume` or `?prompt=...` is detected, the empty state displays tailored guidance for the targeted workflow.
- **Slash Commands Grid**:
  - Grid of interactive chips with trigger name (`/ats`, `/career`, `/apply`, `/code`), description tooltips, and click-to-execute.

### 5.2 Chat Stream Interactivity (`ChatMessageList` & `ChatMessageItem`)
- **Smooth Token Streaming**: Monospace tabular figures, auto-scrolling with user interrupt protection (`useChatAutoScroll`).
- **ReAct Thought & Reasoning Accordion**:
  - Collapsible "Thinking Process" disclosure for agent planning.
  - Animated pulse indicator during active reasoning; auto-collapses on completion with expandable toggle.
- **Tool Execution Ladder**:
  - Dynamic cards for intermediate tool calls (e.g. `Searching Obsidian Vault...`, `Compiling PDF...`).
  - Collapsible arguments and execution outputs.
- **Artifact & Code Preview**:
  - Syntax highlighted code blocks with language badge and 1-click copy.
  - Artifact preview cards with direct 1-click view and export/download.
- **Turn Actions**:
  - Message action bar: "Copy Text", "📌 Pin to Memory", "Edit Prompt", "Retry Turn".

### 5.3 Rich Composer Experience (`ChatComposer`)
- **Dynamic `@` and `/` Autocomplete Popover**:
  - Floating listbox with instant fuzzy search across agents and enabled workspace skills.
  - Full keyboard accessibility (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
- **Drag-and-Drop File Upload Zone**:
  - Visual dropzone overlay on drag.
  - Attachment preview chip with file name, size, and remove button.
- **Dynamic Token Budget Warning**:
  - Live token estimator (`~X tok / Y max`) with color transitions: green (<75%), amber (75-90%), red (>90%).
- **Future Voice Input Extensibility**:
  - Dedicated slot/hook in composer layout for microphone trigger and speech-to-text integration in subsequent phase.

---

## 6. Error Handling & Edge Cases

1. **Header Overflow at Arbitrary Screen Sizes**:
   - Resilient flex wrapping and `Session Inspector Popover` ensure that even at 1024px or with large font scaling, no elements overlap or push out of bounds.
2. **WebSocket Disconnects**:
   - Connection status cleanly transitions between `connected` (green), `connecting` (pulsing amber), and `disconnected` (gray) without shifting neighboring elements.
3. **Empty / Loading States**:
   - Subpages display graceful skeleton loaders and meaningful empty states with action triggers when agents or memories are loading.
4. **Markdown Parsing Edge Cases**:
   - Sanitized markdown rendering prevents layout breakage from unclosed code blocks, math formulas, or raw HTML tags.

---

## 7. Verification & Testing Strategy

- **Unit Tests**:
  - `ChatHeader.test.tsx`: Test rendering at 375px, 768px, 1280px, and 1920px. Verify no text collision between connection status and context gauge.
  - `ChatSubpages.test.tsx`: Test tab switching, squad activation, model tuning, and memory search filtering.
  - `ChatComposer.test.tsx`: Test `@` and `/` triggers, keyboard navigation, attachment chips, and token count calculations.
- **Regression Testing**:
  - Run `cd apps/web && npx jest` to ensure all existing chat and workspace unit tests remain 100% green.
  - Run `pnpm typecheck` to verify zero TypeScript errors across packages.
  - Run `pnpm lint` to confirm strict linting compliance.
