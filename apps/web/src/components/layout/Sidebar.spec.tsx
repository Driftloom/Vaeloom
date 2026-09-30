import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/workspace/ws-1/memory',
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { displayName: 'Test User', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

describe('Sidebar', () => {
  it('groups navigation into IA spaces', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    expect(screen.getByText('Assist')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Career')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Trust & Rights')).toBeInTheDocument();
    // Enterprise is gated hidden by default (FW-017)
    expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
  });

  it('shows enterprise group when portalMode="all" and NEXT_PUBLIC_ENABLE_ENTERPRISE=true', () => {
    const prev = process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'];
    process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] = 'true';
    render(<Sidebar workspaceId="ws-1" portalMode="all" open={false} onClose={jest.fn()} />);
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('gated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Marketplace' })).toBeInTheDocument();
    process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] = prev;
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
    const active = screen.getByRole('link', { name: 'Second Brain' });
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
    const link = screen.getByRole('link', { name: 'Second Brain' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('title', 'Second Brain');
  });
});
