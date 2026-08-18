import React from 'react';

type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

interface ConnectorCardProps {
  name: string;
  status: ConnectorStatus;
  lastSync?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

const statusConfig: Record<ConnectorStatus, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'text-green-400' },
  disconnected: { label: 'Disconnected', color: 'text-text-muted' },
  error: { label: 'Error', color: 'text-red-400' },
  syncing: { label: 'Syncing...', color: 'text-blue-400' },
};

export function ConnectorCard({
  name,
  status,
  lastSync,
  onConnect,
  onDisconnect,
  className = '',
}: ConnectorCardProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border border-border bg-surface ${className}`}
    >
      <div>
        <p className="text-sm font-medium text-text">{name}</p>
        <p className={`text-xs ${config.color}`}>{config.label}</p>
        {lastSync && <p className="text-xs text-text-muted mt-1">Last sync: {lastSync}</p>}
      </div>
      <div>
        {status === 'connected' ? (
          <button
            onClick={onDisconnect}
            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded border border-red-500/30 hover:bg-red-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-background"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="text-xs text-primary hover:text-primary/80 px-3 py-1.5 rounded border border-primary/30 hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
