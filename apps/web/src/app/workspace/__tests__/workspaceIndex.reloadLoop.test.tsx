import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import WorkspaceIndexPage from '../page';
import { api, ApiError, clearToken, clearRefreshToken } from '@/lib/api';
import { navigateTo } from '@/lib/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/api', () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    api: { me: jest.fn(), createWorkspace: jest.fn() },
    ApiError: MockApiError,
    clearToken: jest.fn(),
    clearRefreshToken: jest.fn(),
    setToken: jest.fn(),
  };
});

jest.mock('@/lib/navigation', () => ({
  navigateTo: jest.fn(),
}));

let mockRouterReplace: jest.Mock;

describe('WorkspaceIndexPage — API-down behavior (reload loop guard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      replace: mockRouterReplace,
      push: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    });
  });

  it('shows a retryable error instead of bouncing to /login while the API is down', async () => {
    jest.useFakeTimers();
    try {
      (api.me as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      render(<WorkspaceIndexPage />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Failed to fetch');

      // The pre-fix behavior redirected to /login after 1.5s, which the
      // middleware bounced back to /workspace — an endless reload loop.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(navigateTo).not.toHaveBeenCalled();
      expect(mockRouterReplace).not.toHaveBeenCalled();

      // Retry succeeds once the API is reachable again.
      (api.me as jest.Mock).mockResolvedValueOnce({ workspaces: [{ id: 'ws-1' }] });
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/workspace/ws-1'));
      expect(navigateTo).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a retryable error when /auth/me returns a 5xx', async () => {
    (api.me as jest.Mock).mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'));

    render(<WorkspaceIndexPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Internal Server Error');
    expect(navigateTo).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('signs the user out on a 401 without a retry loop', async () => {
    (api.me as jest.Mock).mockRejectedValueOnce(new ApiError(401, 'Token has been revoked'));

    render(<WorkspaceIndexPage />);

    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/login'));
    expect(clearToken).toHaveBeenCalled();
    expect(clearRefreshToken).toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
