'use client';

import React from 'react';
import { Button } from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';
import { type ConnectorItem } from '@/lib/api-client';
import { type LogEntry } from './types';

export interface McpActivityLogProps {
  logs: LogEntry[];
  installedServers: ConnectorItem[];
  logFilter: string;
  onLogFilterChange: (filter: string) => void;
  onClearLogs: () => void;
}

export const McpActivityLog: React.FC<McpActivityLogProps> = ({
  logs,
  installedServers,
  logFilter,
  onLogFilterChange,
  onClearLogs,
}) => {
  const { toast } = useToast();

  const filteredLogs = logs.filter((entry) => {
    if (logFilter === 'all') return true;
    return entry.server?.toLowerCase() === logFilter.toLowerCase();
  });

  const handleCopyLogs = () => {
    const exportText = filteredLogs
      .map((entry) =>
        JSON.stringify({
          at: entry.at,
          level: entry.level,
          ...(entry.server ? { server: entry.server } : {}),
          message: entry.message,
        }),
      )
      .join('\n');

    void navigator.clipboard?.writeText(exportText).then(
      () => toast({ tone: 'info', title: 'Activity copied as JSON lines' }),
      () =>
        toast({
          tone: 'error',
          title: 'Copy failed',
          detail: 'The browser refused clipboard access.',
        }),
    );
  };

  return (
    <div className="h-[200px] flex flex-col shrink-0 bg-surface border-t border-border">
      <div className="px-4 py-2 border-b border-border bg-surface-elevated/70 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-sans font-semibold text-text">Session Activity</h3>
          <label htmlFor="mcp-log-filter" className="sr-only">
            Filter activity by server
          </label>
          <select
            id="mcp-log-filter"
            value={logFilter}
            onChange={(event) => onLogFilterChange(event.target.value)}
            className="bg-surface border border-border rounded-md px-2 py-0.5 text-xs font-sans text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
          >
            <option value="all">All events</option>
            {installedServers.map((server) => (
              <option key={server.id} value={server.name}>
                {server.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filteredLogs.length === 0}
            onClick={handleCopyLogs}
          >
            Copy Logs
          </Button>
          <Button variant="outline" size="sm" disabled={logs.length === 0} onClick={onClearLogs}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 overflow-y-auto overscroll-y-contain font-mono text-xs leading-5 bg-surface">
        <p className="text-2xs text-text-muted mb-2 font-sans">
          Actions taken in this tab, in this browser session. This is not a server audit log, and it
          is not persisted anywhere.
        </p>
        {filteredLogs.length === 0 ? (
          <p className="text-text-muted italic text-xs">
            {logs.length === 0 ? 'No activity yet.' : 'No activity for this server.'}
          </p>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-2 ${
                entry.level === 'error'
                  ? 'text-error'
                  : entry.level === 'success'
                    ? 'text-success'
                    : entry.level === 'warn'
                      ? 'text-warning'
                      : 'text-text-secondary'
              }`}
            >
              <time dateTime={entry.at} className="text-text-muted select-none text-2xs shrink-0">
                {entry.at}
              </time>
              {entry.server && (
                <span className="text-text-muted select-none shrink-0">[{entry.server}]</span>
              )}
              <span className="break-all">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
