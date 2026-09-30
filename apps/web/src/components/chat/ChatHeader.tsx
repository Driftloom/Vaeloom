'use client';

import React from 'react';

export interface ChatHeaderProps {
  workspaceId: string;
  agentName: string;
  agentCount: number | null;
  durableMode: boolean;
  onDurableModeChange: (v: boolean) => void;
  connectionStatus: string | undefined;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onNewChat: () => void;
}

/**
 * The `h1` is deliberately NOT the `text-3xl font-display` PageHeader scale. Chat
 * is a documented full-bleed exemption (`Page.tsx` "FULL-BLEED EXEMPTIONS"), and
 * the live e2e suite asserts `heading level 1, name "Chat"`.
 */
export function ChatHeader({
  workspaceId,
  agentName,
  agentCount,
  durableMode,
  onDurableModeChange,
  connectionStatus,
  drawerOpen,
  onToggleDrawer,
  onNewChat,
}: ChatHeaderProps): JSX.Element {
  // `RealtimeProvider` seeds `status = 'connected'` before a socket exists, so
  // pulsing it as healthy green during `connecting` reported a health the
  // transport had not earned yet.
  const statusDot =
    connectionStatus === 'connected'
      ? 'bg-success'
      : connectionStatus === 'connecting'
        ? 'bg-warning animate-pulse motion-reduce:animate-none'
        : 'bg-text-dim';

  const isAuto = agentName === 'auto';

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleDrawer}
          aria-label="Toggle conversation list"
          aria-expanded={drawerOpen}
          aria-controls="chat-thread-rail"
          data-chat-drawer-trigger=""
          className="-ml-2 rounded-lg p-2 text-text transition-colors hover:bg-surface-hover motion-reduce:transition-none md:hidden"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>

        <h1 className="text-sm font-medium text-text">Chat</h1>

        <span className="hidden font-mono text-xs text-text-dim sm:inline">
          · {workspaceId.slice(0, 8)}
        </span>

        {/* Never hidden: this is the only signal of which agent is answering. */}
        <span
          className={`inline-flex max-w-[6rem] items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-xs sm:max-w-[10rem] ${
            isAuto ? 'border-border/50 text-text-dim' : 'border-action bg-action text-action-fg'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${isAuto ? 'bg-text-dim' : 'bg-action-fg'}`}
          />
          <span className="truncate">{isAuto ? 'Auto' : agentName}</span>
        </span>

        {connectionStatus !== undefined && (
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-50 px-2 py-0.5 font-mono text-xs sm:inline-flex">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className="text-text-muted">{connectionStatus}</span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden text-xs text-text-dim lg:inline">
          {agentCount === null ? 'Loading agents…' : `${agentCount} agents · QA gate`}
        </span>

        <label
          title="Route through a durable Temporal workflow so long runs survive a page refresh"
          className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-full border border-border/50 px-2 py-1 text-xs transition-colors hover:bg-surface-hover motion-reduce:transition-none"
        >
          <input
            type="checkbox"
            checked={durableMode}
            onChange={(e) => onDurableModeChange(e.target.checked)}
            className="accent-action"
            aria-label="Durable mode"
          />
          <span className="hidden sm:inline">Durable</span>
        </label>

        <button
          type="button"
          onClick={onNewChat}
          className="ml-1 rounded-full border border-border/50 px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-hover sm:px-3 motion-reduce:transition-none"
        >
          New chat
        </button>
      </div>
    </div>
  );
}
