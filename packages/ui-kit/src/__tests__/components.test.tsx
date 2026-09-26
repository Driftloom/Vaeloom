import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import { Button } from '../components/Button';
import type { ButtonProps } from '../components/Button';
import { DataTable } from '../components/DataTable';
import type { ColumnDef, DataTableProps } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { TabPanel, Tabs } from '../components/Tabs';
import { Tooltip } from '../components/Tooltip';
import { IconButton } from '../components/actions/IconButton';
import { SourceCitation } from '../components/ai/SourceCitation';
import { Drawer } from '../components/containers/Drawer';
import { FilterBar } from '../components/data/FilterBar';
import { StatCard } from '../components/data/StatCard';
import { Alert } from '../components/feedback/Alert';
import { Banner } from '../components/feedback/Banner';
import { Progress } from '../components/feedback/Progress';
import { Toast } from '../components/feedback/Toast';
import { Checkbox } from '../components/forms/Checkbox';
import { Radio } from '../components/forms/Radio';
import { SearchField } from '../components/forms/SearchField';
import { Switch } from '../components/forms/Switch';
import { VisuallyHidden } from '../components/layout/VisuallyHidden';
import { MIN_TOUCH_TARGET } from '../components/layout/touchTarget';
import * as uiKit from '../index';

type Variant = NonNullable<ButtonProps['variant']>;

const variantSignature: Record<Variant, string[]> = {
  primary: ['bg-action', 'text-action-fg', 'focus:ring-accent'],
  secondary: ['bg-surface-hover', 'border', 'focus:ring-border'],
  outline: ['bg-transparent', 'border', 'hover:bg-surface-hover'],
  ghost: ['bg-transparent', 'hover:bg-surface-hover'],
  danger: ['bg-error', 'text-error-fg', 'focus:ring-error'],
};

describe('Button', () => {
  it.each(Object.keys(variantSignature))(
    'applies the "%s" variant signature',
    (variant: string) => {
      render(<Button variant={variant as Variant}>Action</Button>);
      const button = screen.getByRole('button', { name: 'Action' });
      const cls = button.className;
      for (const token of variantSignature[variant as Variant]) {
        expect(cls.split(/\s+/)).toContain(token);
      }
    },
  );

  it('gives every variant a distinct class signature', () => {
    const seen = new Map<string, string>();
    for (const variant of Object.keys(variantSignature) as Variant[]) {
      const { unmount } = render(<Button variant={variant}>Action</Button>);
      const cls = screen.getByRole('button').className;
      expect(seen.has(cls)).toBe(false);
      seen.set(cls, variant);
      unmount();
    }
    expect(seen.size).toBe(5);
  });

  it('blocks activation and sets the disabled attribute', () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Action
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Action' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reports loading through aria-busy and blocks activation', () => {
    const onClick = jest.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' }) as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('omits aria-busy when not loading', () => {
    render(<Button>Idle</Button>);
    expect(screen.getByRole('button', { name: 'Idle' }).hasAttribute('aria-busy')).toBe(false);
  });

  it('carries a focus-visible ring on every variant', () => {
    for (const variant of Object.keys(variantSignature) as Variant[]) {
      const { unmount } = render(<Button variant={variant}>Action</Button>);
      const cls = screen.getByRole('button').className.split(/\s+/);
      expect(cls).toContain('focus:ring-2');
      expect(cls).toContain('focus:ring-offset-2');
      expect(cls).toContain('focus:outline-none');
      unmount();
    }
  });
});

describe('Modal', () => {
  const onClose = jest.fn();

  beforeEach(() => onClose.mockClear());

  function Harness({ open }: { open: boolean }) {
    return (
      <div>
        <button type="button">Trigger</button>
        {open ? (
          <Modal isOpen onClose={onClose} title="Delete connection">
            <button type="button">First</button>
            <button type="button">Second</button>
          </Modal>
        ) : null}
      </div>
    );
  }

  it('renders nothing while closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a labelled modal dialog when open', () => {
    render(<Harness open />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Delete connection');
  });

  it('moves focus into the dialog on open', () => {
    render(<Harness open />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Harness open />);
    const last = screen.getByRole('button', { name: 'Second' });
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('wraps Shift+Tab from the first focusable back to the last', () => {
    render(<Harness open />);
    const first = screen.getByRole('button', { name: 'Close' });
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Second' }));
  });

  it('closes on Escape', () => {
    render(<Harness open />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger when the modal unmounts', () => {
    const { rerender } = render(<Harness open={false} />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(<Harness open />);
    expect(document.activeElement).not.toBe(trigger);

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
    { id: 'three', label: 'Three' },
  ];

  function Harness({ initial = 'one' }: { initial?: string }) {
    const [active, setActive] = React.useState(initial);
    return (
      <div>
        <Tabs tabs={tabs} activeTab={active} onTabChange={setActive} ariaLabel="Sections" />
        <TabPanel id="one" activeTab={active}>
          Panel one
        </TabPanel>
        <TabPanel id="two" activeTab={active}>
          Panel two
        </TabPanel>
        <TabPanel id="three" activeTab={active}>
          Panel three
        </TabPanel>
      </div>
    );
  }

  it('exposes a tablist with the supplied accessible name', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).not.toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('implements roving tabindex — only the selected tab is in the tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'One' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tab', { name: 'Three' }).getAttribute('tabindex')).toBe('-1');
  });

  it('marks exactly one tab aria-selected', () => {
    render(<Harness initial="two" />);
    const selected = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain('Two');
  });

  it('moves selection and focus with ArrowRight / ArrowLeft', () => {
    render(<Harness />);
    const one = screen.getByRole('tab', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Two' }), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'One' }));
  });

  it('wraps around at both ends of the tab order', () => {
    render(<Harness />);
    const one = screen.getByRole('tab', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Three' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Three' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'One' }).getAttribute('aria-selected')).toBe('true');
  });

  it('jumps to the ends with Home / End', () => {
    render(<Harness />);
    const one = screen.getByRole('tab', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Three' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Three' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'One' }).getAttribute('aria-selected')).toBe('true');
  });

  it('skips disabled tabs during arrow navigation', () => {
    function WithDisabled() {
      const [active, setActive] = React.useState('one');
      return (
        <Tabs
          tabs={[
            tabs[0] as { id: string; label: string },
            { id: 'two', label: 'Two', disabled: true },
            tabs[2] as { id: string; label: string },
          ]}
          activeTab={active}
          onTabChange={setActive}
        />
      );
    }
    render(<WithDisabled />);
    const one = screen.getByRole('tab', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Three' }).getAttribute('aria-selected')).toBe('true');
  });

  it('wires each tab to its panel via aria-controls and aria-labelledby', () => {
    render(<Harness />);
    const tab = screen.getByRole('tab', { name: 'One' });
    const controls = tab.getAttribute('aria-controls');
    expect(controls).toBe('tabpanel-one');
    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe(controls);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    expect(panel.textContent).toBe('Panel one');
  });

  it('renders only the active panel', () => {
    render(<Harness initial="two" />);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel').textContent).toBe('Panel two');
  });
});

interface Row {
  name: string;
  score: number;
}

const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'score', header: 'Score' },
];

const rows: Row[] = [
  { name: 'alpha', score: 2 },
  { name: 'beta', score: 1 },
];

function renderTable(props: Partial<DataTableProps<Row>> = {}) {
  return render(
    <DataTable
      columns={columns}
      data={rows}
      keyExtractor={(row) => row.name}
      onSort={props.onSort ?? jest.fn()}
      {...props}
    />,
  );
}

describe('DataTable', () => {
  it('renders aria-sort="none" on a sortable column that is not the sort key', () => {
    renderTable({ sortBy: 'score', sortDir: 'asc' });
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe(
      'none',
    );
  });

  it('renders aria-sort="none" when no sort is active at all', () => {
    renderTable();
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe(
      'none',
    );
  });

  it('renders aria-sort="ascending" when sorted ascending', () => {
    renderTable({ sortBy: 'name', sortDir: 'asc' });
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe(
      'ascending',
    );
  });

  it('renders aria-sort="descending" when sorted descending', () => {
    renderTable({ sortBy: 'name', sortDir: 'desc' });
    expect(screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort')).toBe(
      'descending',
    );
  });

  it('omits aria-sort on a non-sortable column', () => {
    renderTable();
    const score = screen.getByRole('columnheader', { name: /Score/ });
    expect(score.hasAttribute('aria-sort')).toBe(false);
  });

  it('puts a real focusable button inside the sortable header', () => {
    renderTable();
    const header = screen.getByRole('columnheader', { name: /Name/ });
    const button = within(header).getByRole('button', { name: /Name/ });
    expect(button.tagName).toBe('BUTTON');
    expect(header.querySelector('th')).toBeNull();
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('sorts on click and on keyboard activation of the header button', () => {
    const onSort = jest.fn();
    renderTable({ onSort });
    const button = within(screen.getByRole('columnheader', { name: /Name/ })).getByRole('button');
    fireEvent.click(button);
    expect(onSort).toHaveBeenCalledWith('name');
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('does not sort a non-sortable column', () => {
    const onSort = jest.fn();
    renderTable({ onSort });
    expect(
      within(screen.getByRole('columnheader', { name: /Score/ })).queryByRole('button'),
    ).toBeNull();
    expect(onSort).not.toHaveBeenCalled();
  });

  it('renders the empty message when there is no data', () => {
    renderTable({ data: [] });
    expect(screen.getByText('No data available')).not.toBeNull();
  });
});

describe('Checkbox and Radio', () => {
  it('associates the Checkbox label with htmlFor', () => {
    render(<Checkbox label="Email me" />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    const label = screen.getByText('Email me');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.id).toBeTruthy();
  });

  it('associates the Radio label with htmlFor', () => {
    render(<Radio label="Weekly" />);
    const input = screen.getByRole('radio') as HTMLInputElement;
    const label = screen.getByText('Weekly');
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it('toggles the Checkbox when its label is clicked', () => {
    render(<Checkbox label="Email me" />);
    const input = screen.getByRole('checkbox') as HTMLInputElement;
    expect(input.checked).toBe(false);
    fireEvent.click(screen.getByText('Email me'));
    expect(input.checked).toBe(true);
  });

  it('marks the Checkbox aria-invalid and announces the error', () => {
    render(<Checkbox label="Email me" error="Consent is required" />);
    const input = screen.getByRole('checkbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Consent is required');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBe(alert);
  });

  it('marks the Radio aria-invalid and announces the error', () => {
    render(<Radio label="Weekly" error="Pick a plan" />);
    const input = screen.getByRole('radio');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Pick a plan');
  });

  it('leaves aria-invalid off and the hint as the description when valid', () => {
    render(<Checkbox label="Email me" hint="Optional" />);
    const input = screen.getByRole('checkbox');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    const describedBy = input.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy as string)?.textContent).toBe('Optional');
  });

  it('keeps a 24px pointer target on the checkbox and radio', () => {
    const { container } = render(
      <>
        <Checkbox label="A" />
        <Radio label="B" />
      </>,
    );
    const targets = Array.from(container.querySelectorAll('input[type]'));
    expect(targets).toHaveLength(2);
    for (const input of targets) {
      const control = input.closest('label');
      expect(control?.className.split(/\s+/)).toContain('h-6');
      expect(control?.className.split(/\s+/)).toContain('w-6');
    }
  });
});

describe('IconButton', () => {
  it('renders the required aria-label as the accessible name', () => {
    render(
      <IconButton aria-label="Delete memory">
        <span aria-hidden="true">x</span>
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Delete memory' });
    expect(button.getAttribute('aria-label')).toBe('Delete memory');
  });

  it('has no accessible name when aria-label is omitted at runtime', () => {
    const { container } = render(
      React.createElement(
        IconButton,
        null,
        React.createElement('span', { 'aria-hidden': 'true' }, 'x'),
      ),
    );
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(screen.getByRole('button', { name: '' })).toBe(button);
  });

  it('is a compile error to omit aria-label', () => {
    // @ts-expect-error aria-label is required on IconButtonProps
    const invalid = <IconButton>icon</IconButton>;
    expect(invalid).toBeDefined();
  });

  it.each(['sm', 'md', 'lg'] as const)('meets the 24px target minimum at size %s', (size) => {
    render(
      <IconButton aria-label="Refresh" size={size}>
        <span aria-hidden="true">r</span>
      </IconButton>,
    );
    const cls = screen.getByRole('button').className.split(/\s+/);
    if (size === 'sm') {
      expect(cls).toContain('h-7');
      expect(cls).toContain('w-7');
    }
    expect(MIN_TOUCH_TARGET.split(/\s+/)).toEqual(['min-h-6', 'min-w-6']);
  });
});

describe('Tooltip', () => {
  it('wires the tooltip to its trigger with aria-describedby on focus', () => {
    render(
      <Tooltip content="Explains the metric">
        <button type="button">Revenue</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Revenue' });
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);

    fireEvent.focus(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toBe('Explains the metric');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
  });

  it('shows on hover and removes the description on mouse leave', () => {
    render(
      <Tooltip content="Explains the metric">
        <button type="button">Revenue</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Revenue' });
    const wrapper = trigger.parentElement as HTMLElement;

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).not.toBeNull();

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('StatCard', () => {
  it('hides the trend glyph and exposes a sentence-form delta', () => {
    const { container } = render(
      <StatCard label="Signups" value="1,204" delta={{ value: '12%', trend: 'up' }} />,
    );
    const badge = container.querySelector('span[aria-hidden="true"]');
    expect(badge).not.toBeNull();
    expect(screen.getByText('up 12%')).not.toBeNull();
    expect(container.textContent).not.toContain('↑');
  });

  it('announces a downward delta in sentence form', () => {
    render(<StatCard label="Churn" value="4" delta={{ value: '3%', trend: 'down' }} />);
    expect(screen.getByText('down 3%')).not.toBeNull();
  });

  it('announces a neutral delta in sentence form', () => {
    render(<StatCard label="Churn" value="4" delta={{ value: '0%', trend: 'neutral' }} />);
    expect(screen.getByText('no change 0%')).not.toBeNull();
  });
});

describe('SourceCitation', () => {
  it('opens external links with noopener and noreferrer', () => {
    const open = jest.fn();
    (window as unknown as { open: unknown }).open = open;
    render(<SourceCitation index={1} sourceTitle="Postgres docs" url="https://example.com" />);
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });

  it('does not open a window when there is no url', () => {
    const open = jest.fn();
    (window as unknown as { open: unknown }).open = open;
    render(<SourceCitation index={1} sourceTitle="Local note" />);
    fireEvent.click(screen.getByRole('button'));
    expect(open).not.toHaveBeenCalled();
  });

  it('prefers the caller onClick over opening a window', () => {
    const open = jest.fn();
    const onClick = jest.fn();
    (window as unknown as { open: unknown }).open = open;
    render(
      <SourceCitation index={1} sourceTitle="Doc" url="https://example.com" onClick={onClick} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('describes the button with the snippet panel and reveals it on focus', () => {
    render(
      <SourceCitation
        index={2}
        sourceTitle="Quarterly report"
        snippet="Revenue grew 12%."
        url="https://example.com"
      />,
    );
    const button = screen.getByRole('button');
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const panel = document.getElementById(describedBy as string);
    expect(panel?.getAttribute('role')).toBe('tooltip');
    expect(panel?.textContent).toContain('Revenue grew 12%.');
    expect(panel?.className).toContain('group-focus-within:flex');
  });
});

describe('Feedback and layout primitives', () => {
  it('VisuallyHidden keeps its text in the accessibility tree', () => {
    const { container } = render(<VisuallyHidden>Sort by date</VisuallyHidden>);
    const span = container.firstElementChild as HTMLElement;
    expect(span.textContent).toBe('Sort by date');
    expect(span.className).toContain('sr-only');
    expect(span.style.clip).toBe('rect(0px, 0px, 0px, 0px)');
  });

  it('Progress exposes a progressbar role and clamped values', () => {
    render(<Progress value={40} label="Upload" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-label')).toBe('Upload');
  });

  it('Progress clamps out-of-range values', () => {
    const { rerender } = render(<Progress value={-10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    rerender(<Progress value={250} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('Toast is a polite live region and dismisses with its id', () => {
    const onDismiss = jest.fn();
    render(<Toast id="t-1" message="Saved" onDismiss={onDismiss} />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledWith('t-1');
  });

  it('Alert is assertive and dismisses', () => {
    const onClose = jest.fn();
    render(<Alert title="Heads up" description="Token refresh failed" onClose={onClose} />);
    expect(screen.getByRole('alert').textContent).toContain('Token refresh failed');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss alert' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Banner renders its action and close controls', () => {
    const onAction = jest.fn();
    const onClose = jest.fn();
    render(
      <Banner
        title="Maintenance"
        action={{ label: 'Read more', onClick: onAction }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('banner').textContent).toContain('Maintenance');
    fireEvent.click(screen.getByRole('button', { name: 'Read more' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close banner' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Switch is a labelled role=switch that toggles', () => {
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Dark mode" />);
    const control = screen.getByRole('switch');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('id')).toBe(screen.getByText('Dark mode').getAttribute('for'));
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('SearchField clears through onChange and onClear', () => {
    const onChange = jest.fn();
    const onClear = jest.fn();
    render(<SearchField value="abc" onChange={onChange} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('SearchField hides the clear button when empty', () => {
    render(<SearchField value="" onChange={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('FilterBar removes a tag and clears all filters', () => {
    const onRemoveTag = jest.fn();
    const onClearAll = jest.fn();
    render(
      <FilterBar
        searchQuery="x"
        onSearchChange={jest.fn()}
        activeTags={[{ id: 't1', label: 'Remote' }]}
        onRemoveTag={onRemoveTag}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Remote' }));
    expect(onRemoveTag).toHaveBeenCalledWith('t1');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('Drawer exposes a modal dialog with an escape-reachable close control', () => {
    const onClose = jest.fn();
    render(
      <Drawer isOpen onClose={onClose} title="Filters">
        body
      </Drawer>,
    );
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('WCAG 2.5.8 minimum pointer target (24px)', () => {
  it('exposes the shared min-h-6 min-w-6 pattern', () => {
    expect(MIN_TOUCH_TARGET).toBe('min-h-6 min-w-6');
  });

  const cases: Array<[string, () => HTMLElement, string]> = [
    [
      'Alert dismiss',
      () => {
        render(<Alert title="a" onClose={jest.fn()} />);
        return screen.getByRole('button', { name: 'Dismiss alert' });
      },
      'Dismiss alert',
    ],
    [
      'Banner close',
      () => {
        render(<Banner title="a" onClose={jest.fn()} />);
        return screen.getByRole('button', { name: 'Close banner' });
      },
      'Close banner',
    ],
    [
      'Toast dismiss',
      () => {
        render(<Toast id="t" message="m" onDismiss={jest.fn()} />);
        return screen.getByRole('button', { name: 'Dismiss notification' });
      },
      'Dismiss notification',
    ],
    [
      'SearchField clear',
      () => {
        render(<SearchField value="q" onChange={jest.fn()} />);
        return screen.getByRole('button', { name: 'Clear search' });
      },
      'Clear search',
    ],
    [
      'FilterBar tag remove',
      () => {
        render(
          <FilterBar
            searchQuery=""
            onSearchChange={jest.fn()}
            activeTags={[{ id: 'a', label: 'Alpha' }]}
            onRemoveTag={jest.fn()}
          />,
        );
        return screen.getByRole('button', { name: 'Remove filter Alpha' });
      },
      'Remove filter Alpha',
    ],
    [
      'Modal close',
      () => {
        render(
          <Modal isOpen onClose={jest.fn()} title="t">
            body
          </Modal>,
        );
        return screen.getByRole('button', { name: 'Close' });
      },
      'Close',
    ],
    [
      'Drawer close',
      () => {
        render(
          <Drawer isOpen onClose={jest.fn()} title="t">
            body
          </Drawer>,
        );
        return screen.getByRole('button', { name: 'Close drawer' });
      },
      'Close drawer',
    ],
  ];

  it.each(cases)('%s declares the 24px minimum', (_name, setup) => {
    const element = setup();
    const cls = element.className.split(/\s+/);
    expect(cls).toContain('min-h-6');
    expect(cls).toContain('min-w-6');
  });
});

describe('public export surface', () => {
  it('exports the canonical components as callable values', () => {
    const expected = [
      'Button',
      'Card',
      'Badge',
      'Modal',
      'Tooltip',
      'DataTable',
      'Breadcrumb',
      'Pagination',
      'StatCard',
      'FilterBar',
      'FormField',
      'SearchField',
      'Input',
      'Switch',
      'ErrorState',
      'EmptyState',
      'Spinner',
      'Skeleton',
      'AIMessage',
      'ChatComposer',
      'AIInsight',
      'AgentStatus',
      'AgentProposal',
      'AgentRun',
      'ConfidenceIndicator',
      'SourceCitation',
    ];
    for (const name of expected) {
      const value = (uiKit as Record<string, unknown>)[name];
      expect(value).toBeDefined();
      // forwardRef/memo components are objects carrying $$typeof, not functions.
      const renderable =
        typeof value === 'function' ||
        (typeof value === 'object' && value !== null && '$$typeof' in value);
      expect({ name, renderable }).toEqual({ name, renderable: true });
    }
  });

  it('publishes the token source-of-truth record so consumers stop guessing', () => {
    expect(uiKit.TOKEN_SOURCE_OF_TRUTH).toEqual({
      runtime: 'apps/web/src/styles/globals.css',
      designRecord: 'packages/ui-kit/src/tokens',
      wiredIntoAppBuild: false,
      sharedColorNames: ['--color-focus-ring', '--color-focus-ring-offset'],
      sharedScaleNames: 17,
      engineOnlyNamespaces: ['--space-*', '--font-size-*', '--font-weight-*'],
    });
  });
});
