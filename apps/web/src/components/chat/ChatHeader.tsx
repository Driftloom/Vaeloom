import type { ModelOption } from './types';
import { ChatModelSelector } from './ChatModelSelector';
import { ChatSessionInspectorPopover } from './ChatSessionInspectorPopover';

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
  selectedModel?: string;
  onSelectModel?: (modelId: string) => void;
  availableModels?: ModelOption[];
  temperature?: number;
  onTemperatureChange?: (temp: number) => void;
  selectedSquad?: string[];
  onToggleMemoryDrawer?: () => void;
  contextTotalTokens?: number;
  contextMaxTokens?: number;
  onCompact?: () => void;
  isCompacting?: boolean;
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
  selectedModel,
  onSelectModel,
  availableModels,
  temperature = 0.7,
  onTemperatureChange,
  selectedSquad = [],
  onToggleMemoryDrawer,
  contextTotalTokens,
  contextMaxTokens,
  onCompact,
  isCompacting,
}: ChatHeaderProps): JSX.Element {
  const statusDot =
    connectionStatus === 'connected'
      ? 'bg-success'
      : connectionStatus === 'connecting'
        ? 'bg-warning animate-pulse motion-reduce:animate-none'
        : 'bg-text-dim';

  const isAuto = agentName === 'auto';

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 md:px-5 bg-surface-50/30">
      {/* Identity & Navigation Zone */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleDrawer}
          aria-label="Toggle conversation list"
          aria-expanded={drawerOpen}
          aria-controls="chat-thread-rail"
          data-chat-drawer-trigger=""
          className="-ml-1 rounded-lg p-1.5 text-text transition-colors hover:bg-surface-hover motion-reduce:transition-none md:hidden"
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

        <h1 className="text-sm font-semibold text-text">Chat</h1>

        <span className="hidden font-mono text-xs text-text-dim sm:inline">
          · {workspaceId.slice(0, 8)}
        </span>

        {/* Resilient Agent Badge: guaranteed min-width to avoid collapsing to a dot */}
        <span
          className={`inline-flex min-w-[4.25rem] max-w-[8rem] sm:max-w-[12rem] items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
            isAuto
              ? 'border-border/60 bg-surface-100 text-text-dim'
              : 'border-action/60 bg-action/15 text-action-fg'
          }`}
          title={`Active Agent: ${isAuto ? 'Auto' : agentName}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${isAuto ? 'bg-text-dim' : 'bg-action'}`}
          />
          <span className="truncate">{isAuto ? 'Auto' : agentName}</span>
        </span>

        {selectedSquad.length > 1 && (
          <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-action/40 bg-action/10 px-2 py-0.5 text-xs text-action font-mono">
            ⚡ Squad: {selectedSquad.length}
          </span>
        )}

        {connectionStatus !== undefined && (
          <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-surface-100 px-2.5 py-0.5 font-mono text-xs">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className="text-text-muted">{connectionStatus}</span>
          </span>
        )}
      </div>

      {/* Action Zone: Model Selector, Session Inspector Popover, New Chat */}
      <div className="flex shrink-0 items-center gap-2">
        {selectedModel && onSelectModel && availableModels && (
          <ChatModelSelector
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            availableModels={availableModels}
            temperature={temperature}
            onTemperatureChange={onTemperatureChange ?? (() => {})}
          />
        )}

        <ChatSessionInspectorPopover
          totalTokens={contextTotalTokens}
          maxTokens={contextMaxTokens}
          modelId={selectedModel ?? 'default'}
          durableMode={durableMode}
          onDurableModeChange={onDurableModeChange}
          onCompact={onCompact}
          isCompacting={isCompacting}
          onToggleMemoryDrawer={onToggleMemoryDrawer}
          agentCount={agentCount}
        />

        <button
          type="button"
          onClick={onNewChat}
          className="rounded-lg border border-border/70 bg-surface-100 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-hover hover:border-border active:bg-surface-200 motion-reduce:transition-none"
        >
          New chat
        </button>
      </div>
    </div>
  );
}
