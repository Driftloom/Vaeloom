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
import { ChatSubpagesNav, AgentSquadsView, ModelMatrixView } from './ChatSubpages';
import { MemoryVaultExplorer } from './MemoryVaultExplorer';
import { ChatMemoryDrawer } from './ChatMemoryDrawer';
import { useChatStore } from './chat-store';
import { useWorkspaceCapabilities } from '@/hooks/useWorkspace';
import { getAgentForSkill } from '@/components/capabilities/skills/SkillIntegrationBar';
import { MAX_INPUT_LENGTH, type ChatSkill, type MentionTarget } from './types';

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
  const paramPrompt = searchParams?.get('prompt');
  const paramAgent = searchParams?.get('agent');
  const paramSkill = searchParams?.get('skill');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const { status: connectionStatus } = useRealtime();

  const { skills: rawSkills } = useWorkspaceCapabilities(workspaceId);

  const enabledSkills = useMemo<ChatSkill[]>(() => {
    return (rawSkills ?? [])
      .filter((s) => s.enabled)
      .map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug || s.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        description: s.description || `Skill: ${s.name}`,
        triggers: s.triggers,
        enabled: s.enabled,
        requiredScope: s.requiredScope,
      }));
  }, [rawSkills]);

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

  // Deep-link integration from Skills & Capabilities Hub (?skill=... or ?agent=...)
  useEffect(() => {
    if (paramSkill) {
      const cleanSlug = paramSkill.replace(/^skill:/, '').trim();
      if (cleanSlug) {
        setActiveSkill(cleanSlug);
        const matchedSkill = enabledSkills.find(
          (s) => s.slug === cleanSlug || s.name.toLowerCase() === cleanSlug.toLowerCase(),
        );
        if (matchedSkill) {
          const associatedAgent = getAgentForSkill(matchedSkill.name);
          if (associatedAgent && !paramAgent) {
            store.setSelectedAgent(associatedAgent.id);
          }
        }
        if (!store.input) {
          let promptToSet = `/skill:${cleanSlug} `;
          if (paramPrompt) {
            promptToSet = paramPrompt.startsWith(`/skill:${cleanSlug}`)
              ? paramPrompt
              : `/skill:${cleanSlug} ${paramPrompt}`;
          }
          store.setInput(promptToSet);
          inputRef.current?.focus();
        }
      }
    } else {
      if (paramAgent) {
        store.setSelectedAgent(paramAgent);
      }
      if (paramPrompt && !store.input) {
        store.setInput(paramPrompt);
        inputRef.current?.focus();
      }
    }
  }, [paramSkill, paramPrompt, paramAgent, enabledSkills]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const agentTargets: MentionTarget[] = canonicalAgents.map((a) => ({
      name: a.name,
      mission: a.mission,
      color: colors.get(a.name),
      kind: 'agent',
    }));

    const skillTargets: MentionTarget[] = enabledSkills.map((s) => ({
      name: s.slug || s.name,
      mission: s.description || `Skill: ${s.name}`,
      kind: 'skill',
      slug: s.slug || s.name,
    }));

    return [...agentTargets, ...skillTargets];
  }, [canonicalAgents, store.commands, enabledSkills]);

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

  const activeModelOption = useMemo(
    () => store.availableModels.find((m) => m.id === store.selectedModel),
    [store.availableModels, store.selectedModel],
  );
  const contextMaxTokens = activeModelOption?.maxTokens ?? 128000;

  const contextTotalTokens = useMemo(() => {
    const lastMsgWithUsage = [...store.messages].reverse().find((m) => m.tokenUsage?.totalTokens);
    if (lastMsgWithUsage?.tokenUsage?.totalTokens) {
      return lastMsgWithUsage.tokenUsage.totalTokens;
    }
    const totalChars = store.messages.reduce((sum, m) => sum + (m.text?.length || 0), 0);
    return Math.max(0, Math.ceil(totalChars / 3.8));
  }, [store.messages]);

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
          selectedModel={store.selectedModel}
          onSelectModel={store.setSelectedModel}
          availableModels={store.availableModels}
          temperature={store.temperature}
          onTemperatureChange={store.setTemperature}
          selectedSquad={store.selectedSquad}
          onToggleMemoryDrawer={() => store.setIsMemoryDrawerOpen(true)}
          contextTotalTokens={contextTotalTokens}
          contextMaxTokens={contextMaxTokens}
          onCompact={store.compactThreadHistory}
          isCompacting={store.isCompacting}
        />

        <ChatSubpagesNav activeTab={store.activeTab} onTabChange={store.setActiveTab} />

        {store.activeTab === 'stream' && (
          <div
            id="panel-stream"
            role="tabpanel"
            aria-labelledby="tab-stream"
            className="flex min-h-0 flex-1 flex-col"
          >
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
                    activeAgent={store.selectedAgent}
                  />
                }
                onCopy={handleCopy}
                onRetry={store.retry}
                onEdit={store.editUserMessage}
                onDelete={store.deleteMessage}
                onDecide={handleDecide}
                onSend={handleSend}
                onPinToMemory={store.pinMessageToMemory}
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
              selectedSquad={store.selectedSquad}
              onToggleSquadAgent={store.toggleSquadAgent}
              enabledSkills={enabledSkills}
              activeSkill={activeSkill}
              onActiveSkillChange={setActiveSkill}
            />
          </div>
        )}

        {store.activeTab === 'squads' && (
          <div
            id="panel-squads"
            role="tabpanel"
            aria-labelledby="tab-squads"
            className="flex min-h-0 flex-1 flex-col"
          >
            <AgentSquadsView
              selectedSquad={store.selectedSquad}
              onToggleAgent={store.toggleSquadAgent}
              onSelectSquad={store.setSelectedSquad}
              onActivateSquad={() => store.setActiveTab('stream')}
            />
          </div>
        )}

        {store.activeTab === 'models' && (
          <div
            id="panel-models"
            role="tabpanel"
            aria-labelledby="tab-models"
            className="flex min-h-0 flex-1 flex-col"
          >
            <ModelMatrixView
              availableModels={store.availableModels}
              selectedModel={store.selectedModel}
              onSelectModel={store.setSelectedModel}
              temperature={store.temperature}
              onTemperatureChange={store.setTemperature}
            />
          </div>
        )}

        {store.activeTab === 'memory' && (
          <div
            id="panel-memory"
            role="tabpanel"
            aria-labelledby="tab-memory"
            className="flex min-h-0 flex-1 flex-col"
          >
            <MemoryVaultExplorer
              workspaceId={workspaceId}
              onCiteMemory={(citation) => {
                store.setInput(store.input ? `${store.input}\n\n${citation}` : citation);
                store.setActiveTab('stream');
              }}
              onOpenVaultDrawer={() => store.setIsMemoryDrawerOpen(true)}
            />
          </div>
        )}

        <ChatMemoryDrawer
          isOpen={store.isMemoryDrawerOpen}
          onClose={() => store.setIsMemoryDrawerOpen(false)}
          workspaceId={workspaceId}
          onRecallContext={(ctx) => store.setInput(store.input ? `${store.input}\n\n${ctx}` : ctx)}
        />
      </div>
    </div>
  );
}

export default ChatWindow;
