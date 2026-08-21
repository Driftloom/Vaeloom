import React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/workspace/ws-1/memory',
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

  it('shows enterprise group when NEXT_PUBLIC_ENABLE_ENTERPRISE=true', () => {
    const prev = process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'];
    process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] = 'true';
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('gated')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    process.env['NEXT_PUBLIC_ENABLE_ENTERPRISE'] = prev;
  });

  it('marks the active route with aria-current', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    const active = screen.getByRole('link', { name: 'Memory Graph' });
    expect(active).toHaveAttribute('aria-current', 'page');
  });

  it('keeps emoji icons hidden from assistive tech', () => {
    render(<Sidebar workspaceId="ws-1" open={false} onClose={jest.fn()} />);
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(10);
  });
});
