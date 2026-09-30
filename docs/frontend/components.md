# Vaeloom UI Component Specification & Reference

**Package:** `@vaeloom/ui-kit` & `apps/web/src/components/shared`  
**Standard:** Enterprise Zero-Trust Reusable Component Architecture  
**Target:** Production Web Application (Next.js 15 App Router, React 18,
Tailwind CSS)

---

## 1. Architectural Principles

All components in Vaeloom adhere to five core design principles:

1. **Token-Only Styling**: Components never accept arbitrary color or spacing
   values; all styling is driven by semantic design tokens.
2. **Dual-Theme Invariance**: Components render with flawless contrast and
   hierarchy in both dark (`#000000` canvas) and light (`#F7F8FC` canvas) themes
   without requiring theme prop overrides.
3. **Accessibility by Default**: Components use semantic HTML elements
   (`<button>`, `<input>`, `<dialog>`), full ARIA attributes (`aria-expanded`,
   `aria-controls`, `aria-describedby`), and keyboard roving index where
   appropriate.
4. **Resilience & State Exhaustiveness**: Every component handles Default,
   Hover, Focus-Visible, Active, Disabled, Loading, and Error states cleanly.
5. **AI Observability Grounding**: Cognitive components expose model provenance,
   confidence scores, execution latencies, and citations with complete
   transparency.

---

## 2. Core Layout & Container Primitives

### 2.1 `Container`

Centers page content and enforces max-width constraints.

```tsx
import { Container } from '@vaeloom/ui-kit';

<Container size="7xl" className="py-8">
  <PageHeader title="Agent Telemetry" />
  {/* Content */}
</Container>;
```

- **Props:** `size?: 'sm' | 'md' | 'lg' | '5xl' | '6xl' | '7xl' | 'full'`
  (defaults to `'7xl'`).

### 2.2 `Stack` & `Inline`

Flexbox layout primitives for vertical and horizontal stacking.

```tsx
import { Stack, Inline } from '@vaeloom/ui-kit';

<Stack gap="4">
  <Inline justify="between" align="center">
    <h2 className="text-lg font-semibold text-text">Active Connectors</h2>
    <Button variant="secondary" size="sm">
      Refresh
    </Button>
  </Inline>
  <Card>...</Card>
</Stack>;
```

- **`Stack` Props:** `gap?: '1' | '2' | '3' | '4' | '6' | '8' | '12'`,
  `align?: 'start' | 'center' | 'end' | 'stretch'`.
- **`Inline` Props:** `gap?: '1' | '2' | '3' | '4' | '6'`,
  `justify?: 'start' | 'center' | 'between' | 'end'`, `wrap?: boolean`.

### 2.3 `Card`

Standard elevated surface for dashboard metrics, lists, and forms.

```tsx
import { Card } from '@vaeloom/ui-kit';

<Card variant="default" padding="6" hoverable>
  <Card.Header>
    <Card.Title>TypeSafe AI Jev (System 1)</Card.Title>
    <Card.Description>Sub-50ms deterministic action router</Card.Description>
  </Card.Header>
  <Card.Body>
    <p className="text-sm text-text-muted">Routing accuracy: 99.4%</p>
  </Card.Body>
  <Card.Footer>
    <Button variant="outline" size="sm">
      Inspect Logs
    </Button>
  </Card.Footer>
</Card>;
```

---

## 3. Actions & Interactive Controls

### 3.1 `Button`

Canonical button component supporting full variant, size, and state matrices.

```tsx
import { Button } from '@vaeloom/ui-kit';
import { Plus } from 'lucide-react';

<Button
  variant="primary"
  size="md"
  icon={<Plus className="w-4 h-4" />}
  loading={isSubmitting}
  onClick={handleCreate}
>
  Deploy Agent
</Button>;
```

- **Variants:**
  - `primary`: Solid `#4F46E5` indigo background, white text (`text-action-fg`).
    Primary call-to-action.
  - `secondary`: Neutral surface background (`bg-surface-200`), high contrast
    text.
  - `outline`: Border subtle (`border-border`), transparent surface, hover
    highlight.
  - `ghost`: Transparent surface, subtle hover tint. Used for table action
    buttons.
  - `destructive`: Error background/border
    (`bg-error/10 text-error border-error/30`).
  - `link`: Underlined text with primary color.
- **Sizes:** `sm` (32px height), `md` (40px height), `lg` (48px height).

### 3.2 `IconButton`

Accessible icon wrapper with mandatory label.

```tsx
import { IconButton } from '@vaeloom/ui-kit';
import { Trash2 } from 'lucide-react';

<IconButton
  icon={<Trash2 className="w-4 h-4" />}
  aria-label="Delete memory node"
  variant="destructive"
  size="sm"
  onClick={handleDelete}
/>;
```

---

## 4. Forms & Input Controls

### 4.1 `FormField` & `Input`

Accessible form group linking label, control, and validation message via ARIA.

```tsx
import { FormField, Input } from '@vaeloom/ui-kit';

<FormField
  label="Workspace Name"
  description="Used in URLs and team invite links"
  error={errors.name?.message}
  required
>
  <Input
    placeholder="e.g. Acme AI Labs"
    value={name}
    onChange={(e) => setName(e.target.value)}
    hasError={!!errors.name}
  />
</FormField>;
```

### 4.2 `Switch`

Binary toggle control.

```tsx
import { Switch } from '@vaeloom/ui-kit';

<Switch
  checked={isEnabled}
  onChange={setIsEnabled}
  label="Enable Autonomous Job Applications"
  description="Allow agent to submit applications with high semantic fit (>85%)"
/>;
```

### 4.3 `SearchField`

Standard debounced search field with keyboard shortcut indicator.

```tsx
import { SearchField } from '@vaeloom/ui-kit';

<SearchField
  placeholder="Search jobs, resumes, knowledge base..."
  shortcut="⌘K"
  value={query}
  onChange={setQuery}
  onClear={() => setQuery('')}
/>;
```

---

## 5. AI & Cognitive Observability Components

### 5.1 `ConfidenceIndicator`

Displays AI decision confidence score with semantic color coding.

```tsx
import { ConfidenceIndicator } from '@vaeloom/ui-kit';

<ConfidenceIndicator score={0.92} showLabel size="md" label="ATS Match Fit" />;
```

- Thresholds: Score ≥ 0.85 = `success` (Emerald); 0.70 - 0.84 = `warning`
  (Amber); < 0.70 = `error` (Rose).

### 5.2 `SourceCitation`

Provides verifiable provenance for synthesized agent responses.

```tsx
import { SourceCitation } from '@vaeloom/ui-kit';

<SourceCitation
  documentTitle="Staff_Engineer_Resume.pdf"
  pageNumber={2}
  chunkId="chunk-9481"
  similarity={0.94}
  onPreview={openPreviewDrawer}
/>;
```

### 5.3 `ApprovalCard`

Human-in-the-Loop decision gate for critical agent tool executions.

```tsx
import { ApprovalCard } from '@/components/shared/ApprovalCard';

<ApprovalCard
  id="req-8120"
  toolName="send_application_email"
  riskLevel="high"
  arguments={{
    recipient: 'recruiter@anthropic.com',
    template: 'personalized_v2',
  }}
  onApprove={handleApprove}
  onReject={handleReject}
/>;
```

---

## 6. Feedback & Notification Components

### 6.1 `Toast` & `ToastProvider`

Accessible system alert toasts using polite ARIA live regions.

```tsx
import { useToast } from '@/components/shared/Toast';

const { toast } = useToast();

toast({
  tone: 'success',
  title: 'Resume Compiled',
  detail:
    'Playwright rendered PDF in 1.4s with 1-page fit constraint satisfied.',
});
```

### 6.2 `Modal`

Accessible dialog window with focus trap and backdrop scrim.

```tsx
import { Modal } from '@/components/shared/Modal';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Revocation"
  description="Are you sure you want to revoke this API credential? Any connected MCP server will immediately disconnect."
>
  <div className="flex justify-end gap-3 mt-6">
    <Button variant="secondary" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="destructive" onClick={handleRevoke}>
      Revoke Credential
    </Button>
  </div>
</Modal>;
```

---

## 7. Component Usage Rules & Anti-Patterns

1. **Anti-Pattern: Custom Color Overrides**: Do not write
   `style={{ backgroundColor: '#4f46e5' }}` or `className="text-[#6366f1]"`. Use
   component variant props (`variant="primary"`) or semantic classes
   (`text-primary`).
2. **Anti-Pattern: Missing Form Labels**: Never render an `<Input>` or
   `<SearchField>` without an associated `<label>` or explicit `aria-label`.
3. **Anti-Pattern: Raw Dialog Windows**: Never write custom `fixed inset-0 z-50`
   overlay divs; always use `<Modal>` or `<Drawer>` to ensure focus trap,
   keyboard Escape listener, and body scroll lock.
4. **Anti-Pattern: Silent AI Tool Executions**: Non-read-only tool mutations
   must surface through `<ApprovalCard>` or require explicit human approval
   before background execution.
