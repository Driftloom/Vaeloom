import React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/workspace/ws-1/memory',
}));

describe('Sidebar', () => {
  it('groups navigation into IA spaces', () => {
    render(<Sidebar workspaceId="ws-1" />);
    expect(screen.getByText('Assist')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Career')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Trust & Rights')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('marks enterprise group as gated', () => {
    render(<Sidebar workspaceId="ws-1" />);
    expect(screen.getByText('gated')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
  });

  it('marks the active route with aria-current', () => {
    render(<Sidebar workspaceId="ws-1" />);
    const active = screen.getByRole('link', { name: 'Memory Graph' });
    expect(active).toHaveAttribute('aria-current', 'page');
  });

  it('keeps emoji icons hidden from assistive tech', () => {
    render(<Sidebar workspaceId="ws-1" />);
    const icons = document.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThanOrEqual(16);
  });
});
