import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { StatusDot } from '../components/StatusDot';
import { ButtonGroup } from '../components/actions/ButtonGroup';
import { AIInsight } from '../components/ai/AIInsight';
import { AIMessage } from '../components/ai/AIMessage';
import { AgentPermission } from '../components/ai/AgentPermission';
import { AgentProposal } from '../components/ai/AgentProposal';
import { AgentRun } from '../components/ai/AgentRun';
import { AgentStatus } from '../components/ai/AgentStatus';
import { ChatComposer } from '../components/ai/ChatComposer';
import { ConfidenceIndicator } from '../components/ai/ConfidenceIndicator';
import { SourceCitation } from '../components/ai/SourceCitation';
import { Panel } from '../components/containers/Panel';
import { FilterBar } from '../components/data/FilterBar';
import { ErrorState } from '../components/feedback/ErrorState';
import { FormField } from '../components/forms/FormField';
import { Textarea } from '../components/forms/Textarea';
import { Box } from '../components/layout/Box';
import { Divider } from '../components/layout/Divider';
import { Grid } from '../components/layout/Grid';
import { Heading } from '../components/layout/Heading';
import { Stack } from '../components/layout/Stack';
import { Text } from '../components/layout/Text';
import { MIN_TOUCH_TARGET } from '../components/layout/touchTarget';
import { MemoryCard } from '../components/memory/MemoryCard';
import { MemoryEntity } from '../components/memory/MemoryEntity';
import { MemoryEvidence } from '../components/memory/MemoryEvidence';
import { MemoryRelationship } from '../components/memory/MemoryRelationship';
import { MemoryTimeline } from '../components/memory/MemoryTimeline';
import { Breadcrumb } from '../components/navigation/Breadcrumb';
import { Pagination } from '../components/navigation/Pagination';

describe('Input, Select, Textarea, FormField validation wiring', () => {
  it('Input links its label, error and description', () => {
    render(<Input label="Work Email" error="Required" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(screen.getByText('Work Email').getAttribute('for')).toBe('work-email');
    expect(input.id).toBe('work-email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Required');
    expect(document.getElementById(input.getAttribute('aria-describedby') as string)).toBe(alert);
    expect(input.className).toContain('border-error');
  });

  it('Input falls back to the helper text when valid', () => {
    render(<Input label="Work Email" helperText="We never share it" />);
    const input = screen.getByRole('textbox');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(screen.getByText('We never share it')).not.toBeNull();
  });

  it('Select reports a typed value and its error', () => {
    const onChange = jest.fn();
    render(
      <Select
        label="Region"
        value="eu"
        onChange={onChange}
        options={[
          { value: 'us', label: 'United States' },
          { value: 'eu', label: 'Europe' },
        ]}
      />,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(screen.getByText('Region').getAttribute('for')).toBe(select.id);
    fireEvent.change(select, { target: { value: 'us' } });
    expect(onChange).toHaveBeenCalledWith('us');
  });

  it('Select exposes aria-invalid and a role=alert message', () => {
    render(<Select label="Region" error="Pick one" options={[{ value: 'eu', label: 'Europe' }]} />);
    const select = screen.getByRole('combobox');
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Pick one');
  });

  it('Textarea marks required in the label and links its error', () => {
    render(<Textarea label="Cover letter" required error="Too short" />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.required).toBe(true);
    expect(screen.getByText('Cover letter').querySelector('.text-error')?.textContent).toBe('*');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(textarea.getAttribute('aria-describedby') as string)?.textContent,
    ).toBe('Too short');
  });

  it('Textarea describes itself with the helper when valid', () => {
    render(<Textarea label="Notes" helperText="Markdown supported" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.hasAttribute('aria-invalid')).toBe(false);
    expect(
      document.getElementById(textarea.getAttribute('aria-describedby') as string)?.textContent,
    ).toBe('Markdown supported');
  });

  it('FormField hands error and hint ids to a render-prop child', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Bad address" required>
        {({ id, errorId }) => (
          <input id={id} aria-describedby={errorId} aria-invalid="true" defaultValue="" />
        )}
      </FormField>,
    );
    const input = screen.getByRole('textbox');
    expect(input.id).toBe('email');
    expect(
      document.getElementById(input.getAttribute('aria-describedby') as string)?.textContent,
    ).toBe('Bad address');
    expect(screen.getByRole('alert').textContent).toBe('Bad address');
  });

  it('FormField renders a plain child and prefers the hint when valid', () => {
    render(
      <FormField label="Email" htmlFor="email-2" hint="Work address">
        <input id="email-2" defaultValue="" />
      </FormField>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Work address')).not.toBeNull();
  });
});

describe('Feedback surfaces', () => {
  it('ErrorState is an alert with a retry affordance', () => {
    const onRetry = jest.fn();
    render(<ErrorState code="E_429" message="Rate limited" onRetry={onRetry} actionText="Retry" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Rate limited');
    expect(alert.textContent).toContain('Error code: E_429');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('EmptyState renders its action', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="No applications yet"
        description="Apply to your first role"
        action={{ label: 'Browse jobs', onClick }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No applications yet' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Browse jobs' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('EmptyState omits the action button when no action is supplied', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ConfirmationDialog confirms and cancels', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(
      <ConfirmationDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete workspace"
        message="This cannot be undone."
        variant="destructive"
      />,
    );
    expect(screen.getByRole('dialog').textContent).toContain('This cannot be undone.');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ConfirmationDialog blocks cancellation while loading', () => {
    const onClose = jest.fn();
    render(
      <ConfirmationDialog
        isOpen
        loading
        onClose={onClose}
        onConfirm={jest.fn()}
        title="Deleting"
        message="Working"
      />,
    );
    const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Spinner is decorative', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Skeleton is decorative', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Badge renders the requested variant and size', () => {
    const { container } = render(
      <Badge variant="error" size="sm">
        Down
      </Badge>,
    );
    const cls = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(cls).toContain('bg-error/10');
    expect(cls).toContain('text-error');
    expect(cls).toContain('text-xs');
  });
});

describe('StatusDot', () => {
  it.each(['active', 'idle', 'warning', 'error', 'disabled'] as const)(
    'maps %s to its semantic colour',
    (status) => {
      const { container } = render(<StatusDot status={status} />);
      const dot = container.querySelector('span > span:last-of-type') as HTMLElement;
      const expected: Record<typeof status, string> = {
        active: 'bg-success',
        idle: 'bg-primary',
        warning: 'bg-warning',
        error: 'bg-error',
        disabled: 'bg-text-dim',
      };
      expect(dot.className.split(/\s+/)).toContain(expected[status]);
    },
  );

  it('exposes an accessible label only when one is provided', () => {
    const { container, rerender } = render(<StatusDot status="error" />);
    expect(container.textContent).toBe('');
    rerender(<StatusDot status="error" label="Failed" />);
    expect(container.querySelector('.sr-only')?.textContent).toBe('Failed');
  });

  it('renders a pulse layer that is hidden from assistive tech', () => {
    const { container } = render(<StatusDot status="active" pulse />);
    expect(container.querySelector('.animate-ping')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('navigation', () => {
  it('Breadcrumb marks the last crumb as the current page', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Keys' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual(['Home', 'Settings']);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Keys');
    for (const link of links) {
      const cls = link.className.split(/\s+/);
      expect(cls).toContain('min-h-6');
      expect(cls).toContain('min-w-6');
    }
  });

  it('Pagination disables the edges and steps through pages', () => {
    const onPageChange = jest.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />);
    expect(
      (screen.getByRole('button', { name: 'Previous Page' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next Page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('Pagination renders a record range when totals are known', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalRecords={42}
        pageSize={10}
        onPageChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/Showing/).textContent).toContain('11 to 20 of 42 results');
  });

  it('Pagination renders nothing for a single page with no records', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('layout primitives', () => {
  it('Box renders the requested element', () => {
    const { container } = render(
      <Box as="section" data-testid="box">
        body
      </Box>,
    );
    expect(container.querySelector('section')?.textContent).toBe('body');
  });

  it('Stack maps direction, gap and justify onto flex classes', () => {
    const { container } = render(
      <Stack direction="row" gap="6" align="center" justify="between" wrap>
        <span>a</span>
      </Stack>,
    );
    const cls = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(cls).toEqual(
      expect.arrayContaining([
        'flex',
        'flex-row',
        'gap-6',
        'items-center',
        'justify-between',
        'flex-wrap',
      ]),
    );
  });

  it('Grid maps columns and gap', () => {
    const { container } = render(
      <Grid columns={3} gap="2">
        <span>a</span>
      </Grid>,
    );
    const cls = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(cls).toContain('grid');
    expect(cls).toContain('lg:grid-cols-3');
    expect(cls).toContain('gap-2');
  });

  it('Text honours size, weight, color, tabular and truncate', () => {
    const { container } = render(
      <Text size="lg" weight="semibold" color="danger" tabular truncate>
        1,204
      </Text>,
    );
    const cls = (container.firstElementChild as HTMLElement).className.split(/\s+/);
    expect(cls).toEqual(
      expect.arrayContaining([
        'text-lg',
        'leading-7',
        'font-semibold',
        'text-error',
        'tabular-nums',
        'truncate',
      ]),
    );
  });

  it('Heading picks a size from its level unless told otherwise', () => {
    const { container, rerender } = render(<Heading level={1}>Title</Heading>);
    const h1 = container.querySelector('h1') as HTMLElement;
    expect(h1.className.split(/\s+/)).toContain('text-3xl');
    rerender(
      <Heading level={1} size="sm" color="muted" weight="bold">
        Title
      </Heading>,
    );
    const cls = (container.querySelector('h1') as HTMLElement).className.split(/\s+/);
    expect(cls).toContain('text-base');
    expect(cls).toContain('text-text-muted');
    expect(cls).toContain('font-bold');
  });

  it.each(['horizontal', 'vertical'] as const)('Divider is a %s separator', (orientation) => {
    render(<Divider orientation={orientation} />);
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe(orientation);
  });

  it('Panel composes header, body and footer slots', () => {
    const { container } = render(
      <Panel header={<span>Head</span>} footer={<span>Foot</span>} padding="lg">
        Body
      </Panel>,
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('Head')).toBeLessThan(text.indexOf('Body'));
    expect(text.indexOf('Body')).toBeLessThan(text.indexOf('Foot'));
    expect(container.querySelector('.p-6')).not.toBeNull();
  });

  it('ButtonGroup is a labelled group and supports attached styling', () => {
    const { rerender } = render(
      <ButtonGroup aria-label="Alignment">
        <Button>Left</Button>
      </ButtonGroup>,
    );
    expect(screen.getByRole('group', { name: 'Alignment' }).className).toContain('gap-2');
    rerender(
      <ButtonGroup attached aria-label="Alignment">
        <Button>Left</Button>
      </ButtonGroup>,
    );
    expect(screen.getByRole('group', { name: 'Alignment' }).className).toContain('rounded-l-md');
  });
});

describe('AI and memory surfaces', () => {
  it('AIMessage labels the speaker and renders citations', () => {
    const { container } = render(
      <AIMessage
        role="agent"
        agentName="Career Agent"
        confidence={0.92}
        latencyMs={120}
        timestamp="09:41"
        citations={[{ title: 'Postgres docs', uri: 'https://example.com' }]}
      >
        Found 12 roles.
      </AIMessage>,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Career Agent');
    expect(text).toContain('Found 12 roles.');
    expect(text).toContain('92%');
    expect(text).toContain('120ms');
    expect(screen.getByRole('button', { name: /\[1\]/ })).not.toBeNull();
  });

  it('AIMessage attributes user turns to "You" and hides the avatar from AT', () => {
    const { container } = render(<AIMessage role="user">Hello</AIMessage>);
    expect(container.textContent).toContain('You');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('ConfidenceIndicator normalises 0-1 and 0-100 scores and labels the band', () => {
    const { container, rerender } = render(<ConfidenceIndicator score={0.42} />);
    expect(container.textContent).toContain('42%');
    expect(container.textContent).toContain('Needs verification');
    rerender(<ConfidenceIndicator score={0.9} showLabel={false} />);
    expect(container.textContent).toContain('90%');
    expect(container.textContent).not.toContain('High confidence');
    rerender(<ConfidenceIndicator score={77} />);
    expect(container.textContent).toContain('77%');
    expect(container.textContent).toContain('Moderate confidence');
  });

  it('AgentStatus shows the status word and optional metrics', () => {
    const { container, rerender } = render(<AgentStatus name="Scout" status="waiting_approval" />);
    expect(container.textContent).toContain('waiting approval');
    rerender(
      <AgentStatus name="Scout" status="running" duration="4s" cost="$0.02" model="gemma4" />,
    );
    expect(container.textContent).toContain('4s');
    expect(container.textContent).toContain('$0.02');
    expect(container.textContent).toContain('gemma4');
  });

  it('AgentProposal approves, rejects and inspects', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    const onInspect = jest.fn();
    render(
      <AgentProposal
        id="p-1"
        agentName="Scout"
        title="Send 12 applications"
        description="Applies to matched roles"
        impactLevel="high"
        isReversible={false}
        onApprove={onApprove}
        onReject={onReject}
        onInspect={onInspect}
      />,
    );
    expect(screen.getByText('high impact')).not.toBeNull();
    expect(screen.getByText(/Irreversible/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Telemetry' }));
    expect(onInspect).toHaveBeenCalledWith('p-1');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(onReject).toHaveBeenCalledWith('p-1');
    fireEvent.click(screen.getByRole('button', { name: 'Authorize & Execute' }));
    expect(onApprove).toHaveBeenCalledWith('p-1');
  });

  it('AgentRun summarises the run and lists every step', () => {
    const { container } = render(
      <AgentRun
        id="abcdef123456"
        agentName="Scout"
        trigger="user.request"
        startTime="09:41"
        status="failed"
        totalDuration="1.2s"
        steps={[
          { id: 's1', name: 'search', type: 'tool', status: 'completed', durationMs: 12 },
          { id: 's2', name: 'rank', type: 'llm', status: 'failed', durationMs: 900 },
        ]}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('#abcdef12');
    expect(text).toContain('failed');
    expect(text).toContain('search');
    expect(text).toContain('(tool)');
    expect(text).toContain('12ms');
    expect(text).toContain('rank');
    expect(text).toContain('900ms');
  });

  it('AgentPermission surfaces the scope and the privilege level', () => {
    const { container } = render(
      <AgentPermission
        scope="connector.mcp.execute"
        level="execute"
        description="Runs MCP tools"
      />,
    );
    expect(container.textContent).toContain('connector.mcp.execute');
    expect(container.textContent).toContain('[execute]');
    expect(container.firstElementChild?.getAttribute('title')).toBe('Runs MCP tools');
  });

  it('AIInsight renders the recommendation and fires its action', () => {
    const onAction = jest.fn();
    render(
      <AIInsight
        title="Tailor your resume"
        description="Keyword gap detected"
        recommendation="Add Kubernetes"
        actionText="Apply"
        onAction={onAction}
        confidence={0.81}
      />,
    );
    expect(screen.getByText('Add Kubernetes')).not.toBeNull();
    expect(screen.getByText('81% match')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Apply/ }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('ChatComposer submits on Enter but not on Shift+Enter', () => {
    const onSubmit = jest.fn();
    const { rerender } = render(
      <ChatComposer value="hello" onChange={jest.fn()} onSubmit={onSubmit} />,
    );
    const box = screen.getByRole('textbox', { name: 'Message prompt input' });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(<ChatComposer value="   " onChange={jest.fn()} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message prompt input' }), {
      key: 'Enter',
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('ChatComposer disables submit while loading and exposes the send label', () => {
    render(<ChatComposer value="hi" onChange={jest.fn()} onSubmit={jest.fn()} loading />);
    const send = screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
  });

  it('MemoryCard edits, deletes and links its evidence count', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const { container } = render(
      <MemoryCard
        id="m-1"
        content="Prefers remote roles"
        confidence={0.8}
        source="chat"
        timestamp="09:41"
        entityCount={3}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    expect(container.textContent).toContain('3 linked entities');
    fireEvent.click(screen.getByRole('button', { name: 'Edit memory' }));
    expect(onEdit).toHaveBeenCalledWith('m-1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete memory' }));
    expect(onDelete).toHaveBeenCalledWith('m-1');
  });

  it('MemoryEntity is disabled when no handler is supplied', () => {
    const onClick = jest.fn();
    const { rerender } = render(<MemoryEntity name="Ada" type="person" />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    rerender(<MemoryEntity name="Ada" type="person" count={2} onClick={onClick} />);
    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('(2)');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('MemoryEvidence only links the source when a uri is provided', () => {
    const { container, rerender } = render(
      <MemoryEvidence sourceTitle="Spec" extractedAt="09:41" snippet="Latency budget" />,
    );
    expect(container.querySelector('a')).toBeNull();
    rerender(
      <MemoryEvidence
        sourceTitle="Spec"
        sourceUri="https://example.com/spec"
        extractedAt="09:41"
        snippet="Latency budget"
        highlight="p99"
      />,
    );
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://example.com/spec');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(container.textContent).toContain('p99');
  });

  it('MemoryRelationship renders the triple and an optional confidence', () => {
    const { container } = render(
      <MemoryRelationship source="Ada" relation="works_at" target="Acme" confidence={0.9} />,
    );
    expect(container.textContent).toContain('Ada');
    expect(container.textContent).toContain('works_at');
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('(90%)');
  });

  it('MemoryTimeline hides the decorative separator bullet', () => {
    const { container } = render(
      <MemoryTimeline
        items={[
          {
            id: '1',
            action: 'ingested',
            title: 'Ingested spec',
            source: 'drive',
            timestamp: '09:41',
          },
        ]}
      />,
    );
    const bullet = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(bullet.textContent).toBe('•');
  });
});

describe('shared 24px pattern is applied to the remaining controls', () => {
  it('AgentProposal inspect link declares the minimum', () => {
    render(
      <AgentProposal
        id="p"
        agentName="a"
        title="t"
        description="d"
        onApprove={jest.fn()}
        onReject={jest.fn()}
        onInspect={jest.fn()}
      />,
    );
    const cls = screen.getByRole('button', { name: 'Inspect Telemetry' }).className.split(/\s+/);
    expect(cls).toContain('min-h-6');
    expect(cls).toContain('min-w-6');
  });

  it('AIInsight action declares the minimum', () => {
    render(<AIInsight title="t" description="d" actionText="Apply" onAction={jest.fn()} />);
    const cls = screen.getByRole('button', { name: /Apply/ }).className.split(/\s+/);
    expect(cls).toContain('min-h-6');
    expect(cls).toContain('min-w-6');
  });

  it('MemoryCard edit and delete declare the minimum', () => {
    render(
      <MemoryCard
        id="m"
        content="c"
        confidence={0.5}
        source="s"
        timestamp="t"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    for (const name of ['Edit memory', 'Delete memory']) {
      const cls = screen.getByRole('button', { name }).className.split(/\s+/);
      expect(cls).toEqual(expect.arrayContaining(MIN_TOUCH_TARGET.split(/\s+/)));
    }
  });

  it('SourceCitation trigger declares the minimum', () => {
    render(<SourceCitation index={1} sourceTitle="Doc" />);
    const cls = screen.getByRole('button').className.split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(MIN_TOUCH_TARGET.split(/\s+/)));
  });

  it('FilterBar clear-all declares the minimum', () => {
    render(
      <FilterBar
        searchQuery=""
        onSearchChange={jest.fn()}
        activeTags={[{ id: 'a', label: 'Alpha' }]}
        onClearAll={jest.fn()}
      />,
    );
    const cls = screen.getByRole('button', { name: 'Clear all' }).className.split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(MIN_TOUCH_TARGET.split(/\s+/)));
  });
});
