import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/workspace/ws-1/memory',
}));

// E6: enterprise access arrives as a server-attested capability on the
// /auth/me payload; the spec controls it here instead of a NEXT_PUBLIC_* env.
const authControl: { me: { capabilities?: { enterprise: boolean } } | null } = { me: null };

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { displayName: 'Test User', email: 'test@example.com' },
    isAuthenticated: true,
    me: authControl.me,
  }),
}));

describe('Sidebar', () => {
  it('groups navigation into IA spaces', () => {
    authControl.me = null;
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    expect(screen.getByText('Assist')).toBeInTheDocument();
    expect(screen.getByText('Career')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Trust & Rights')).toBeInTheDocument();
    // The `memory` route is labelled "Memory" inside a group ALSO headed "Memory",
    // so a bare getByText matches two nodes and `getAllByText(...)[0]` would pass
    // while asserting nothing about which one it found. Group headings are plain
    // text; nav entries are links, so assert each by its own role.
    expect(screen.getByRole('link', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getAllByText('Memory')).toHaveLength(2);
    // Enterprise is gated hidden without a server entitlement (FW-017 / E6)
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
  });

  it('shows enterprise group when portalMode="all" and the server attests the enterprise capability', () => {
    authControl.me = { capabilities: { enterprise: true } };
    render(<Sidebar workspaceId="ws-1" portalMode="all" open={false} onClose={jest.fn()} />);
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('gated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Marketplace' })).toBeInTheDocument();
    authControl.me = null;
  });

  it('keeps the enterprise group hidden when the server withholds the capability', () => {
    authControl.me = { capabilities: { enterprise: false } };
    render(<Sidebar workspaceId="ws-1" portalMode="all" open={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
    authControl.me = null;
  });

  it('renders mode switcher tabs and allows switching modes', () => {
    const { rerender } = render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    expect(screen.getByRole('tab', { name: /User/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Admin/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dev/ })).toBeInTheDocument();

    // In Workspace mode, personal spaces are rendered
    expect(screen.getByText('Assist')).toBeInTheDocument();
    expect(screen.queryByText('Governance')).not.toBeInTheDocument();

    // In Admin mode
    rerender(<Sidebar workspaceId="ws-1" portalMode="admin" open={false} onClose={jest.fn()} />);
    expect(screen.getByText('Governance')).toBeInTheDocument();
    expect(screen.getByText('Security & Access')).toBeInTheDocument();
    expect(screen.getByText('Billing & Operations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();

    // In Developer mode
    rerender(
      <Sidebar workspaceId="ws-1" portalMode="developer" open={false} onClose={jest.fn()} />,
    );
    expect(screen.getByText('AI Systems')).toBeInTheDocument();
    expect(screen.getByText('Integrations & MCP')).toBeInTheDocument();
    expect(screen.getByText('Developer Platform')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cognitive Engine' })).toBeInTheDocument();
  });

  it('marks the active route with aria-current', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    const active = screen.getByRole('link', { name: 'Memory' });
    expect(active).toHaveAttribute('aria-current', 'page');
  });

  it('renders Capabilities link under Assist', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    const link = screen.getByRole('link', { name: 'Capabilities' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/workspace/ws-1/capabilities');
  });

  it('keeps emoji icons hidden from assistive tech', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(10);
  });

  it('supports collapsing and expanding via onToggleCollapse', () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <Sidebar
        workspaceId="ws-1"
        open={false}
        onClose={jest.fn()}
        collapsed={false}
        onToggleCollapse={onToggle}
      />,
    );
    const collapseBtn = screen.getByRole('button', { name: 'Collapse sidebar' });
    fireEvent.click(collapseBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <Sidebar
        workspaceId="ws-1"
        open={false}
        onClose={jest.fn()}
        collapsed={true}
        onToggleCollapse={onToggle}
      />,
    );
    const expandBtn = screen.getByRole('button', { name: 'Expand sidebar' });
    fireEvent.click(expandBtn);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('keeps links accessible with sr-only text and title tooltip in collapsed mode', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} collapsed={true} />);
    const link = screen.getByRole('link', { name: 'Memory' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('title', 'Memory');
  });
});
