/**
 * WCAG 2.2 AA contract for the components the app actually ships.
 *
 * The previous version of this file rendered a `SmokeShell` it defined itself,
 * imported no application code, and wrapped `require('jest-axe')` in a
 * try/catch — jest-axe is not a dependency, so the catch always fired and
 * `toHaveNoViolations()` was dead. Every assertion below runs unconditionally
 * against real `@vaeloom/ui-kit` components and a real `apps/web` component,
 * and there is no branch that can silently skip a check.
 *
 * These are exact DOM/ARIA contracts (name, role, state, association,
 * keyboard operability, focus management). The engine-level axe scan lives in
 * e2e/quality.spec.ts, which runs real axe against real pages.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  Alert,
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  Input,
  Modal,
  Switch,
  Tabs,
  TabPanel,
  VisuallyHidden,
} from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { ApprovalCard } from '@/components/shared/ApprovalCard';

describe('ui-kit Button', () => {
  it('exposes a real button role with an accessible name from its text', () => {
    render(<Button>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('still honours an explicit type so submit buttons keep working', () => {
    render(<Button type="submit">Sign in</Button>);
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit');
  });

  it('derives its accessible name from aria-label when the text is icon-only', () => {
    render(<Button aria-label="Dismiss notification">×</Button>);
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('announces the loading state and blocks activation', () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Uploading
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Uploading/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is reachable and operable from the keyboard', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Run agent</Button>);
    const button = screen.getByRole('button', { name: 'Run agent' });
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ui-kit Input', () => {
  it('associates the visible label with the control', () => {
    render(<Input label="Workspace name" />);
    const input = screen.getByLabelText('Workspace name');
    expect(input).toHaveAttribute('id', 'workspace-name');
  });

  it('wires an error to the control with aria-invalid and a described-by alert', () => {
    render(<Input label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBe('email-error');
    const alert = document.getElementById(describedBy as string);
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Enter a valid email');
  });
});

describe('ui-kit Checkbox', () => {
  it('gives the control its accessible name from the wrapped label', () => {
    render(<Checkbox label="Require approval for destructive actions" />);
    const box = screen.getByRole('checkbox', {
      name: 'Require approval for destructive actions',
    });
    expect(box).toHaveAttribute('type', 'checkbox');
  });

  it('exposes the indeterminate state to assistive tech, not only visually', () => {
    const { rerender } = render(<Checkbox label="Select all" indeterminate />);
    const box = screen.getByRole('checkbox', { name: 'Select all' });
    expect((box as HTMLInputElement).indeterminate).toBe(true);
    rerender(<Checkbox label="Select all" checked />);
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toBeChecked();
  });

  it('associates a validation error with the control and announces it', () => {
    render(<Checkbox label="Accept terms" error="You must accept the terms" />);
    const box = screen.getByRole('checkbox', { name: 'Accept terms' });
    expect(box).toHaveAttribute('aria-invalid', 'true');
    const describedBy = box.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const message = document.getElementById(describedBy as string);
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent('You must accept the terms');
  });

  it('toggles on click', () => {
    const onChange = jest.fn();
    render(<Checkbox label="Notify me" onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Notify me' }));
    expect(onChange).toHaveBeenCalled();
  });
});

describe('ui-kit Switch', () => {
  it('reports the switch role and its state', () => {
    const onChange = jest.fn();
    render(<Switch label="Durable mode" checked={false} onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Durable mode' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects a controlled checked state', () => {
    render(<Switch label="Durable mode" checked onChange={jest.fn()} />);
    expect(screen.getByRole('switch', { name: 'Durable mode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('ui-kit Modal', () => {
  it('is a labelled modal dialog and moves focus inside on open', () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Create New Folder">
        <button type="button">Save</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Create New Folder' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // focus must land inside the dialog, not stay on the document body
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('labels the dialog by its visible title heading', () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Archive documents">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Archive documents' });
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent('Archive documents');
  });

  it('renders nothing at all when closed', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Never shown">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape and via the named close control', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <Modal isOpen onClose={onClose} title="Archive documents">
        <p>body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <Modal isOpen={false} onClose={onClose} title="Archive documents">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ui-kit DataTable', () => {
  interface Row {
    id: string;
    agent: string;
    status: string;
  }
  const columns = [
    { key: 'agent', header: 'Agent' },
    { key: 'status', header: 'Status' },
  ];
  const rows: Row[] = [
    { id: '1', agent: 'orchestrator', status: 'active' },
    { id: '2', agent: 'memory', status: 'idle' },
  ];

  it('renders a real table with column headers that name their column', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />);
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Agent', 'Status']);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 data rows
  });

  it('names every cell by its row and column header', () => {
    render(<DataTable<Row> columns={columns} data={rows} keyExtractor={(r) => r.id} />);
    expect(screen.getByRole('cell', { name: 'orchestrator' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'active' })).toBeInTheDocument();
  });

  it('announces the empty state instead of rendering a headerless table', () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={[]}
        keyExtractor={(r) => r.id}
        emptyMessage="No agents in this workspace"
      />,
    );
    expect(screen.getByText('No agents in this workspace')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });
});

describe('ui-kit Tabs', () => {
  const tabs = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
  ];

  it('exposes a labelled tablist with selection state wired to the panel', () => {
    render(
      <>
        <Tabs tabs={tabs} activeTab="pending" onChange={jest.fn()} ariaLabel="Approval status" />
        <TabPanel id="pending" activeTab="pending">
          <p>pending body</p>
        </TabPanel>
      </>,
    );
    const list = screen.getByRole('tablist', { name: 'Approval status' });
    const [pending, approved] = within(list).getAllByRole('tab');
    expect(pending).toHaveAttribute('aria-selected', 'true');
    expect(approved).toHaveAttribute('aria-selected', 'false');
    expect(pending).toHaveAttribute('aria-controls', 'tabpanel-pending');
    expect(screen.getByRole('tabpanel', { name: 'Pending' })).toHaveTextContent('pending body');
  });

  it('keeps a single tab in the tab order (roving tabindex)', () => {
    render(
      <Tabs tabs={tabs} activeTab="pending" onChange={jest.fn()} ariaLabel="Approval status" />,
    );
    const [pending, approved] = screen.getAllByRole('tab');
    expect(pending).toHaveAttribute('tabindex', '0');
    expect(approved).toHaveAttribute('tabindex', '-1');
  });

  it('moves between tabs with arrow keys', () => {
    const onChange = jest.fn();
    render(
      <Tabs tabs={tabs} activeTab="pending" onChange={onChange} ariaLabel="Approval status" />,
    );
    const [pending] = screen.getAllByRole('tab');
    pending.focus();
    fireEvent.keyDown(pending, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('approved');
  });

  it('renders only the active panel', () => {
    render(
      <>
        <Tabs tabs={tabs} activeTab="pending" onChange={jest.fn()} ariaLabel="Approval status" />
        <TabPanel id="pending" activeTab="pending">
          <p>pending body</p>
        </TabPanel>
        <TabPanel id="approved" activeTab="pending">
          <p>approved body</p>
        </TabPanel>
      </>,
    );
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.queryByText('approved body')).not.toBeInTheDocument();
  });
});

describe('ui-kit Alert', () => {
  it('is a live region so a dynamically inserted alert is announced', () => {
    render(<Alert variant="danger" title="Upload failed" description="File type is blocked" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Upload failed');
    expect(alert).toHaveTextContent('File type is blocked');
  });

  it('names the dismiss control', () => {
    render(<Alert title="Heads up" onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Dismiss alert' })).toBeInTheDocument();
  });
});

describe('ui-kit EmptyState', () => {
  it('renders its heading and body text', () => {
    render(<EmptyState title="No pending approvals" description="Suggestions appear here." />);
    expect(screen.getByText('No pending approvals')).toBeInTheDocument();
    expect(screen.getByText('Suggestions appear here.')).toBeInTheDocument();
  });
});

describe('ui-kit VisuallyHidden', () => {
  it('keeps text in the accessibility tree while hiding it visually', () => {
    render(<VisuallyHidden>Sources:</VisuallyHidden>);
    const hidden = screen.getByText('Sources:');
    expect(hidden).toBeInTheDocument();
    expect(hidden).toHaveClass('sr-only');
  });
});

describe('apps/web PageHeader', () => {
  it('emits exactly one h1 carrying the page title', () => {
    const { container } = render(
      <PageHeader title="Workspace Settings" description="Configure agent governance" />,
    );
    const h1 = container.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent('Workspace Settings');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Workspace Settings' }),
    ).toBeInTheDocument();
  });
});

describe('apps/web ApprovalCard', () => {
  const baseProps = {
    id: 'a11y-1',
    agentName: 'Gmail',
    actionType: 'send-draft',
    description: 'Send draft to recruiter@example.com',
    onApprove: jest.fn(),
    onReject: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('is a named focusable region carrying the decision state', () => {
    render(<ApprovalCard {...baseProps} />);
    const card = screen.getByRole('region', { name: 'Gmail send-draft approval' });
    expect(card).toHaveAttribute('tabindex', '0');
    // Trust UX: proposed must never be presented as executed.
    expect(card).toHaveTextContent('Proposed — not yet executed');
  });

  it('labels the decision buttons by their action', () => {
    render(<ApprovalCard {...baseProps} />);
    expect(screen.getByRole('button', { name: /^Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reject/ })).toBeInTheDocument();
  });

  it('offers keyboard approve/reject without a pointer', () => {
    render(<ApprovalCard {...baseProps} />);
    const card = screen.getByRole('region', { name: 'Gmail send-draft approval' });
    card.focus();
    expect(card).toHaveFocus();
    fireEvent.keyDown(card, { key: 'a' });
    expect(baseProps.onApprove).toHaveBeenCalledWith('a11y-1');
    fireEvent.keyDown(card, { key: 'r' });
    expect(baseProps.onReject).toHaveBeenCalledWith('a11y-1');
  });

  it('removes the decision controls and says so once expired', () => {
    render(<ApprovalCard {...baseProps} expiresAt={new Date(Date.now() - 60_000).toISOString()} />);
    expect(screen.getByText('Expired. No action was taken.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject/ })).not.toBeInTheDocument();
  });
});
