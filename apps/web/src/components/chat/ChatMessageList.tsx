'use client';

import type React from 'react';
import { ChatMessageItem } from './ChatMessageItem';
import type { ChatMessage } from './types';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  busy: boolean;
  /** Tailwind `bg-*` class per agent name, from the backend palette. */
  agentColors: Record<string, string>;
  emptyState: React.ReactNode;
  onCopy: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  onEdit: (messageId: string, text: string) => void;
  onDelete: (messageId: string) => void;
  onDecide: (messageId: string, index: number, decision: 'approve' | 'reject') => void;
  onSend: (text: string) => void;
  onPinToMemory?: (messageId: string) => void;
  /**
   * The scroll container is owned here, so the auto-scroll hook has to attach to
   * this element rather than a sibling. Passing a ref down keeps the hook's
   * ResizeObserver pointed at the node that actually scrolls.
   */
  scrollRef?: React.Ref<HTMLDivElement>;
  onScroll?: () => void;
  showNewMessages?: boolean;
  scrollToNewest?: () => void;
}

export function ChatMessageList({
  messages,
  busy,
  agentColors,
  emptyState,
  onCopy,
  onRetry,
  onEdit,
  onDelete,
  onDecide,
  onSend,
  onPinToMemory,
  scrollRef,
  onScroll,
  showNewMessages = false,
  scrollToNewest,
}: ChatMessageListProps): JSX.Element {
  if (messages.length === 0) {
    return <div role="status">{emptyState}</div>;
  }

  const last = messages[messages.length - 1];
  /* The pending indicator is a sibling of the log, never a child of it: a
     status region inside an aria-live log would announce the same fact twice.
     It is also suppressed while a message is streaming, because that message
     already carries its own caret and second indicator would read as two runs. */
  const showPending = busy && last?.status !== 'streaming';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy}
        /* Focusable so arrow-key scrolling works. The previous transcript pane
           was a scroll container with no tab stop, so a keyboard-only user could
           not reach the history at all. */
        tabIndex={0}
        className="min-h-0 flex-1 space-y-8 overflow-y-auto scroll-contain"
      >
        {/* Every message stays mounted: the scrollbar keeps describing the whole
            thread, and the live region keeps announcing the real order. The render
            cost is bounded one level down, by the memo boundary on `ChatMessageItem`.

            Windowing was rejected, not deferred. Spacer-based windowing resizes the
            transcript body on every scroll, and `useChatAutoScroll` treats any resize
            of the element it observes as "content grew" — so scrolling up through
            history would raise the "New messages" pill with no new message at all.
            Correcting that means changing the hook's contract, which its own suite
            pins, so the honest fix here was the render boundary instead. The cost
            this leaves open is the one-time mount of 200 markdown trees; the cost it
            removes is re-parsing them on every streamed frame. */}
        {messages.map((m) => (
          <ChatMessageItem
            key={m.id}
            message={m}
            agentColor={agentColors[m.agentName ?? ''] ?? 'bg-primary'}
            onCopy={onCopy}
            onRetry={onRetry}
            onEdit={onEdit}
            onDelete={onDelete}
            onDecide={onDecide}
            onSend={onSend}
            onPinToMemory={onPinToMemory}
          />
        ))}
      </div>

      {showNewMessages && scrollToNewest && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <button
            type="button"
            onClick={scrollToNewest}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text shadow-md transition-colors hover:bg-surface-200 motion-reduce:transition-none"
            aria-label="Scroll to new messages"
          >
            <span>New messages</span>
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      )}

      {showPending && (
        <div role="status" className="flex shrink-0 items-center gap-3 pt-3">
          <span className="flex gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce motion-reduce:animate-none" />
            <span
              className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce motion-reduce:animate-none"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce motion-reduce:animate-none"
              style={{ animationDelay: '300ms' }}
            />
          </span>
          <span className="sr-only">Waiting for the agent to respond</span>
        </div>
      )}
    </div>
  );
}
