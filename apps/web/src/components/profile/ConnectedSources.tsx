'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { connectorApi, ConnectorResponseExt } from '@/lib/api-client';

interface ConnectedSourcesProps {
  workspaceId: string;
}

export default function ConnectedSources({ workspaceId }: ConnectedSourcesProps) {
  const { data: connectors } = useSWR<ConnectorResponseExt[]>(
    workspaceId ? ['connectors', workspaceId] : null,
    () => connectorApi.list({ page: 1, page_size: 50 }),
    { revalidateOnFocus: false },
  );

  const isConnected = (typePrefix: string) => {
    if (!connectors) return false;
    return connectors.some(
      (c) =>
        (c.type?.toLowerCase().includes(typePrefix) ||
          c.name?.toLowerCase().includes(typePrefix)) &&
        c.status !== 'error' &&
        c.status !== 'disconnected',
    );
  };

  const sources = [
    {
      name: 'GitHub',
      icon: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
      connected: isConnected('github'),
    },
    {
      name: 'Google Drive',
      icon: 'M15.3 5.4l-2.7-4.7L1.6 19h5.4l11-19H15.3z M9.9 16.3L4.6 7h5.3l5.3 9.3-5.3 0z M22.4 19l-5.4-9.3-2.7 4.7 5.4 9.3 2.7-4.7z',
      connected: isConnected('drive') || isConnected('google'),
    },
    {
      name: 'Gmail',
      icon: 'M2 6l10 6 10-6v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z M2 6l10 6 10-6-10-6L2 6z',
      connected: isConnected('gmail') || isConnected('email'),
    },
    {
      name: 'Slack',
      icon: 'M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-7a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm7 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2v-2zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 7a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z',
      connected: isConnected('slack'),
    },
  ];

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-text">Memory Sources</h3>
        <Link
          href={`/workspace/${workspaceId}/connectors`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Manage
        </Link>
      </div>

      <div className="space-y-3">
        {sources.map((source, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-lg ${
                  source.connected ? 'bg-primary/10 text-primary' : 'bg-surface-200 text-text-dim'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d={source.icon} />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-muted">{source.name}</span>
            </div>
            {source.connected ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <svg
                  className="w-3.5 h-3.5 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Connected
              </span>
            ) : (
              <Link
                href={`/workspace/${workspaceId}/connectors`}
                className="text-xs text-text-dim hover:text-primary transition-colors"
              >
                Connect
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
