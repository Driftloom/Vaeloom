import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectorsPage from './page';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { api } from '../../../../lib/api';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-1' })
}));

jest.mock('../../../../hooks/useWorkspace', () => ({
  useWorkspaceConnectors: jest.fn()
}));

jest.mock('../../../../lib/api', () => ({
  api: {
    integrations: {
      create: jest.fn(),
      sync: jest.fn()
    }
  }
}));

describe('ConnectorsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [],
      isLoading: true,
      mutate: jest.fn()
    });

    render(<ConnectorsPage />);
    expect(screen.getByText('Loading connectors...')).toBeInTheDocument();
  });

  it('renders available connectors', () => {
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [],
      isLoading: false,
      mutate: jest.fn()
    });

    render(<ConnectorsPage />);
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('displays connected status for synced connectors', () => {
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [
        { id: 'c1', provider: 'drive', status: 'connected', lastSyncAt: new Date().toISOString() }
      ],
      isLoading: false,
      mutate: jest.fn()
    });

    render(<ConnectorsPage />);
    
    // Drive should have a "Sync Now" button
    const syncButtons = screen.getAllByText('Sync Now');
    expect(syncButtons.length).toBeGreaterThan(0);
    
    // Unconnected like GitHub should have "Connect"
    const connectButtons = screen.getAllByText('Connect');
    expect(connectButtons.length).toBeGreaterThan(0);
  });

  it('calls connect API when clicking Connect', async () => {
    const mutateMock = jest.fn();
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [],
      isLoading: false,
      mutate: mutateMock
    });
    
    (api.integrations.create as jest.Mock).mockResolvedValue({});

    render(<ConnectorsPage />);
    
    const connectButtons = screen.getAllByText('Connect');
    // Click connect for the first one (Drive)
    fireEvent.click(connectButtons[0]);

    await waitFor(() => {
      expect(api.integrations.create).toHaveBeenCalledWith({ name: 'drive', provider: 'drive' });
      expect(mutateMock).toHaveBeenCalled();
    });
  });

  it('calls sync API when clicking Sync Now', async () => {
    const mutateMock = jest.fn();
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [
        { id: 'c1', provider: 'drive', status: 'connected', lastSyncAt: new Date().toISOString() }
      ],
      isLoading: false,
      mutate: mutateMock
    });
    
    (api.integrations.sync as jest.Mock).mockResolvedValue({});

    render(<ConnectorsPage />);
    
    const syncButtons = screen.getAllByText('Sync Now');
    fireEvent.click(syncButtons[0]);

    await waitFor(() => {
      expect(api.integrations.sync).toHaveBeenCalledWith('c1');
      expect(mutateMock).toHaveBeenCalled();
    });
  });

  it('handles connect API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [],
      isLoading: false,
      mutate: jest.fn()
    });
    
    (api.integrations.create as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ConnectorsPage />);
    const connectButtons = screen.getAllByText('Connect');
    fireEvent.click(connectButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to connect', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('handles sync API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (useWorkspaceConnectors as jest.Mock).mockReturnValue({
      connectors: [
        { id: 'c1', provider: 'drive', status: 'connected', lastSyncAt: new Date().toISOString() }
      ],
      isLoading: false,
      mutate: jest.fn()
    });
    
    (api.integrations.sync as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<ConnectorsPage />);
    const syncButtons = screen.getAllByText('Sync Now');
    fireEvent.click(syncButtons[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to sync', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });
});
