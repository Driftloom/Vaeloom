import { render, screen } from '@testing-library/react';
import React from 'react';
import MemoryScalePage from '@/app/workspace/[workspaceId]/memory/scale/page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1' }),
}));

jest.mock('@/components/memory/ScaleMemoryViewer', () => ({
  ScaleMemoryViewer: () => <div data-testid="scale-viewer-stub" />,
}));

/**
 * The page previously advertised "Wavelength Levels 0 — 3", but the backend
 * SCALE hierarchy has six consolidation tiers (SUB_DAILY, DAILY, WEEKLY,
 * MONTHLY, ANNUAL, NORTH_STAR). A badge that contradicts the data it labels is
 * a lie the user can catch by reading the tier list directly beneath it.
 */
describe('SCALE temporal hierarchy page', () => {
  it('renders the viewer', () => {
    render(<MemoryScalePage />);
    expect(screen.getByTestId('scale-viewer-stub')).toBeInTheDocument();
  });

  it('describes the real six-tier wavelength model, not a 0—3 level range', () => {
    render(<MemoryScalePage />);
    expect(screen.getByText('Sub-Daily → North Star')).toBeInTheDocument();
    expect(screen.queryByText(/Wavelength Levels/)).toBeNull();
  });
});
