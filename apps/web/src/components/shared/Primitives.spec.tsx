import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge, StatusDot, Skeleton } from '@vaeloom/ui-kit';

describe('UI Kit Primitives (@vaeloom/ui-kit)', () => {
  describe('Badge', () => {
    it('renders with default variant and children', () => {
      render(<Badge>Default Badge</Badge>);
      const badge = screen.getByText('Default Badge');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-surface-hover');
    });

    it('renders primary variant', () => {
      render(<Badge variant="primary">Primary Badge</Badge>);
      const badge = screen.getByText('Primary Badge');
      expect(badge.className).toContain('bg-primary/10');
      expect(badge.className).toContain('text-primary');
    });

    it('renders success variant', () => {
      render(<Badge variant="success">Success Badge</Badge>);
      const badge = screen.getByText('Success Badge');
      expect(badge.className).toContain('text-success');
    });
  });

  describe('StatusDot', () => {
    it('renders active status with pulse', () => {
      const { container } = render(<StatusDot status="active" pulse label="Active Status" />);
      expect(screen.getByText('Active Status')).toBeInTheDocument();
      const ping = container.querySelector('.animate-ping');
      expect(ping).toBeInTheDocument();
      expect(ping?.className).toContain('bg-success/60');
    });

    it('renders disabled status', () => {
      const { container } = render(<StatusDot status="disabled" />);
      const dot = container.querySelector('.bg-text-dim');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('Skeleton', () => {
    it('renders placeholder with animation class', () => {
      const { container } = render(<Skeleton className="w-24 h-6" />);
      const el = container.firstChild as HTMLElement;
      expect(el).toHaveClass('animate-pulse');
      expect(el).toHaveClass('w-24');
      expect(el).toHaveClass('h-6');
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
