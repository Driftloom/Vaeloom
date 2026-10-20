import React from 'react';

import { render, screen } from '@testing-library/react';

import { Breadcrumb, TabPanel, Tabs, type BreadcrumbItem } from '@vaeloom/ui-kit';

import { CapabilityDetailLayout, MetaRow } from '../CapabilityDetailLayout';

const breadcrumbs: BreadcrumbItem[] = [
  { label: 'Capabilities', href: '/workspace/ws-1/capabilities' },
  { label: 'Tools', href: '/workspace/ws-1/capabilities?category=tools' },
  { label: 'sample_tool', current: true },
];

const contract = (
  <CapabilityDetailLayout
    eyebrow="Tool Capability"
    title="sample_tool"
    description="Inspect contract coverage."
    backHref="/workspace/ws-1/capabilities?category=tools"
    backLabel="Back to Tools"
    breadcrumbs={breadcrumbs}
    meta={<MetaRow label="Suite" value="Memory Graph Suite" />}
    actions={<div>Chat with Agent</div>}
    rail={<div>Rail Controls</div>}
    tabs={
      <Tabs
        ariaLabel="Detail sections"
        size="sm"
        tabs={[
          { id: 'contract', label: 'Contract' },
          { id: 'budget', label: 'Autonomy & Budget' },
        ]}
        activeTab="contract"
      />
    }
    footer={<div>Drawer Footer</div>}
  >
    <TabPanel id="contract" activeTab="contract">
      <div>Contract Panel</div>
    </TabPanel>
  </CapabilityDetailLayout>
);

describe('CapabilityDetailLayout', () => {
  it('renders the canonical header: eyebrow, single h1, description, breadcrumb nav', () => {
    render(contract);
    expect(screen.getByRole('heading', { level: 1, name: 'sample_tool' })).toBeInTheDocument();
    expect(screen.getByText('Tool Capability').className).toContain('eyebrow');
    expect(screen.getByText('Inspect contract coverage.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(
      screen.getByText('sample_tool', { selector: '[aria-current="page"]' }),
    ).toBeInTheDocument();
  });

  it('renders back link with backHref/backLabel inside the rail', () => {
    const { container } = render(contract);
    const back = screen.getByRole('link', { name: /Back to Tools/i });
    expect(back).toHaveAttribute('href', '/workspace/ws-1/capabilities?category=tools');
    expect(container.querySelector('aside')).not.toBeNull();
  });

  it('renders rail, actions and metadata slots in the rail', () => {
    render(contract);
    expect(screen.getByText('Rail Controls')).toBeInTheDocument();
    expect(screen.getByText('Chat with Agent')).toBeInTheDocument();
    expect(screen.getByText('Suite')).toBeInTheDocument();
    expect(screen.getByText('Memory Graph Suite')).toBeInTheDocument();
  });

  it('wires the passed Tabs/TabPanel through (tab -> panel contract)', () => {
    render(contract);
    const tab = screen.getByRole('tab', { name: 'Contract' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveAttribute('aria-controls', 'tabpanel-contract');
    const panel = document.getElementById('tabpanel-contract');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveTextContent('Contract Panel');
  });

  it('renders the footer bar when provided', () => {
    render(contract);
    expect(screen.getByText('Drawer Footer')).toBeInTheDocument();
  });

  it('carries each shell-defining class exactly once', () => {
    const { container } = render(contract);
    const html = container.innerHTML;
    const count = (needle: string) => html.split(needle).length - 1;
    expect(count('w-[350px]')).toBe(1);
    expect(count('border-border-subtle')).toBe(1);
    expect(count('max-w-6xl')).toBe(1);
  });

  it('renders every slot as optional', () => {
    render(
      <CapabilityDetailLayout
        eyebrow="Tool Capability"
        title="sample_tool"
        backHref="/workspace/ws-1/capabilities"
      >
        <div>Only content</div>
      </CapabilityDetailLayout>,
    );
    expect(screen.getByText('Only content')).toBeInTheDocument();
    expect(screen.queryByText('Rail Controls')).not.toBeInTheDocument();
  });

  it('suppresses the rail via showRail=false without losing the back control', () => {
    const { container } = render(
      <CapabilityDetailLayout
        eyebrow="Capability Skill"
        title="sample_skill"
        backHref="/workspace/ws-1/capabilities?category=skills"
        backLabel="Back to Skills"
        showRail={false}
      >
        <div>Pane body</div>
      </CapabilityDetailLayout>,
    );
    expect(container.querySelector('aside')).toBeNull();
    const back = screen.getByRole('link', { name: /Back to Skills/i });
    expect(back).toHaveAttribute('href', '/workspace/ws-1/capabilities?category=skills');
    expect(screen.getByText('Pane body')).toBeInTheDocument();
  });
});

describe('MetaRow', () => {
  it('renders label and value with the mono metadata treatment', () => {
    render(
      <dl>
        <MetaRow label="Confidence" value="0.92" />
      </dl>,
    );
    const label = screen.getByText('Confidence');
    expect(label).toBeInTheDocument();
    const row = label.closest('div');
    expect(row).not.toBeNull();
    expect(row!.className).toContain('font-mono');
    expect(label.className).toContain('uppercase');
    expect(screen.getByText('0.92')).toBeInTheDocument();
  });
});
