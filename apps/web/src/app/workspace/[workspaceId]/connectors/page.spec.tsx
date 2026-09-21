import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ConnectorsPage from './page';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1' }),
  useRouter: () => ({ replace: mockReplace }),
}));

describe('ConnectorsPage redirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to capabilities page with connectors category', async () => {
    render(<ConnectorsPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/workspace/ws-1/capabilities?category=connectors');
    });
  });

  it('renders redirection message and fallback link', () => {
    render(<ConnectorsPage />);
    expect(screen.getByText(/Connectors are now unified under Capabilities/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Click here/i })).toHaveAttribute(
      'href',
      '/workspace/ws-1/capabilities?category=connectors',
    );
  });
});
