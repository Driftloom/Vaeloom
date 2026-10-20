import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { ScaleMemoryViewer } from '@/components/memory/ScaleMemoryViewer';
import { cognitionApi } from '@/lib/api-client';

// `jest` is intentionally the ambient global, NOT imported from '@jest/globals'
// (see VaultSyncPanel.honesty.test.tsx).

jest.mock('@/lib/api-client', () => ({
  cognitionApi: {
    listScaleNodes: jest.fn(),
    rollup: jest.fn(),
  },
}));

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const listScaleNodesMock = cognitionApi.listScaleNodes as jest.Mock;
const rollupMock = cognitionApi.rollup as jest.Mock;

function makeNode(i: number, tier = 'WEEKLY') {
  return {
    id: `node-${i}`,
    userId: 'u-1',
    workspaceId: 'ws-1',
    tier,
    periodStart: '2026-01-05T00:00:00Z',
    periodEnd: '2026-01-12T00:00:00Z',
    summary: `Rollup summary ${i}`,
    keyInsights: [`Insight ${i}`],
    frictionPoints: [],
    unresolvedQuestions: [],
    actionCommitments: [`Commit ${i}`],
    metadata: {},
    createdAt: '2026-01-12T01:00:00Z',
  };
}

function renderViewer() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ScaleMemoryViewer workspaceId="ws-1" />
    </SWRConfig>,
  );
}

/**
 * The SCALE viewer previously offered rollup targets the backend cannot
 * produce (DAILY, NORTH_STAR), requested a bare array endpoint as if it had a
 * total, and painted its active pill with `text-white`. These tests pin the
 * corrected contract: the real six tiers, an explicit limit, an honest
 * truncation line, and only backend-supported rollup targets.
 */
describe('ScaleMemoryViewer tier surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listScaleNodesMock.mockResolvedValue({ nodes: [], total: 0 });
    rollupMock.mockResolvedValue({ success: true });
  });

  it('offers every real backend tier, including sub-daily and annual', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalled());

    for (const label of [
      'All Wavelengths',
      'Sub-Daily',
      'Daily Logs',
      'Weekly Rollups',
      'Monthly Milestones',
      'Annual Retrospectives',
      'North Star',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('requests the first page with an explicit limit through the api-client helper', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalledWith('ws-1', { limit: 50 }));
  });

  it('passes the selected tier to the API instead of filtering client-side', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Weekly Rollups' }));

    await waitFor(() =>
      expect(listScaleNodesMock).toHaveBeenCalledWith('ws-1', { limit: 50, tier: 'WEEKLY' }),
    );
  });

  it('states the true return size when the page truncates the tier', async () => {
    listScaleNodesMock.mockResolvedValue({
      nodes: Array.from({ length: 50 }, (_, i) => makeNode(i)),
      total: 60,
    });
    renderViewer();

    expect(await screen.findByText('Showing 50 of 60 nodes')).toBeInTheDocument();
  });

  it('does not render a truncation line when the page covers the tier', async () => {
    listScaleNodesMock.mockResolvedValue({
      nodes: Array.from({ length: 3 }, (_, i) => makeNode(i)),
      total: 3,
    });
    renderViewer();

    await screen.findByText('Rollup summary 0');
    expect(screen.queryByText(/^Showing /)).toBeNull();
  });

  it('styles the active tier pill with design tokens, never text-white', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalled());

    const activePill = screen.getByRole('button', { name: 'All Wavelengths' });
    expect(activePill.className).toContain('bg-accent');
    expect(activePill.className).toContain('text-accent-fg');
    expect(activePill.className).not.toContain('text-white');
    expect(activePill.className).not.toContain('var(--color');

    const inactivePill = screen.getByRole('button', { name: 'Weekly Rollups' });
    expect(inactivePill.className).toContain('bg-surface-100');
    expect(inactivePill.className).not.toContain('text-white');
    expect(inactivePill.className).not.toContain('var(--color');
  });
});

describe('ScaleMemoryViewer rollup honesty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listScaleNodesMock.mockResolvedValue({ nodes: [], total: 0 });
    rollupMock.mockResolvedValue({ success: true });
  });

  it('only offers the WEEKLY and MONTHLY targets the backend rollup can produce', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Synthesize Rollup' }));

    expect(await screen.findByText('Past 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Past 30 Days')).toBeInTheDocument();
    expect(screen.queryByText('Past 24 Hours')).toBeNull();
    expect(screen.queryByText(/1-Year Horizon/)).toBeNull();
    expect(screen.queryByRole('button', { name: /DAILY/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /NORTH STAR/ })).toBeNull();
  });

  it('issues the rollup through the api-client with a 7-day window for WEEKLY', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Synthesize Rollup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start Synthesis' }));

    await waitFor(() => expect(rollupMock).toHaveBeenCalledTimes(1));
    const payload = rollupMock.mock.calls[0]?.[0] as {
      workspace_id: string;
      target_tier: string;
      period_start: string;
      period_end: string;
    };
    expect(payload.workspace_id).toBe('ws-1');
    expect(payload.target_tier).toBe('WEEKLY');
    const start = new Date(payload.period_start).getTime();
    const end = new Date(payload.period_end).getTime();
    const days = (end - start) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('issues a 30-day window when MONTHLY is selected', async () => {
    renderViewer();
    await waitFor(() => expect(listScaleNodesMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Synthesize Rollup' }));
    fireEvent.click(await screen.findByRole('button', { name: /MONTHLY/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Synthesis' }));

    await waitFor(() => expect(rollupMock).toHaveBeenCalledTimes(1));
    const payload = rollupMock.mock.calls[0]?.[0] as {
      target_tier: string;
      period_start: string;
      period_end: string;
    };
    expect(payload.target_tier).toBe('MONTHLY');
    const start = new Date(payload.period_start).getTime();
    const end = new Date(payload.period_end).getTime();
    const days = (end - start) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});
