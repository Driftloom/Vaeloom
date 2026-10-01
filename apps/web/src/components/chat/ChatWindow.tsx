'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExecutionTimeline } from '@/components/execution/ExecutionTimeline';
import { useRealtime } from '@/components/providers/RealtimeProvider';
import { useChatAutoScroll } from '@/hooks/useChatAutoScroll';
import { ChatComposer } from './ChatComposer';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatThreadRail } from './ChatThreadRail';
import { useChatStore } from './chat-store';
import { MAX_INPUT_LENGTH, type MentionTarget } from './types';

/**
 * Chat composition shell.
 *
 * This file used to be 2,063 lines holding the transcript, the composer, the
 * thread rail, the send pipeline and two parallel API pathways. State and data
 * moved into `chat-store.ts` + `sse.ts`; presentation moved into the sibling
 * components. What is left is layout and wiring.
 *
 * The structural fixes live in the store, not here: `threads` is the single
 * source of truth (the old component kept a second `messages` array that
 * diverged on every streamed token), and telemetry is reported rather than
 * invented.
 */
export function ChatWindow({ workspaceId }: { workspaceId: string }) {
  const store = useChatStore(workspaceId);
  const searchParams = useSearchParams();
  const docId = searchParams?.get('docId');
  const docName = searchParams?.get('docName');
  const { status: connectionStatus } = useRealtime();

  // Mobile drawer. Defaults closed: the old component defaulted it open, so a
  // phone loaded /chat behind an 82%-width thread list with no close button.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Deep-link integration from Documents Hub / Detail page
  useEffect(() => {
    if (docName && store.catalogState === 'ready') {
      const hasDocumentAgent = store.catalog.some((a) => a.name === 'document');
      if (hasDocumentAgent) {
        store.setSelectedAgent('document');
      }
      if (!store.input) {
        store.setInput(`Analyze document "${docName}" (id: ${docId || ''}): `);
        inputRef.current?.focus();
      }
    }
  }, [docName, docId, store.catalogState]); // eslint-disable-line react-hooks/exhaustive-deps

  const streaming = store.messages.some((m) => m.status === 'streaming');
  const { handleScroll, scrollToBottom, showNewMessages } = useChatAutoScroll(
    scrollRef,
    [store.messages, store.busy],
    { streaming, resetKey: store.activeId },
  );

  const canonicalAgents = useMemo(
    () => store.catalog.filter((a) => a.isCanonical),
    [store.catalog],
  );

  const agentCount =
    store.catalogState === 'ready' ? canonicalAgents.length || store.catalog.length : null;

  const mentionTargets = useMemo<MentionTarget[]>(() => {
    const colors = new Map(store.commands.map((c) => [c.agent, c.color]));
    return canonicalAgents.map((a) => ({
      name: a.name,
      mission: a.mission,
      color: colors.get(a.name),
    }));
  }, [canonicalAgents, store.commands]);

  /** Tailwind bg-* class per agent, taken from the backend palette via the command list. */
  const agentColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of store.commands) {
      if (c.color && !map[c.agent]) map[c.agent] = c.color;
    }
    return map;
  }, [store.commands]);

  /* `ChatMessageItem` is memoised, so every callback that reaches it must keep its
     identity across renders — an inline arrow here re-renders the entire transcript
     on each streamed token, which is the exact cost the memo boundary removes. The
     store's own actions are already `useCallback`-stable; only the three that need
     a different signature need wrapping. */
  const { copyMessage, decideProposal, send } = store;

  const handleSend = useCallback((text?: string) => void send(text), [send]);

  const handleCopy = useCallback((messageId: string) => void copyMessage(messageId), [copyMessage]);

  const handleDecide = useCallback(
    (messageId: string, index: number, decision: 'approve' | 'reject') => {
      void decideProposal(messageId, index, decision);
    },
    [decideProposal],
  );

  const handlePickCommand = useCallback(
    (trigger: string, agent: string) => {
      store.setSelectedAgent(agent);
      store.setInput(`${trigger} `);
      inputRef.current?.focus();
    },
    [store],
  );

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <ChatThreadRail
        threads={store.threads}
        activeId={store.activeId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSelect={store.selectThread}
        onNew={() => store.newThread({ agent: store.selectedAgent })}
        onRename={store.renameThread}
        onDelete={store.deleteThread}
        onClear={store.clearThread}
        agentCount={agentCount}
        commandsAvailable={store.commandsState === 'ready' ? store.commands.length : null}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <ChatHeader
          workspaceId={workspaceId}
          agentName={store.selectedAgent}
          agentCount={agentCount}
          durableMode={store.durableMode}
          onDurableModeChange={store.setDurableMode}
          connectionStatus={connectionStatus}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          onNewChat={() => store.newThread({ agent: store.selectedAgent })}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          {store.workflowId && (
            <div className="mx-auto w-full max-w-[768px] shrink-0 px-4 pt-4 md:px-6">
              <ExecutionTimeline
                workflowId={store.workflowId}
                agentName={store.selectedAgent !== 'auto' ? store.selectedAgent : undefined}
                ragStatus={store.ragStatus}
              />
            </div>
          )}

          <ChatMessageList
            messages={store.messages}
            busy={store.busy}
            agentColors={agentColors}
            scrollRef={scrollRef}
            onScroll={handleScroll}
            showNewMessages={showNewMessages}
            scrollToNewest={() => scrollToBottom('smooth')}
            emptyState={
              <ChatEmptyState
                commands={store.commands}
                commandsState={store.commandsState}
                {...(store.commandsError ? { commandsError: store.commandsError } : {})}
                onPickCommand={handlePickCommand}
                onSend={(text) => void store.send(text)}
              />
            }
            onCopy={handleCopy}
            onRetry={store.retry}
            onEdit={store.editUserMessage}
            onDelete={store.deleteMessage}
            onDecide={handleDecide}
            onSend={handleSend}
          />
        </div>

        <ChatComposer
          value={store.input}
          onChange={store.setInput}
          onSubmit={handleSend}
          onStop={store.stop}
          busy={store.busy}
          commands={store.commands}
          commandsState={store.commandsState}
          {...(store.commandsError ? { commandsError: store.commandsError } : {})}
          mentionTargets={mentionTargets}
          selectedAgent={store.selectedAgent}
          onSelectAgent={store.setSelectedAgent}
          attachment={store.attachment}
          onAttachment={store.setAttachment}
          maxLength={MAX_INPUT_LENGTH}
          persistenceError={store.persistenceError}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}

export default ChatWindow;
