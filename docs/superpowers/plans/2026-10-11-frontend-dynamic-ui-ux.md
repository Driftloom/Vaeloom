# Frontend Dynamic UI & UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an end-to-end dynamic frontend UI and UX overhaul across the Vaeloom workspace, resolving the ChatHeader widget collision bug, introducing interactive subpages (Agent Squads, Model Matrix, Memory Vault), and elevating the live chat streaming and composer experience.

**Architecture:** Refactor `ChatHeader` into an isolated Identity Zone and an Action Zone with a `ChatSessionInspectorPopover` to permanently resolve layout crowding and badge collisions. Upgrade `ChatSubpages` to provide rich reactive state for specialist squad presets, dynamic model parameter tuning, and a searchable Memory Vault explorer. Polish `ChatEmptyState`, `ChatMessageItem`, and `ChatComposer` with collapsible ReAct thought accordions, tool execution ladders, and fuzzy `@`/`/` autocompletion listboxes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Radix UI primitives, Lucide / SVG icons, Jest + React Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-11-frontend-dynamic-ui-ux-design.md`](file:///c:/PROJECTS/PIOS/ClonU/Driftloom/Vaeloom/docs/superpowers/specs/2026-10-11-frontend-dynamic-ui-ux-design.md)

## Global Constraints

- Never use bare `pnpm dev`; use `pnpm dev:web` or `pnpm dev:be`.
- Do not introduce new heavy runtime dependencies; leverage existing Radix UI primitives and Tailwind utilities.
- Maintain WCAG 2.1 AA accessibility standards (contrast >= 4.5:1 for text, >= 3:1 for glyphs, touch targets >= 44x44px).
- Respect `motion-reduce:transition-none` for users with vestibular sensitivities.
- All newly added components must have comprehensive Jest unit tests under `apps/web/src/components/chat/__tests__/`.

## Review Focus

1. **Header Text Collision Under Resizing**: Verify that `connectionStatus` and `ContextWindowGauge` never overlap or clip at 375px, 768px, 1024px, 1280px, and 1920px.
2. **Agent Badge Collapsing**: Verify that the active agent badge preserves a readable label (e.g. `@resume`) and does not collapse into a bare dot under narrow viewport constraints.
3. **Subpage State Persistence**: Verify that changing tabs from `Chat Stream` to `Agent Squads`, `Model Matrix`, or `Memory Vault` and back preserves thread state, message history, and composer input.
4. **Fuzzy Autocomplete Keyboard Traversal**: Verify that ArrowUp, ArrowDown, Enter, and Escape properly navigate and select agents/skills in `ChatComposer` without stealing focus from the textarea.
5. **Zero Layout Shift (CLS < 0.1)**: Verify that streaming tokens, expanding ReAct accordions, and mounting tool execution cards do not cause jarring page reflows or disrupt user scrolling.

---

### Task 1: Unified Header Architecture & Collision Fix

**Files:**
- Create: `apps/web/src/components/chat/ChatSessionInspectorPopover.tsx`
- Modify: `apps/web/src/components/chat/ChatHeader.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-header-unified.test.tsx`

**Interfaces:**
- Consumes:
  - `ContextWindowGaugeProps` from `apps/web/src/components/chat/ContextWindowGauge.tsx`
  - `ChatHeaderProps` from `apps/web/src/components/chat/ChatHeader.tsx`
- Produces:
  - `ChatSessionInspectorPopover({ totalTokens, maxTokens, modelId, durableMode, onDurableModeChange, onCompact, isCompacting, onToggleMemoryDrawer, agentCount }: SessionInspectorProps): JSX.Element`

- [ ] **Step 1: Write the failing test for unified header layout**

Create `apps/web/src/components/chat/__tests__/chat-header-unified.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatHeader } from '../ChatHeader';

describe('ChatHeader Unified Architecture', () => {
  it('renders connection status and agent badge without overlapping context gauge', () => {
    render(
      <ChatHeader
        workspaceId="212ed9ca-5a26-45b3-8bf2-28f77389c6a3"
        agentName="resume"
        agentCount={10}
        durableMode={false}
        onDurableModeChange={jest.fn()}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
        selectedModel="gemma4:31b"
        contextTotalTokens={4500}
        contextMaxTokens={32768}
      />
    );

    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('resume')).toBeInTheDocument();
    expect(screen.getByLabelText(/Session Controls|Context Usage/i)).toBeInTheDocument();
  });

  it('opens session inspector popover with durable mode and vault shortcuts', () => {
    const onDurableChange = jest.fn();
    const onToggleMemory = jest.fn();
    render(
      <ChatHeader
        workspaceId="212ed9ca"
        agentName="auto"
        agentCount={5}
        durableMode={false}
        onDurableModeChange={onDurableChange}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
        contextTotalTokens={1200}
        contextMaxTokens={32768}
        onToggleMemoryDrawer={onToggleMemory}
      />
    );

    const trigger = screen.getByLabelText(/Session Controls|Context Usage/i);
    fireEvent.click(trigger);
    expect(screen.getByText(/Durable Mode/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-header-unified.test.tsx`  
Expected: FAIL with missing elements or labels.

- [ ] **Step 3: Implement `ChatSessionInspectorPopover` and refactor `ChatHeader.tsx`**

1. Create `ChatSessionInspectorPopover.tsx` utilizing a controlled popover containing the context gauge, durable toggle, memory vault button, and agent count.
2. In `ChatHeader.tsx`, isolate the Identity Zone (`flex min-w-0 items-center gap-2.5`) with resilient min-width for the agent badge (`min-w-[4.5rem]`).
3. Position the connection status cleanly alongside the title, and mount the `ChatSessionInspectorPopover` in the Action Zone to prevent any linear collision.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-header-unified.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/ChatSessionInspectorPopover.tsx apps/web/src/components/chat/ChatHeader.tsx apps/web/src/components/chat/__tests__/chat-header-unified.test.tsx
git commit -m "feat(web): unified ChatHeader architecture and SessionInspector popover"
```

---

### Task 2: Dynamic Agent Squads Subpage

**Files:**
- Modify: `apps/web/src/components/chat/ChatSubpages.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-subpages-squads.test.tsx`

**Interfaces:**
- Consumes:
  - `SPECIALIST_AGENTS` from `apps/web/src/components/chat/ChatAgentSquadSelector.tsx`
- Produces:
  - `AgentSquadsView({ selectedSquad, onToggleAgent, onSelectSquad, onActivateSquad }: AgentSquadsViewProps): JSX.Element`
  - Preset configurations: `SQUAD_PRESETS: Array<{ id: string, name: string, description: string, agentIds: string[] }>`

- [ ] **Step 1: Write the failing test for dynamic Agent Squads**

Create `apps/web/src/components/chat/__tests__/chat-subpages-squads.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentSquadsView } from '../ChatSubpages';

describe('Dynamic Agent Squads View', () => {
  it('renders squad presets and activates a preset', () => {
    const onSelectSquad = jest.fn();
    const onActivateSquad = jest.fn();

    render(
      <AgentSquadsView
        selectedSquad={['career_coach']}
        onToggleAgent={jest.fn()}
        onSelectSquad={onSelectSquad}
        onActivateSquad={onActivateSquad}
      />
    );

    expect(screen.getByText(/Full Executive Search/i)).toBeInTheDocument();
    expect(screen.getByText(/ATS & Technical Screener/i)).toBeInTheDocument();

    const presetBtn = screen.getByRole('button', { name: /Select Full Executive Search/i });
    fireEvent.click(presetBtn);
    expect(onSelectSquad).toHaveBeenCalled();

    const activateBtn = screen.getByRole('button', { name: /Activate Squad in Chat/i });
    fireEvent.click(activateBtn);
    expect(onActivateSquad).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-subpages-squads.test.tsx`  
Expected: FAIL with preset buttons not found.

- [ ] **Step 3: Implement dynamic squad presets and execution pipeline visualizer in `ChatSubpages.tsx`**

Add `SQUAD_PRESETS` with 1-click selection, pipeline execution flow visualization, and primary "Activate Squad in Chat" trigger that executes `onActivateSquad`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-subpages-squads.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/ChatSubpages.tsx apps/web/src/components/chat/__tests__/chat-subpages-squads.test.tsx
git commit -m "feat(web): add dynamic squad presets and pipeline visualizer to AgentSquadsView"
```

---

### Task 3: Dynamic Model Matrix & Parameter Tuner

**Files:**
- Modify: `apps/web/src/components/chat/ChatSubpages.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-subpages-models.test.tsx`

**Interfaces:**
- Consumes:
  - `ModelOption` from `apps/web/src/components/chat/types.ts`
- Produces:
  - `ModelMatrixView({ availableModels, selectedModel, onSelectModel, temperature, onTemperatureChange }: ModelMatrixViewProps): JSX.Element`

- [ ] **Step 1: Write the failing test for Model Matrix Tuner**

Create `apps/web/src/components/chat/__tests__/chat-subpages-models.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelMatrixView } from '../ChatSubpages';
import type { ModelOption } from '../types';

const TEST_MODELS: ModelOption[] = [
  {
    id: 'gemma4:31b',
    name: 'Ollama Cloud Gemma 4 31B',
    provider: 'ollama',
    tier: 'balanced',
    contextWindow: 32768,
    maxTokens: 32768,
    description: 'Balanced enterprise model',
    status: 'ready',
  },
];

describe('Model Matrix View Tuner', () => {
  it('renders interactive temperature presets and updates temperature', () => {
    const onTemperatureChange = jest.fn();
    render(
      <ModelMatrixView
        availableModels={TEST_MODELS}
        selectedModel="gemma4:31b"
        onSelectModel={jest.fn()}
        temperature={0.7}
        onTemperatureChange={onTemperatureChange}
      />
    );

    expect(screen.getByText(/Creative \(1.0\)/i)).toBeInTheDocument();
    const creativeBtn = screen.getByRole('button', { name: /Creative/i });
    fireEvent.click(creativeBtn);
    expect(onTemperatureChange).toHaveBeenCalledWith(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-subpages-models.test.tsx`  
Expected: FAIL with preset buttons not found.

- [ ] **Step 3: Implement Model Matrix Tuner in `ChatSubpages.tsx`**

Enhance `ModelMatrixView` with:
- Temperature preset chips (`Precise 0.2`, `Balanced 0.7`, `Creative 1.0`).
- Comparative context window cards with provider badges and status indicator.
- 1-click model selection action.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-subpages-models.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/ChatSubpages.tsx apps/web/src/components/chat/__tests__/chat-subpages-models.test.tsx
git commit -m "feat(web): add real-time parameter tuner and model matrix cards"
```

---

### Task 4: Dynamic Memory Vault Explorer Subpage

**Files:**
- Create: `apps/web/src/components/chat/MemoryVaultExplorer.tsx`
- Modify: `apps/web/src/components/chat/ChatWindow.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-subpages-memory.test.tsx`

**Interfaces:**
- Consumes:
  - `workspaceId: string`
  - `onCiteMemory: (citation: string) => void`
- Produces:
  - `MemoryVaultExplorer({ workspaceId, onCiteMemory, onOpenVaultDrawer }: MemoryVaultExplorerProps): JSX.Element`

- [ ] **Step 1: Write the failing test for Memory Vault Explorer**

Create `apps/web/src/components/chat/__tests__/chat-subpages-memory.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryVaultExplorer } from '../MemoryVaultExplorer';

describe('Memory Vault Explorer', () => {
  it('filters memories by category tag and allows citing into composer', () => {
    const onCite = jest.fn();
    render(
      <MemoryVaultExplorer
        workspaceId="212ed9ca"
        onCiteMemory={onCite}
        onOpenVaultDrawer={jest.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/Search memories, skills, notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /#career/i })).toBeInTheDocument();

    const citeButtons = screen.getAllByRole('button', { name: /Cite in Chat/i });
    fireEvent.click(citeButtons[0]);
    expect(onCite).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-subpages-memory.test.tsx`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `MemoryVaultExplorer.tsx` and wire into `ChatWindow.tsx`**

1. Create `MemoryVaultExplorer.tsx` with search filter, category tags (`#career`, `#skills`, `#projects`, `#education`), dynamic memory card list with "Cite in Chat" action, and Obsidian Vault sync health badge.
2. In `ChatWindow.tsx`, render `<MemoryVaultExplorer workspaceId={workspaceId} onCiteMemory={(c) => store.setInput(store.input ? `${store.input}\n\n${c}` : c)} onOpenVaultDrawer={() => store.setIsMemoryDrawerOpen(true)} />` when `activeTab === 'memory'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-subpages-memory.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/MemoryVaultExplorer.tsx apps/web/src/components/chat/ChatWindow.tsx apps/web/src/components/chat/__tests__/chat-subpages-memory.test.tsx
git commit -m "feat(web): add dynamic MemoryVaultExplorer subpage with tag search and 1-click citation"
```

---

### Task 5: Contextual Empty State & Adaptive Starters

**Files:**
- Modify: `apps/web/src/components/chat/ChatEmptyState.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-empty-state-dynamic.test.tsx`

**Interfaces:**
- Consumes:
  - `commands: SlashCommand[]`
  - `activeAgent?: string`
  - `onSend: (text: string) => void`
  - `onPickCommand: (trigger: string, agent: string) => void`
- Produces:
  - `ChatEmptyStateProps` extended with `activeAgent?: string`

- [ ] **Step 1: Write the failing test for dynamic empty state**

Create `apps/web/src/components/chat/__tests__/chat-empty-state-dynamic.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatEmptyState } from '../ChatEmptyState';

describe('Dynamic Chat Empty State', () => {
  it('renders category tabs and adapts to active resume agent', () => {
    const onSend = jest.fn();
    render(
      <ChatEmptyState
        commands={[{ trigger: '/ats', agent: 'resume', description: 'Run ATS audit', color: '#10b981' }]}
        commandsState="ready"
        onPickCommand={jest.fn()}
        onSend={onSend}
        activeAgent="resume"
      />
    );

    expect(screen.getByText(/Resume & Career Focused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run ATS Resume Audit/i })).toBeInTheDocument();

    const starterBtn = screen.getByRole('button', { name: /Run ATS Resume Audit/i });
    fireEvent.click(starterBtn);
    expect(onSend).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-empty-state-dynamic.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement dynamic category filters and deep-link awareness in `ChatEmptyState.tsx`**

1. Group starters into contextual categories (`Career & Resume`, `Obsidian Vault`, `Document Analysis`, `General`).
2. Display dedicated resume starters when `activeAgent === 'resume'` or `paramSkill` is active.
3. Add tooltips and visual icon badges to slash command chips.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-empty-state-dynamic.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/ChatEmptyState.tsx apps/web/src/components/chat/__tests__/chat-empty-state-dynamic.test.tsx
git commit -m "feat(web): dynamic empty state category tabs and deep-link prompt starters"
```

---

### Task 6: Chat Stream Interactivity (ReAct Accordions & Tool Ladder)

**Files:**
- Modify: `apps/web/src/components/chat/ChatMessageItem.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-message-interactivity.test.tsx`

**Interfaces:**
- Consumes:
  - `ChatMessage` from `apps/web/src/components/chat/types.ts`
- Produces:
  - `ReActThoughtAccordion({ thoughts: string, isStreaming?: boolean }): JSX.Element`
  - `ToolExecutionLadder({ phaseEvents: PhaseEvent[] }): JSX.Element`

- [ ] **Step 1: Write the failing test for ReAct accordions and tool ladders**

Create `apps/web/src/components/chat/__tests__/chat-message-interactivity.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessageItem } from '../ChatMessageItem';
import type { ChatMessage } from '../types';

const MSG_WITH_THOUGHT: ChatMessage = {
  id: 'msg-1',
  role: 'assistant',
  text: '<thought>Analyzing candidate experience against ATS criteria...</thought>Here is the revised resume summary.',
  createdAt: new Date().toISOString(),
};

describe('ChatMessageItem Interactivity', () => {
  it('parses thought tag into collapsible thinking accordion', () => {
    render(
      <ChatMessageItem
        message={MSG_WITH_THOUGHT}
        agentColor="bg-action"
        onCopy={jest.fn()}
        onRetry={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDecide={jest.fn()}
        onSend={jest.fn()}
      />
    );

    expect(screen.getByText(/Thinking Process/i)).toBeInTheDocument();
    const accordionBtn = screen.getByRole('button', { name: /Toggle thinking process/i });
    fireEvent.click(accordionBtn);
    expect(screen.getByText(/Analyzing candidate experience against ATS criteria/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-message-interactivity.test.tsx`  
Expected: FAIL with thinking process button not found.

- [ ] **Step 3: Implement ReAct thought parser and accordion in `ChatMessageItem.tsx`**

1. Parse `<thought>...</thought>` blocks and render a styled collapsible accordion (`Thinking Process` with animated indicator).
2. Render formatted tool execution steps with collapsible arguments and copy button.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-message-interactivity.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/ChatMessageItem.tsx apps/web/src/components/chat/__tests__/chat-message-interactivity.test.tsx
git commit -m "feat(web): add collapsible ReAct thought accordion and tool ladder to ChatMessageItem"
```

---

### Task 7: Rich Composer Experience & Autocomplete Popovers

**Files:**
- Modify: `apps/web/src/components/chat/ChatComposer.tsx`
- Test: `apps/web/src/components/chat/__tests__/chat-composer-rich.test.tsx`

**Interfaces:**
- Consumes:
  - `ChatComposerProps` from `apps/web/src/components/chat/ChatComposer.tsx`
- Produces:
  - Enhanced `@` and `/` fuzzy autocompletion listbox
  - Token threshold progress badge
  - Voice transcription action slot

- [ ] **Step 1: Write the failing test for rich composer features**

Create `apps/web/src/components/chat/__tests__/chat-composer-rich.test.tsx`:
```tsx
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatComposer } from '../ChatComposer';

describe('ChatComposer Rich Capabilities', () => {
  it('renders voice transcription placeholder slot and accessible token gauge', () => {
    render(
      <ChatComposer
        value="Hello world"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onStop={jest.fn()}
        busy={false}
        commands={[]}
        commandsState="ready"
        mentionTargets={[]}
        selectedAgent="auto"
        onSelectAgent={jest.fn()}
        attachment={null}
        onAttachment={jest.fn()}
        maxLength={10000}
      />
    );

    expect(screen.getByLabelText(/Voice Input/i)).toBeInTheDocument();
    expect(screen.getByText(/~3 tok · 11\/10000/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-composer-rich.test.tsx`  
Expected: FAIL with voice input button missing.

- [ ] **Step 3: Implement rich composer features in `ChatComposer.tsx`**

1. Add voice input trigger button with tooltip: "Voice input (transcription coming in Phase 4)".
2. Enhance token badge with threshold styling (green <75%, amber 75-90%, red >90%).
3. Polish fuzzy autocompletion popup with category headers (`Agents` vs `Skills`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vaeloom/web test -- src/components/chat/__tests__/chat-composer-rich.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/ChatComposer.tsx apps/web/src/components/chat/__tests__/chat-composer-rich.test.tsx
git commit -m "feat(web): add voice input action slot and polished token gauge to ChatComposer"
```

---

### Task 8: Full Suite Regression Verification & Typecheck

**Files:**
- Verification only

- [ ] **Step 1: Run all web test suites**
Run: `pnpm --filter @vaeloom/web test`  
Expected: All suites PASS.

- [ ] **Step 2: Run TypeScript typecheck across monorepo**
Run: `pnpm typecheck`  
Expected: 0 errors.

- [ ] **Step 3: Run linter**
Run: `pnpm lint`  
Expected: 0 errors.
