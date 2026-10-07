import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ConnectorOAuthCallbackPage from '../page';

const mockSearchParams = new Map<string, string>();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
}));

describe('ConnectorOAuthCallbackPage', () => {
  let originalOpener: Window | null;
  let mockPostMessage: jest.Mock;
  let mockClose: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
    originalOpener = window.opener;
    mockPostMessage = jest.fn();
    mockClose = jest.fn();

    Object.defineProperty(window, 'opener', {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true,
    });
    window.close = mockClose;
  });

  afterEach(() => {
    Object.defineProperty(window, 'opener', {
      value: originalOpener,
      writable: true,
      configurable: true,
    });
  });

  it('posts COMPOSIO_AUTH_SUCCESS to window.opener and attempts auto-close', () => {
    jest.useFakeTimers();
    mockSearchParams.set('app', 'github');

    render(<ConnectorOAuthCallbackPage />);

    expect(screen.getByText('Connection Established')).toBeInTheDocument();
    expect(screen.getByText(/Successfully connected github/i)).toBeInTheDocument();
    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: 'COMPOSIO_AUTH_SUCCESS',
        app: 'github',
        status: 'connected',
      },
      window.location.origin,
    );

    act(() => {
      jest.advanceTimersByTime(1300);
    });

    expect(mockClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('posts COMPOSIO_AUTH_ERROR to window.opener when provider returns error', () => {
    mockSearchParams.set('app', 'jira');
    mockSearchParams.set('error', 'access_denied');

    render(<ConnectorOAuthCallbackPage />);

    expect(screen.getByText('Authorization Error')).toBeInTheDocument();
    expect(screen.getByText('access_denied')).toBeInTheDocument();
    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: 'COMPOSIO_AUTH_ERROR',
        app: 'jira',
        error: 'access_denied',
      },
      window.location.origin,
    );
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('renders gracefully without crashing when window.opener is null', () => {
    Object.defineProperty(window, 'opener', {
      value: null,
      writable: true,
      configurable: true,
    });

    mockSearchParams.set('app', 'slack');
    render(<ConnectorOAuthCallbackPage />);

    expect(screen.getByText('Connection Established')).toBeInTheDocument();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
