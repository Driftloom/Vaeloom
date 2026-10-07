import type { ModelOption } from './types';
import { ChatModelSelector } from './ChatModelSelector';
import { ContextWindowGauge } from './ContextWindowGauge';

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

        {selectedSquad.length > 1 && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-action/40 bg-action/10 px-2 py-0.5 text-xs text-action font-mono">
            ⚡ Squad: {selectedSquad.length}
          </span>
        )}

        {connectionStatus !== undefined && (
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-50 px-2 py-0.5 font-mono text-xs sm:inline-flex">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className="text-text-muted">{connectionStatus}</span>
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {contextTotalTokens !== undefined && contextMaxTokens !== undefined && (
          <div className="hidden lg:block">
            <ContextWindowGauge
              totalTokens={contextTotalTokens}
              maxTokens={contextMaxTokens}
              modelId={selectedModel ?? 'default'}
              onCompact={onCompact}
              isCompacting={isCompacting}
            />
          </div>
        )}

        {selectedModel && onSelectModel && availableModels && (
          <ChatModelSelector
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            availableModels={availableModels}
            temperature={temperature}
            onTemperatureChange={onTemperatureChange ?? (() => {})}
          />
        )}

        {onToggleMemoryDrawer && (
          <button
            type="button"
            onClick={onToggleMemoryDrawer}
            title="Open Obsidian Vault & Memory Grounding drawer"
            aria-label="Open Memory Vault"
            className="rounded-lg border border-border/50 px-2 py-1 text-xs transition-colors hover:bg-surface-hover text-text inline-flex items-center gap-1"
          >
            <span aria-hidden="true">📌</span>
            <span className="hidden lg:inline text-text-muted">Vault</span>
          </button>
        )}

        {/* Count only. This previously appended a hardcoded "· QA gate" on every
            render — the backend sends no gate state with the chat header, so it
            asserted a capability that was never reported. Agent count is real
            wire data and null-guarded while loading. */}
        <span className="hidden text-xs text-text-dim xl:inline">
          {agentCount === null ? 'Loading agents…' : `${agentCount} agents`}
        </span>

        <label
          title="Route through a durable Temporal workflow so long runs survive a page refresh"
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border/50 px-2 py-1 text-xs transition-colors hover:bg-surface-hover motion-reduce:transition-none"
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
          className="rounded-full border border-border/50 px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-hover sm:px-3 motion-reduce:transition-none"
        >
          New chat
        </button>
      </div>
    </div>
  );
}
