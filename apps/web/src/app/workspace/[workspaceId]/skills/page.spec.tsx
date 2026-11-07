import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import SkillsPage from './page';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const mockUseParams = useParams as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUseSearchParams = useSearchParams as jest.Mock;

describe('legacy /skills redirect', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ workspaceId: 'ws-test' });
    mockUseRouter.mockReturnValue({ push: jest.fn(), replace });
    mockUseSearchParams.mockReturnValue(new URLSearchParams('skill=ats-audit'));
  });

  it('preserves incoming params and forces the skills category on the canonical workbench', async () => {
    render(<SkillsPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        '/workspace/ws-test/capabilities?skill=ats-audit&category=skills',
      );
    });
  });
});
