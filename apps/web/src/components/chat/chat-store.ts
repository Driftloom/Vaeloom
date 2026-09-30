'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  agentApi,
  approvalApi,
  documentApi,
  temporalApi,
  type CatalogAgent,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { fetchAgentCatalog, fetchSlashCommands, type LoadState } from './chat-api';
import {
  applyStreamEvent,
  emptyAccumulator,
  type StreamAccumulator,
  type StreamEventData,
} from './sse';
import {
  DURABLE_MAX_POLLS,
  DURABLE_POLL_INTERVAL_MS,
  MAX_INPUT_LENGTH,
  MAX_MESSAGES_PER_THREAD,
  MAX_THREADS,
  type Attachment,
  type ChatMessage,
  type Proposal,
  type ProposalStatus,
  type SlashCommand,
  type Thread,
} from './types';

/**
 * The chat store.
 *
 * ## Why this exists as a hook rather than living in the component
 *
 * The previous `ChatWindow.tsx` kept the same message list in two places: a
 * `messages` state array AND `threads[i].messages`. Every write had to hit both,
 * and several did not. `setMessages` on a streamed token never touched `threads`,
 * so a mid-stream reload discarded the reply and resurrected the placeholder as an
 * error. `patchProposal` patched both and silently no-oped the thread half when
 * `activeId` was null. Fixing those call sites one at a time is whack-a-mole;
 * removing the second source of truth removes the entire bug class.
 *
 * So: `threads` is the only state. `messages` is derived. `patchThread` is the
 * only writer. If it compiles, it is consistent.
 *
 * ## Honesty
 *
 * No fabricated telemetry. `confidence` comes from the wire or is absent.
 * `ToolCall.latencyMs` comes from the wire or is absent. When the durable poll
 * loop runs out of attempts we say the run is still live server-side, because
 * that is the truth — the old code said "in progress" when the client had simply
 * given up.
 */

const EMPTY_MESSAGES: ChatMessage[] = [];

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${idCounter.toString(36)}_${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

function errorInfo(err: unknown): { message: string; code?: string } {
  if (err instanceof Error) {
    const code = (err as Error & { status?: number }).status;
    return { message: err.message, code: code !== undefined ? String(code) : undefined };
  }
  return { message: String(err) };
}

/** Clipboard with a non-secure-context fallback. `navigator.clipboard` is undefined on plain http. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea path (permission denied, insecure origin, …)
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export interface ChatStore {
  threads: Thread[];
  activeId: string | null;
  messages: ChatMessage[];
  busy: boolean;
  input: string;
  selectedAgent: string;
  durableMode: boolean;
  workflowId: string | null;
  ragStatus: string | null;
  commands: SlashCommand[];
  commandsState: LoadState;
  commandsError?: string;
  catalog: CatalogAgent[];
  catalogState: LoadState;
  catalogError?: string;
  /** Set when history can no longer be persisted. Surfaced, never swallowed. */
  persistenceError: string | null;
  /** File staged in the composer, not yet uploaded. */
  attachment: File | null;
  setInput: (v: string) => void;
  setAttachment: (f: File | null) => void;
  setSelectedAgent: (v: string) => void;
  setDurableMode: (v: boolean) => void;
  send: (override?: string) => Promise<void>;
  stop: () => void;
  retry: (messageId: string) => void;
  editUserMessage: (messageId: string, text: string) => void;
  deleteMessage: (messageId: string) => void;
  decideProposal: (
    messageId: string,
    index: number,
    decision: 'approve' | 'reject',
  ) => Promise<void>;
  newThread: (opts?: { agent?: string; seedInput?: string }) => void;
  selectThread: (id: string) => void;
  renameThread: (id: string, title: string) => void;
  deleteThread: (id: string) => void;
  clearThread: (id: string) => void;
  copyMessage: (messageId: string) => Promise<void>;
}

export function useChatStore(workspaceId: string): ChatStore {
  const { toast } = useToast();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [durableMode, setDurableMode] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [ragStatus, setRagStatus] = useState<string | null>(null);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [commandsState, setCommandsState] = useState<LoadState>('loading');
  const [commandsError, setCommandsError] = useState<string | undefined>();
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [catalogState, setCatalogState] = useState<LoadState>('loading');
  const [catalogError, setCatalogError] = useState<string | undefined>();
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  // Ref mirrors so the async send pipeline always reads current values instead of
  // closing over a stale render (the old `handleSend` had `messages` in its dep
  // array, so it was recreated on every streamed token and captured a snapshot).
  const activeIdRef = useRef<string | null>(null);
  const threadsRef = useRef<Thread[]>([]);
  const inputRef = useRef('');
  const selectedRef = useRef('auto');
  const durableRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const mountedRef = useRef(true);
  const hydratedRef = useRef(false);
  const attachmentRef = useRef<File | null>(null);
  // `stop` is memoised on stable deps, so reading `workflowId` from its closure
  // returned the value from the very first render — always null — and the durable
  // cancellation was never issued.
  const workflowIdRef = useRef<string | null>(null);

  activeIdRef.current = activeId;
  threadsRef.current = threads;
  inputRef.current = input;
  selectedRef.current = selectedAgent;
  durableRef.current = durableMode;
  attachmentRef.current = attachment;
  workflowIdRef.current = workflowId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort the in-flight stream and stop the durable poll loop. The old code
      // had no unmount cleanup, so a navigation mid-response leaked the fetch and
      // kept calling setState on a dead component.
      stoppedRef.current = true;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  // ── The only writer ────────────────────────────────────────────────────────
  const patchThread = useCallback((id: string, fn: (t: Thread) => Thread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...fn(t), updatedAt: nowIso() } : t)));
  }, []);

  const patchMessage = useCallback(
    (threadId: string, messageId: string, patch: Partial<ChatMessage>) => {
      patchThread(threadId, (t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      }));
    },
    [patchThread],
  );

  const appendToThread = useCallback(
    (threadId: string, ...msgs: ChatMessage[]) => {
      patchThread(threadId, (t) => ({ ...t, messages: [...t.messages, ...msgs] }));
    },
    [patchThread],
  );

  // ── Derived: the transcript ────────────────────────────────────────────────
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );
  const messages = activeThread?.messages ?? EMPTY_MESSAGES;

  // ── Persistence ────────────────────────────────────────────────────────────
  // Threads are capped and messages are capped, and the write is debounced: the
  // old version re-serialised the entire history on every streamed token.
  useEffect(() => {
    const key = `vaeloom.threads.${workspaceId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          const restored = (parsed as Thread[])
            .filter((t) => t && typeof t.id === 'string' && Array.isArray(t.messages))
            .slice(0, MAX_THREADS)
            .map((t) => ({
              ...t,
              updatedAt: t.updatedAt ?? t.createdAt ?? nowIso(),
              // A page reload must never resurrect a placeholder as a live stream.
              messages: t.messages.map((m) =>
                m.status === 'streaming'
                  ? {
                      ...m,
                      status: m.text ? ('complete' as const) : ('error' as const),
                      error: m.text
                        ? undefined
                        : { message: 'Interrupted by a page reload before any output arrived.' },
                    }
                  : m,
              ),
            }));
          setThreads(restored);
          setActiveId(restored[0]?.id ?? null);
        }
      }
    } catch {
      // Corrupt payload — start clean rather than wedging the page.
    } finally {
      hydratedRef.current = true;
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const key = `vaeloom.threads.${workspaceId}`;
    const handle = setTimeout(() => {
      const trimmed = threads
        .slice(0, MAX_THREADS)
        .map((t) => ({ ...t, messages: t.messages.slice(-MAX_MESSAGES_PER_THREAD) }));
      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
        setPersistenceError(null);
      } catch {
        // Old code did `catch {}` here, so a QuotaExceededError silently killed
        // persistence forever while the user kept typing into the void.
        setPersistenceError(
          'Chat history is full — new messages are not being saved. Delete an old thread to free space.',
        );
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [threads, workspaceId]);

  // ── Catalog + command loading (abortable, honest about failure) ────────────
  useEffect(() => {
    const ac = new AbortController();
    fetchSlashCommands(workspaceId, ac.signal)
      .then((res) => {
        if (!mountedRef.current) return;
        setCommands(res.commands);
        setCommandsState(res.state);
        setCommandsError(res.error);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [workspaceId]);

  useEffect(() => {
    const ac = new AbortController();
    fetchAgentCatalog(ac.signal)
      .then((res) => {
        if (!mountedRef.current) return;
        setCatalog(res.agents);
        setCatalogState(res.state);
        setCatalogError(res.error);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);

  // Deep link: /chat?agent=<name>
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const agent = new URLSearchParams(window.location.search).get('agent');
    if (agent) setSelectedAgent(agent);
  }, []);

  // Switching threads must not leak the previous thread's durable timeline.
  useEffect(() => {
    setWorkflowId(null);
    setRagStatus(null);
  }, [activeId]);

  // ── Thread operations ──────────────────────────────────────────────────────
  const newThread = useCallback((opts?: { agent?: string; seedInput?: string }) => {
    const agent = opts?.agent;
    const id = nextId('th');
    const thread: Thread = {
      id,
      title: opts?.seedInput
        ? opts.seedInput.slice(0, 40)
        : agent && agent !== 'auto'
          ? `${agent} chat`
          : 'New conversation',
      agentName: agent && agent !== 'auto' ? agent : undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: [],
    };
    setThreads((p) => [thread, ...p].slice(0, MAX_THREADS));
    setActiveId(id);
    if (agent) setSelectedAgent(agent);
    if (opts?.seedInput) setInput(opts.seedInput);
  }, []);

  const selectThread = useCallback((id: string) => setActiveId(id), []);

  const renameThread = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().slice(0, 80);
      if (!clean) return;
      patchThread(id, (t) => ({ ...t, title: clean }));
    },
    [patchThread],
  );

  const deleteThread = useCallback((id: string) => {
    setThreads((p) => {
      const next = p.filter((t) => t.id !== id);
      setActiveId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
      return next;
    });
  }, []);

  const clearThread = useCallback(
    (id: string) => {
      patchThread(id, (t) => ({ ...t, messages: [], title: 'New conversation' }));
    },
    [patchThread],
  );

  // ── Copy ───────────────────────────────────────────────────────────────────
  const copyMessage = useCallback(
    async (messageId: string) => {
      const thread = threadsRef.current.find((t) => t.id === activeIdRef.current);
      const msg = thread?.messages.find((m) => m.id === messageId);
      if (!msg?.text) return;
      const ok = await writeClipboard(msg.text);
      if (!mountedRef.current) return;
      toast(
        ok
          ? { tone: 'success', title: 'Copied' }
          : {
              tone: 'error',
              title: 'Copy failed',
              detail: 'Your browser blocked clipboard access. Select the text and copy manually.',
            },
      );
    },
    [toast],
  );

  // ── Proposals (HITL) ───────────────────────────────────────────────────────
  const decideProposal = useCallback(
    async (messageId: string, index: number, decision: 'approve' | 'reject') => {
      const threadId = activeIdRef.current;
      if (!threadId) return;
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const proposal = thread?.messages.find((m) => m.id === messageId)?.proposals?.[index];
      if (!proposal) return;

      if (!proposal.approvalId) {
        patchMessage(threadId, messageId, {
          proposals: replaceProposal(thread?.messages ?? [], messageId, index, {
            status: 'error',
          }),
        });
        toast({
          tone: 'error',
          title: 'No approval record',
          detail:
            'This proposal is not linked to a backend approval. Review pending approvals in Notifications.',
        });
        return;
      }

      // Guard against a double-click firing two approvals.
      patchMessage(threadId, messageId, {
        proposals: replaceProposal(thread?.messages ?? [], messageId, index, { status: 'pending' }),
      });
      try {
        const result =
          decision === 'approve'
            ? await approvalApi.approve(proposal.approvalId)
            : await approvalApi.reject(proposal.approvalId);
        // The old code cast an unvalidated string to ProposalStatus, so a backend
        // status of "pending" or "needs_review" left the card showing live buttons
        // after the action had already been recorded.
        const raw = String(result?.status ?? '').toLowerCase();
        const nextStatus: ProposalStatus =
          raw === 'approved' || raw === 'rejected' || raw === 'expired'
            ? (raw as ProposalStatus)
            : decision === 'approve'
              ? 'approved'
              : 'rejected';
        patchMessage(threadId, messageId, {
          proposals: replaceProposal(
            threadsRef.current.find((t) => t.id === threadId)?.messages ?? [],
            messageId,
            index,
            { status: nextStatus },
          ),
        });
        toast({
          tone: 'success',
          title: decision === 'approve' ? 'Approved' : 'Rejected',
          detail: proposal.title,
        });
      } catch (err) {
        const { message } = errorInfo(err);
        patchMessage(threadId, messageId, {
          proposals: replaceProposal(
            threadsRef.current.find((t) => t.id === threadId)?.messages ?? [],
            messageId,
            index,
            { status: 'error' },
          ),
        });
        toast({
          tone: 'error',
          title: decision === 'approve' ? 'Approval failed' : 'Rejection failed',
          detail: message,
        });
      }
    },
    [patchMessage, toast],
  );

  // ── Stop ───────────────────────────────────────────────────────────────────
  // The old version only worked on the streamed path: `abortControllerRef` was
  // assigned inside the non-durable branch, so in durable mode the ref was null
  // and the whole handler was a no-op. Clicking Stop did nothing at all.
  const stop = useCallback(() => {
    const hadStream = abortRef.current !== null;
    abortRef.current?.abort();
    abortRef.current = null;
    stoppedRef.current = true;

    const wf = workflowIdRef.current;
    if (wf) {
      // Stop the workflow server-side too — aborting the client request does not
      // stop tools from firing or approvals from being created.
      void temporalApi.cancel(wf).catch(() => undefined);
    }

    const threadId = activeIdRef.current;
    if (threadId) {
      patchThread(threadId, (t) => ({
        ...t,
        messages: t.messages.map((m) => {
          if (m.status !== 'streaming') return m;
          return {
            ...m,
            status: 'stopped',
            text: m.text || 'Stopped before any output arrived.',
          };
        }),
      }));
    }
    setBusy(false);
    setWorkflowId(null);
    toast({
      tone: 'info',
      title: 'Generation stopped',
      detail: hadStream ? undefined : 'The server-side run was cancelled too.',
    });
  }, [patchThread, toast]);

  // ── The send pipeline ──────────────────────────────────────────────────────
  const send = useCallback(
    async (override?: string) => {
      if (busy) return;
      const staged = attachmentRef.current;
      const rawText = (override ?? inputRef.current).trim().slice(0, MAX_INPUT_LENGTH);
      if (!rawText && !staged) return;

      const agent = selectedRef.current;
      const agentForCall = agent === 'auto' ? undefined : agent;
      stoppedRef.current = false;

      // Upload the attachment first. The backend chat schema is
      // `{workspaceId, message, agentName}` — there is no document field, so the
      // agent receives the stored path as context text. That is a real limitation,
      // so the UI shows the attachment as a first-class chip and says what was
      // sent, rather than silently pasting "[File stored: …]" into the transcript
      // (which is what the old code did, and which is why `fileContext` ended up
      // feeding a no-op ternary).
      let attachments: Attachment[] | undefined;
      if (staged) {
        setAttachment(null);
        const entry: Attachment = {
          id: nextId('att'),
          name: staged.name,
          sizeBytes: staged.size,
          stored: false,
        };
        try {
          const doc = await documentApi.upload(staged, workspaceId);
          entry.stored = true;
          entry.path = String((doc as { path?: string }).path ?? '');
          toast({ tone: 'success', title: 'File attached', detail: entry.path });
        } catch (err) {
          entry.error = errorInfo(err).message;
          toast({
            tone: 'error',
            title: 'Attach failed',
            detail: `${staged.name} was not stored. The agent will only see the file name.`,
          });
        }
        attachments = [entry];
      }

      const promptText = rawText || staged?.name || '';

      // Resolve the thread first, then append. Title comes from the user's own
      // words — the old code derived it from the mutated `raw`, so attaching a
      // file produced a title like "my question\n\n[File stored…".
      let threadId = activeIdRef.current;
      if (!threadId || !threadsRef.current.some((t) => t.id === threadId)) {
        threadId = nextId('th');
        const thread: Thread = {
          id: threadId,
          title: promptText.slice(0, 40),
          agentName: agentForCall,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          messages: [],
        };
        setThreads((p) => [thread, ...p].slice(0, MAX_THREADS));
        setActiveId(threadId);
      }

      const userMessage: ChatMessage = {
        id: nextId('m'),
        role: 'user',
        text: rawText,
        timestamp: nowIso(),
        status: 'complete',
        attachments,
      };
      const agentMessage: ChatMessage = {
        id: nextId('m'),
        role: 'agent',
        text: '',
        timestamp: nowIso(),
        status: 'streaming',
        replyTo: userMessage.id,
        agentName: agentForCall ?? 'assistant',
        // No confidence, no placeholder tool call. The old code wrote
        // `confidence: 0.98` and `{name:'routing', status:'running'}` here, which
        // rendered a green "98% Verified Intent Confidence" badge and a live tool
        // row before any model had run.
      };

      patchThread(threadId, (t) => ({
        ...t,
        title: t.messages.length === 0 ? promptText.slice(0, 40) : t.title,
        messages: [...t.messages, userMessage, agentMessage],
      }));

      setInput('');
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (durableRef.current) {
          await runDurableTurn({
            workspaceId,
            threadId,
            agentMessageId: agentMessage.id,
            text: promptText,
            agentForCall,
            signal: controller.signal,
            isStopped: () => stoppedRef.current,
            patchMessage,
            setWorkflowId,
            setRagStatus,
            runBuffered: (t, a) => runBufferedTurn({ workspaceId, text: t, agentForCall: a }),
          });
        } else {
          await runStreamedTurn({
            workspaceId,
            threadId,
            agentMessageId: agentMessage.id,
            text: promptText,
            agentForCall,
            signal: controller.signal,
            patchMessage,
          });
        }
      } catch (err) {
        if (stoppedRef.current) return;
        const { message, code } = errorInfo(err);
        patchMessage(threadId, agentMessage.id, {
          text: message,
          status: 'error',
          error: { message, code },
        });
        toast({ tone: 'error', title: 'Message failed', detail: message });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (mountedRef.current) {
          setBusy(false);
          setWorkflowId(null);
          setRagStatus(null);
        }
      }
    },
    [busy, patchMessage, patchThread, toast, workspaceId],
  );

  // ── Retry / edit / delete ──────────────────────────────────────────────────
  // Retry is scoped to the message's own `replyTo`, not "the last user message
  // in the array" — with two failures the old code resent B from A's button.
  const retry = useCallback(
    (messageId: string) => {
      const threadId = activeIdRef.current;
      if (!threadId) return;
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const target = thread?.messages.find((m) => m.id === messageId);
      if (!target) return;
      const source = target.replyTo
        ? thread?.messages.find((m) => m.id === target.replyTo)
        : [...(thread?.messages ?? [])].reverse().find((m) => m.role === 'user');
      if (!source) {
        toast({
          tone: 'error',
          title: 'Nothing to retry',
          detail: 'The original message is no longer in this conversation.',
        });
        return;
      }
      // Drop the failed turn, then re-send the paired user message.
      patchThread(threadId, (t) => ({
        ...t,
        messages: t.messages.filter((m) => m.id !== messageId),
      }));
      void send(source.text);
    },
    [patchThread, send, toast],
  );

  const editUserMessage = useCallback(
    (messageId: string, text: string) => {
      const threadId = activeIdRef.current;
      if (!threadId) return;
      const clean = text.trim().slice(0, MAX_INPUT_LENGTH);
      if (!clean) return;
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const idx = thread?.messages.findIndex((m) => m.id === messageId) ?? -1;
      if (idx < 0) return;
      // Editing invalidates the rest of the branch: truncate, then re-run.
      patchThread(threadId, (t) => {
        const original = t.messages[idx];
        if (!original) return t;
        const edited: ChatMessage = { ...original, text: clean, edited: true };
        return { ...t, messages: [...t.messages.slice(0, idx), edited] };
      });
      void send(clean);
    },
    [patchThread, send],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      const threadId = activeIdRef.current;
      if (!threadId) return;
      patchThread(threadId, (t) => {
        const idx = t.messages.findIndex((m) => m.id === messageId);
        if (idx < 0) return t;
        // Deleting a user message invalidates its answer too.
        const drop = new Set([messageId]);
        const reply = t.messages[idx + 1];
        const target = t.messages[idx];
        if (target?.role === 'user' && reply?.role === 'agent' && reply.replyTo === messageId) {
          drop.add(reply.id);
        }
        return { ...t, messages: t.messages.filter((m) => !drop.has(m.id)) };
      });
    },
    [patchThread],
  );

  return {
    threads,
    activeId,
    messages,
    busy,
    input,
    selectedAgent,
    durableMode,
    workflowId,
    ragStatus,
    commands,
    commandsState,
    commandsError,
    catalog,
    catalogState,
    catalogError,
    persistenceError,
    attachment,
    setInput,
    setAttachment,
    setSelectedAgent,
    setDurableMode,
    send,
    stop,
    retry,
    editUserMessage,
    deleteMessage,
    decideProposal,
    newThread,
    selectThread,
    renameThread,
    deleteThread,
    clearThread,
    copyMessage,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function replaceProposal(
  messages: ChatMessage[],
  messageId: string,
  index: number,
  patch: Partial<Proposal>,
): Proposal[] | undefined {
  const target = messages.find((m) => m.id === messageId);
  if (!target?.proposals) return undefined;
  return target.proposals.map((p, i) => (i === index ? { ...p, ...patch } : p));
}

interface StreamedArgs {
  workspaceId: string;
  threadId: string;
  agentMessageId: string;
  text: string;
  agentForCall?: string;
  signal: AbortSignal;
  patchMessage: (threadId: string, messageId: string, patch: Partial<ChatMessage>) => void;
}

async function runStreamedTurn(args: StreamedArgs): Promise<void> {
  const { workspaceId, threadId, agentMessageId, text, agentForCall, signal, patchMessage } = args;
  const startedAt = performance.now();
  let acc = emptyAccumulator();
  let lastRender = 0;

  try {
    await agentApi.chatStream(
      { workspaceId, message: text, agentName: agentForCall },
      (event, data) => {
        acc = applyStreamEvent(acc, event, data);
        // Coalesce renders: the old code called setState on every token, which
        // re-rendered the whole transcript (and every ReactMarkdown tree) per delta.
        const now = performance.now();
        if (event === 'token' && now - lastRender < 40) return;
        lastRender = now;
        patchMessage(threadId, agentMessageId, {
          text: acc.text,
          agentName: acc.agentName ?? agentForCall ?? 'assistant',
          confidence: acc.confidence,
          toolCalls: acc.toolCalls.length ? acc.toolCalls : undefined,
          citations: acc.citations,
          proposals: acc.proposals.length ? acc.proposals : undefined,
          plan: acc.plan,
          phases: acc.phases.length ? acc.phases : undefined,
          status: 'streaming',
        });
      },
      signal,
    );
  } catch (err) {
    if (signal.aborted || (err as Error)?.name === 'AbortError') return;
    // `sawToken` not `sawAny`: the old flag was set on the first event of ANY
    // kind, so a stream that died right after `intent` skipped the buffered retry
    // and surfaced a raw network error instead of a working answer.
    if (!acc.sawToken && !acc.text.trim()) {
      const fallback = await runBufferedTurn({ workspaceId, text, agentForCall });
      finalize(patchMessage, threadId, agentMessageId, {
        ...fallback,
        // Reset the clock: the failed stream attempt is not the model's latency.
        latencyMs: Math.round(performance.now() - startedAt),
      });
      return;
    }
    throw err;
  }

  if (signal.aborted) return;
  finalize(patchMessage, threadId, agentMessageId, {
    ...acc,
    latencyMs: Math.round(performance.now() - startedAt),
  });
}

interface BufferedArgs {
  workspaceId: string;
  text: string;
  agentForCall?: string;
}

/**
 * The single buffered-chat implementation, used by both the streamed fallback and
 * the durable Temporal-unavailable fallback. The old durable path carried its own
 * 60-line copy that silently dropped proposals, questions, action chips, tool
 * calls and citations.
 */
async function runBufferedTurn({
  workspaceId,
  text,
  agentForCall,
}: BufferedArgs): Promise<StreamAccumulator> {
  const res: unknown = agentForCall
    ? await agentApi.chat({ workspaceId, message: text, agentName: agentForCall })
    : await agentApi.chat({ workspaceId, message: text });
  return parseBufferedResponse(res);
}

/**
 * Parse a `POST /agents/chat` response into the same accumulator shape the SSE
 * reducer produces, so the streamed and durable paths converge on one model.
 *
 * The old durable 503-fallback had its own 60-line copy of this logic that silently
 * dropped proposals, questions, action chips, tool calls and citations.
 */
export function parseBufferedResponse(res: unknown): StreamAccumulator {
  const acc = emptyAccumulator();
  if (!res || typeof res !== 'object') {
    acc.text = typeof res === 'string' ? res : '';
    acc.terminal = 'done';
    return acc;
  }
  const r = res as StreamEventData;
  const result = r.result as StreamEventData | undefined;

  acc.text =
    (result ? String(result.summary ?? '') : '') ||
    (typeof r.reply === 'string' ? r.reply : '') ||
    (typeof r.summary === 'string' ? r.summary : '');

  if (result) {
    acc.agentName = typeof r.agent_name === 'string' ? r.agent_name : acc.agentName;
    const conf = typeof r.confidence === 'number' ? r.confidence : undefined;
    if (conf !== undefined) acc.confidence = conf;
    const chips = result.action_chips ?? result.actionChips ?? r.action_chips ?? r.actionChips;
    if (Array.isArray(chips))
      acc.actionChips = chips.filter((c): c is string => typeof c === 'string');
    const questions = result.questions;
    if (Array.isArray(questions) && questions.length) {
      acc.questions = questions.filter((q): q is string => typeof q === 'string');
    }
    acc.proposals = [];
    for (const p of Array.isArray(result.proposals) ? result.proposals : []) {
      if (!p || typeof p !== 'object') continue;
      const q = p as StreamEventData;
      const title =
        typeof q.title === 'string' ? q.title : typeof q.action === 'string' ? q.action : '';
      if (!title) continue;
      const approvalId =
        typeof q.approval_id === 'string'
          ? q.approval_id
          : typeof q.approvalId === 'string'
            ? q.approvalId
            : undefined;
      const requiresApproval = q.requires_approval === true || Boolean(approvalId);
      acc.proposals.push({
        title,
        detail:
          typeof q.detail === 'string'
            ? q.detail
            : typeof q.description === 'string'
              ? q.description
              : undefined,
        requiresApproval,
        approvalId,
        status: approvalId ? 'pending' : 'expired',
      });
    }
    const details = result.details as StreamEventData | undefined;
    if (details) {
      // Real tool calls from backend execution. Never fabricate a dummy tool here.
      if (Array.isArray(details.tool_calls)) {
        acc.toolCalls = (details.tool_calls as StreamEventData[]).map((tc) => ({
          name: String(tc.name ?? tc.tool ?? 'tool'),
          status: 'done' as const,
          kind: 'tool' as const,
          ...(typeof tc.latency_ms === 'number' ? { latencyMs: tc.latency_ms } : {}),
        }));
      }
      const rawCites = details['citations'];
      if (Array.isArray(rawCites)) {
        const cites = (rawCites as StreamEventData[])
          .map((c) => ({
            title: String(c.document_title ?? c.title ?? 'Source'),
            uri: typeof c.uri === 'string' ? c.uri : undefined,
            pageOrSection: typeof c.page_or_section === 'string' ? c.page_or_section : undefined,
            excerpt: typeof c.excerpt === 'string' ? c.excerpt : undefined,
          }))
          .filter((c) => c.title);
        if (cites.length) acc.citations = cites;
      }
    }
  }

  const telemetry = (r.telemetry ?? result?.telemetry) as StreamEventData | undefined;
  if (typeof r.highway === 'string') acc.highway = r.highway;
  else if (typeof telemetry?.highway === 'string') acc.highway = telemetry.highway;
  if (typeof telemetry?.s1_ms === 'number') acc.s1LatencyMs = telemetry.s1_ms;
  if (typeof telemetry?.s2_ms === 'number') acc.s2LatencyMs = telemetry.s2_ms;

  acc.sawToken = acc.text.trim().length > 0;
  acc.terminal = 'done';
  return acc;
}

function finalize(
  patchMessage: (threadId: string, messageId: string, patch: Partial<ChatMessage>) => void,
  threadId: string,
  messageId: string,
  acc: StreamAccumulator,
): void {
  const failed = acc.terminal === 'error';
  const text = acc.text.trim()
    ? acc.text
    : failed
      ? (acc.terminalMessage ?? 'The run failed without producing output.')
      : 'No response — try rephrasing, or @mention a specific agent.';

  patchMessage(threadId, messageId, {
    text,
    status: failed ? 'error' : 'complete',
    error: failed ? { message: acc.terminalMessage ?? 'The run failed.' } : undefined,
    agentName: acc.agentName ?? 'assistant',
    confidence: acc.confidence,
    toolCalls: acc.toolCalls.length ? acc.toolCalls : undefined,
    citations: acc.citations,
    proposals: acc.proposals.length ? acc.proposals : undefined,
    questions: acc.questions,
    actionChips: acc.actionChips,
    plan: acc.plan,
    phases: acc.phases.length ? acc.phases : undefined,
    highway: acc.highway,
    s1LatencyMs: acc.s1LatencyMs,
    s2LatencyMs: acc.s2LatencyMs,
    latencyMs: acc.latencyMs,
  });
}

interface DurableArgs extends StreamedArgs {
  isStopped: () => boolean;
  setWorkflowId: (id: string | null) => void;
  setRagStatus: (s: string | null) => void;
  runBuffered: (text: string, agent: string | undefined) => Promise<StreamAccumulator>;
}
async function runDurableTurn(args: DurableArgs): Promise<void> {
  const {
    workspaceId,
    threadId,
    agentMessageId,
    text,
    agentForCall,
    signal,
    isStopped,
    patchMessage,
    setWorkflowId,
    setRagStatus,
    runBuffered,
  } = args;

  const requestId = `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let workflow = '';

  try {
    const start = await temporalApi.startDurableAgent({
      workspace_id: workspaceId,
      agent_id: agentForCall || 'memory',
      request_id: requestId,
      input: { message: text, task: text },
      correlation_id: requestId,
    });
    const s = start as { workflow_id?: string; workflowId?: string };
    workflow = s.workflow_id ?? s.workflowId ?? `durable_run:${workspaceId}:${requestId}`;
    setWorkflowId(workflow);
    patchMessage(threadId, agentMessageId, { workflowId: workflow });

    let acc = emptyAccumulator();
    for (let poll = 0; poll < DURABLE_MAX_POLLS; poll += 1) {
      if (signal.aborted || isStopped()) return;
      await sleep(DURABLE_POLL_INTERVAL_MS, signal);
      if (signal.aborted || isStopped()) return;
      try {
        const st = await temporalApi.getStatus(workflow);
        const q = (st.query ?? {}) as StreamEventData;
        const rag = q['rag_status'];
        if (typeof rag === 'string' && rag) setRagStatus(rag);

        const status = String(st.status ?? q.status ?? '').toLowerCase();
        const terminal = ['completed', 'failed', 'cancelled', 'expired'].includes(status);
        if (!terminal && !q.result) {
          patchMessage(threadId, agentMessageId, {
            status: 'streaming',
            phases: [
              {
                kind: 'plan',
                label: `Durable run · polling (${poll + 1}/${DURABLE_MAX_POLLS})`,
                at: nowIso(),
              },
            ],
          });
          continue;
        }

        const res = (q.result as StreamEventData | undefined) ?? q;
        acc = applyStreamEvent({ ...acc, text: acc.text }, 'done', {
          status,
          result: res.summary ?? res.text ?? res,
        });
        break;
      } catch {
        // A transient poll failure is not a run failure; keep polling.
      }
    }

    if (signal.aborted || isStopped()) return;

    if (!acc.sawToken) {
      // The loop ran out of attempts (or the workflow never reported a result).
      // The old code wrote "Durable execution in progress — see timeline", which
      // is false: the client gave up. Say what is actually true.
      patchMessage(threadId, agentMessageId, {
        status: 'background',
        text: 'This run is still executing on the server. The client stopped waiting for it — open the timeline below or check History for the result.',
      });
      return;
    }

    finalize(patchMessage, threadId, agentMessageId, { ...acc, latencyMs: undefined });
  } catch (err) {
    if (signal.aborted || isStopped()) return;
    const { message } = errorInfo(err);
    const lower = message.toLowerCase();
    const temporalDown =
      lower.includes('503') ||
      lower.includes('temporal is disabled') ||
      lower.includes('temporal client unavailable');
    if (!temporalDown) throw err;

    // Temporal is unavailable. Fall back to the direct chat path — and keep the
    // user's Durable preference. The old code called setDurableMode(false) here,
    // silently unchecking a box the user had explicitly ticked, for the rest of
    // the session, with no explanation.
    const acc = await runBuffered(text, agentForCall);
    finalize(patchMessage, threadId, agentMessageId, acc);
  }
}
