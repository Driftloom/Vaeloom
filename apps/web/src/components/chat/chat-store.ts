'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
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
  ConversationApi,
  conversationsKey,
  messageToCreate,
  normaliseOnRead,
  recordToMessage,
  type ConversationListPage,
  type MessageCreate,
} from './conversation-api';
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
  type ChatTab,
  type ModelOption,
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
 * ## The server is the source of truth
 *
 * The transcript used to live only in `localStorage['vaeloom.threads.<ws>']` —
 * plaintext PII (resumes, salary figures, pasted job descriptions) with no
 * workspace boundary, no cross-device access and no survival past "clear site
 * data". `lib/api.ts` removed auth tokens from `localStorage` on exactly those
 * grounds; the transcript was the larger prize and got no equivalent treatment.
 * It is now loaded from and written to the API, and localStorage survives only
 * for two honest reasons: a one-time migration of pre-existing history, and the
 * write-behind queue of messages that have NOT yet reached the server.
 *
 * Every write is optimistic and then reconciled. Nothing is dropped silently:
 * a message write that fails stays queued and is reported as unsynced, and a
 * destructive mutation that fails is rolled back and reported.
 *
 * ## Honesty
 *
 * No fabricated telemetry. `confidence` comes from the wire or is absent.
 * `ToolCall.latencyMs` comes from the wire or is absent. When the durable poll
 * loop runs out of attempts we say the run is still live server-side, because
 * that is the truth — the old code said "in progress" when the client had simply
 * given up. Symmetrically, "saved" is only ever claimed for writes the server
 * confirmed.
 */

const DEFAULT_MODELS: ModelOption[] = [
  {
    id: 'gemma4:31b',
    name: 'Ollama Cloud Gemma 4 31B',
    provider: 'ollama',
    tier: 'balanced',
    maxTokens: 32768,
    isDefault: true,
    status: 'ready',
    systemRole: 'system2',
    isPlatformManaged: true,
    badge: '🟢 Platform Active (System 2)',
    description: 'Enterprise generative synthesis with XML context fencing & citation grounding.',
  },
  {
    id: 'typesafe-ai/jev',
    name: 'TypeSafe AI Jev',
    provider: 'typesafe',
    tier: 'fast',
    maxTokens: 8192,
    status: 'ready',
    systemRole: 'system1',
    isPlatformManaged: true,
    badge: '⚡ System 1 Highway (<50ms)',
    description: 'Sub-50ms deterministic action routing & semantic similarity scoring.',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'Groq GPT-OSS 120B',
    provider: 'groq',
    tier: 'fast',
    maxTokens: 131072,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    status: 'ready',
    systemRole: 'system2',
    isPlatformManaged: true,
    badge: '🟢 Platform Active',
    description: 'Ultra-low-latency LPU inference for high-speed agentic execution.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'google',
    tier: 'fast',
    maxTokens: 1000000,
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    status: 'ready',
    systemRole: 'system2',
    isPlatformManaged: true,
    badge: '🟢 Platform Active',
    description: '1M token long-context processing for large document corpora.',
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    tier: 'powerful',
    maxTokens: 128000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    status: 'byok_required',
    systemRole: 'byok',
    isPlatformManaged: false,
    badge: '🔑 BYOK Required',
    description: 'Requires your OpenAI API Key. Configure in Workspace Settings > BYOK.',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    tier: 'powerful',
    maxTokens: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    status: 'byok_required',
    systemRole: 'byok',
    isPlatformManaged: false,
    badge: '🔑 BYOK Required',
    description: 'Requires your Anthropic API Key. Configure in Workspace Settings > BYOK.',
  },
];

const EMPTY_MESSAGES: ChatMessage[] = [];

/** Write-behind debounce. Long enough to coalesce a burst, short enough to feel immediate. */
const PERSIST_DEBOUNCE_MS = 400;
const RETRY_MAX_MS = 30_000;
/**
 * Hard ceiling on unacknowledged writes per workspace.
 *
 * The outbox holds only server-unconfirmed messages, which is what makes keeping
 * it in localStorage defensible. But "only unconfirmed" is a statement about
 * *scope*, not about *size*: with the API unreachable, a long offline session
 * enqueues one entry per terminal message and the queue — plus its localStorage
 * mirror — grows until the storage quota throws, which surfaces as a generic
 * sync error rather than anything actionable.
 *
 * When the cap is hit the OLDEST pending write is evicted: recent messages are
 * the ones a user would still expect to see land, and an evicted entry is
 * surfaced as a sync error so the loss is disclosed rather than silent.
 */
const MAX_PENDING_WRITES = 200;

/** Pre-server era key. Read once for the migration, cleared only on a confirmed upload. */
const legacyThreadsKey = (workspaceId: string): string => `vaeloom.threads.${workspaceId}`;
/** Versioned so the migration runs exactly once per workspace, and only on success. */
const migratedMarkerKey = (workspaceId: string): string => `vaeloom.chat.migrated.${workspaceId}`;
/**
 * Write-behind queue. Holds *only* messages the server has not confirmed, which
 * is what makes keeping it in localStorage defensible: it is a bounded,
 * disclosed outbox rather than a second copy of the transcript.
 */
const pendingKey = (workspaceId: string): string => `vaeloom.chat.pending.${workspaceId}`;

export type MigrationState =
  | { state: 'idle' }
  | { state: 'running'; uploaded: number; total: number }
  | { state: 'done'; uploaded: number; total: number }
  | { state: 'failed'; uploaded: number; total: number; error: string };

interface PendingWrite {
  conversationId: string;
  body: MessageCreate;
  attempts: number;
  lastError?: string;
}

/** A message is worth persisting once it can no longer change on its own. */
function isTerminalStatus(status: ChatMessage['status']): boolean {
  return status !== 'streaming';
}

let idCounter = 0;
/** Distinguishes a locally-generated id from a server UUID, which is what routes require. */
const LOCAL_ID_PREFIX = 'th_';
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

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Private browsing or a disabled storage partition.
    return null;
  }
}

/** Reads must never throw into a render. */
function readPending(workspaceId: string): PendingWrite[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(pendingKey(workspaceId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is PendingWrite => {
      if (typeof p !== 'object' || p === null) return false;
      const entry = p as Partial<PendingWrite>;
      return typeof entry.conversationId === 'string' && typeof entry.body === 'object';
    });
  } catch {
    return [];
  }
}

function writePending(workspaceId: string, pending: PendingWrite[]): string | null {
  const store = safeStorage();
  if (!store) return 'This browser blocked local storage, so unsynced messages cannot be retried.';
  try {
    if (pending.length === 0) store.removeItem(pendingKey(workspaceId));
    else store.setItem(pendingKey(workspaceId), JSON.stringify(pending));
    return null;
  } catch {
    return 'Local storage rejected the unsynced-message queue.';
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
  /** Set when history cannot be persisted to the server. Surfaced, never swallowed. */
  persistenceError: string | null;
  /** File staged in the composer, not yet uploaded. */
  attachment: File | null;
  // ── additive, so `ChatWindow.tsx` keeps compiling without edits ──────────────
  /** Server-side load state for the conversation list. */
  conversationsState: LoadState;
  conversationsError?: string;
  /** Messages written locally that the server has not confirmed. */
  unsyncedCount: number;
  /** Last sync failure, or `null` when nothing is outstanding. */
  syncError: string | null;
  /** `navigator.onLine === false`. Distinct from "the API rejected a write". */
  isOffline: boolean;
  /** One-time upload of pre-server history. */
  migration: MigrationState;
  /** Force a re-read of the conversation list. */
  reload: () => Promise<void>;
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
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  availableModels: ModelOption[];
  modelsLoading: boolean;
  selectedSquad: string[];
  setSelectedSquad: (v: string[]) => void;
  toggleSquadAgent: (agentName: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  activeTab: ChatTab;
  setActiveTab: (v: ChatTab) => void;
  pinMessageToMemory: (messageId: string) => Promise<boolean>;
  isCompacting: boolean;
  compactThreadHistory: () => Promise<boolean>;
  isMemoryDrawerOpen: boolean;
  setIsMemoryDrawerOpen: (v: boolean) => void;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingWrite[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [migration, setMigration] = useState<MigrationState>({ state: 'idle' });
  const [localOnlyNotice, setLocalOnlyNotice] = useState<string | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>('gemma4:31b');
  const [selectedSquad, setSelectedSquad] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [activeTab, setActiveTab] = useState<ChatTab>('stream');
  const [isMemoryDrawerOpen, setIsMemoryDrawerOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const selectedSquadRef = useRef(selectedSquad);
  selectedSquadRef.current = selectedSquad;
  const temperatureRef = useRef(temperature);
  temperatureRef.current = temperature;

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
  const attachmentRef = useRef<File | null>(null);
  // `stop` is memoised on stable deps, so reading `workflowId` from its closure
  // returned the value from the very first render — always null — and the durable
  // cancellation was never issued.
  const workflowIdRef = useRef<string | null>(null);

  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;
  /** Local thread id → server conversation id. Identity entries are harmless. */
  const idMapRef = useRef<Map<string, string>>(new Map());
  const inflightCreateRef = useRef<Map<string, Promise<string | null>>>(new Map());
  /** Conversations whose transcript has been read this session. */
  const loadedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<PendingWrite[]>([]);
  const flushingRef = useRef(false);
  const offlineRef = useRef(false);
  const mutateListRef = useRef<(() => Promise<unknown>) | null>(null);
  const migrationStartedRef = useRef(false);

  // `threadsRef` and `pendingRef` are updated synchronously by the writers below, not
  // during render. Assigning them from render left them one commit behind the state,
  // which meant a streamed turn's terminal patch could not find the message it was
  // patching and the turn was never queued for the server. The async send pipeline
  // reads these refs, so they have to be current the moment the write happens.
  activeIdRef.current = activeId;
  inputRef.current = input;
  selectedRef.current = selectedAgent;
  durableRef.current = durableMode;
  attachmentRef.current = attachment;
  workflowIdRef.current = workflowId;
  selectedModelRef.current = selectedModel;
  selectedSquadRef.current = selectedSquad;
  temperatureRef.current = temperature;
  offlineRef.current =
    isOffline || (typeof navigator !== 'undefined' && navigator.onLine === false);

  /** Single writer for `threads`: React state and the sync mirror move together. */
  const commitThreads = useCallback((updater: (prev: Thread[]) => Thread[]) => {
    const next = updater(threadsRef.current);
    threadsRef.current = next;
    setThreads(next);
  }, []);

  /** Single writer for the outbox, for the same reason. */
  const commitPending = useCallback((updater: (prev: PendingWrite[]) => PendingWrite[]) => {
    const next = updater(pendingRef.current);
    pendingRef.current = next;
    setPending(next);
  }, []);

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

  // ── The conversation list (SWR — server is the source of truth) ─────────────
  // The fetcher rejects rather than `.catch(() => [])`: an empty list returned
  // for a failed request would make the store report "no history" as fact, and
  // would also make the migration fire against a workspace that already has data.
  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate: mutateList,
  } = useSWR<ConversationListPage, Error>(
    workspaceId ? conversationsKey(workspaceId) : null,
    async () => {
      const res = await ConversationApi.list(workspaceId, { pageSize: MAX_THREADS });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    { revalidateOnFocus: false },
  );
  mutateListRef.current = mutateList;

  const conversationsState: LoadState = listError
    ? 'error'
    : listData
      ? 'ready'
      : listLoading || !workspaceId
        ? 'loading'
        : 'ready';
  const conversationsError = listError?.message;
  const serverTotal = listData?.total ?? 0;

  useEffect(() => {
    setLoadError(listError ? listError.message : null);
  }, [listError]);

  const serverIdFor = useCallback(
    (localId: string): string => idMapRef.current.get(localId) ?? localId,
    [],
  );

  /**
   * True once the conversation exists on the server and has a real UUID.
   *
   * `serverIdFor` falls back to the local id, which is `th_<n>_<rand>` and NOT a
   * UUID. Sending that to a route typed `conversation_id: uuid.UUID` yields a 422,
   * which the delete/clear paths would then surface as "not saved" and roll back —
   * so deleting a conversation the user just created, before it had synced, would
   * appear to fail. Local ids are recognised by their prefix instead of guessed at.
   */
  const isServerBacked = useCallback((localId: string): boolean => {
    const mapped = idMapRef.current.get(localId);
    if (mapped) return true;
    return !localId.startsWith(LOCAL_ID_PREFIX);
  }, []);

  // ── The only writer ────────────────────────────────────────────────────────
  const patchThread = useCallback(
    (id: string, fn: (t: Thread) => Thread) => {
      const target = serverIdFor(id);
      commitThreads((prev) =>
        prev.map((t) => (t.id === id || t.id === target ? { ...fn(t), updatedAt: nowIso() } : t)),
      );
    },
    [commitThreads, serverIdFor],
  );

  /**
   * Swap a provisional local id for the server's. The local id is what the UI
   * and the send pipeline hold, so every holder is rewritten at once: the rail,
   * `activeId` and the outbox. Identity entries (`server → server`) make the
   * lookup idempotent, so a second remap is a no-op.
   */
  const remapThreadId = useCallback(
    (from: string, to: string) => {
      idMapRef.current.set(to, to);
      idMapRef.current.set(from, to);
      commitThreads((prev) => prev.map((t) => (t.id === from ? { ...t, id: to } : t)));
      activeIdRef.current = activeIdRef.current === from ? to : activeIdRef.current;
      setActiveId((cur) => (cur === from ? to : cur));
      commitPending((prev) =>
        prev.map((p) => (p.conversationId === from ? { ...p, conversationId: to } : p)),
      );
    },
    [commitPending, commitThreads],
  );

  /**
   * Resolve a local thread id to a server conversation, creating the row if it does
   * not exist yet. `seed` covers the case where the thread has not rendered yet —
   * without it a `newThread` immediately followed by a create would find nothing in
   * `threadsRef` and silently skip the row.
   */
  const ensureServerThread = useCallback(
    async (
      localId: string,
      seed?: { title?: string; agentName?: string },
    ): Promise<string | null> => {
      const mapped = idMapRef.current.get(localId);
      if (mapped) return mapped;
      if (!localId.startsWith('th_') && !localId.startsWith('th-')) {
        idMapRef.current.set(localId, localId);
        return localId;
      }
      const inflight = inflightCreateRef.current.get(localId);
      if (inflight) return inflight;
      const local = threadsRef.current.find((t) => t.id === localId);
      const title = seed?.title ?? local?.title;
      const agentName = seed?.agentName ?? local?.agentName;
      if (!local && !seed) return null;

      const task = (async () => {
        const res = await ConversationApi.create(workspaceIdRef.current, {
          ...(title ? { title } : {}),
          ...(agentName ? { agentName } : {}),
        });
        if (!res.ok) {
          setSyncError((prev) => prev ?? res.error);
          return null;
        }
        remapThreadId(localId, res.data.id);
        void mutateListRef.current?.();
        return res.data.id;
      })();
      inflightCreateRef.current.set(localId, task);
      try {
        return await task;
      } finally {
        inflightCreateRef.current.delete(localId);
      }
    },
    [remapThreadId],
  );

  /** Queue a terminal message for the write-behind outbox. Idempotent per `client_id`. */
  const queuePersist = useCallback(
    (conversationId: string, message: ChatMessage) => {
      if (!isTerminalStatus(message.status)) return;
      const target = serverIdFor(conversationId);
      const body = messageToCreate(message);
      commitPending((prev) => {
        const idx = prev.findIndex((p) => p.body.client_id === body.client_id);
        const attempts = idx >= 0 ? (prev[idx]?.attempts ?? 0) : 0;
        const entry: PendingWrite = { conversationId: target, body, attempts };
        if (idx < 0) {
          const next = [...prev, entry];
          // Editing an existing entry never grows the queue, so it can't evict.
          if (next.length <= MAX_PENDING_WRITES) return next;
          setSyncError(
            (prev) =>
              prev ??
              `${MAX_PENDING_WRITES} unsent messages queued; the oldest were dropped. Reconnect to sync the rest.`,
          );
          return next.slice(next.length - MAX_PENDING_WRITES);
        }
        const next = [...prev];
        next[idx] = entry;
        return next;
      });
    },
    [commitPending, serverIdFor],
  );

  const patchMessage = useCallback(
    (threadId: string, messageId: string, patch: Partial<ChatMessage>) => {
      const target = serverIdFor(threadId);
      const thread = threadsRef.current.find((t) => t.id === threadId || t.id === target);
      const resolvedId = thread?.id ?? target ?? threadId;
      const existing = thread?.messages.find((m) => m.id === messageId);
      const next = existing ? { ...existing, ...patch } : undefined;
      patchThread(resolvedId, (t) => ({
        ...t,
        messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
      }));
      if (next) queuePersist(resolvedId, next);
    },
    [patchThread, queuePersist, serverIdFor],
  );

  const appendToThread = useCallback(
    (threadId: string, ...msgs: ChatMessage[]) => {
      const target = serverIdFor(threadId);
      patchThread(target, (t) => ({ ...t, messages: [...t.messages, ...msgs] }));
      for (const m of msgs) queuePersist(target, m);
    },
    [patchThread, queuePersist, serverIdFor],
  );

  const toggleSquadAgent = useCallback((agentName: string) => {
    setSelectedSquad((prev) =>
      prev.includes(agentName) ? prev.filter((a) => a !== agentName) : [...prev, agentName],
    );
  }, []);

  const pinMessageToMemory = useCallback(
    async (messageId: string): Promise<boolean> => {
      const threadId = activeIdRef.current;
      if (!threadId) return false;
      const serverId = serverIdFor(threadId);
      const res = await ConversationApi.pinMessageToMemory(
        workspaceIdRef.current,
        serverId,
        messageId,
      );
      if (res.ok) {
        patchMessage(threadId, messageId, {
          isPinnedToMemory: true,
          pinnedMemoryId: res.data.id,
        });
        toast({
          tone: 'success',
          title: 'Pinned to Memory Vault',
          detail: res.data.title,
        });
        return true;
      } else {
        toast({
          tone: 'error',
          title: 'Could not pin to memory',
          detail: res.error,
        });
        return false;
      }
    },
    [patchMessage, serverIdFor, toast],
  );

  const [isCompacting, setIsCompacting] = useState<boolean>(false);

  const compactThreadHistory = useCallback(async (): Promise<boolean> => {
    const threadId = activeIdRef.current;
    if (!threadId) return false;
    const serverId = serverIdFor(threadId);
    setIsCompacting(true);
    try {
      const res = await ConversationApi.compact(workspaceIdRef.current, serverId);
      if (res.ok) {
        if (res.data.compacted) {
          const refreshed = await ConversationApi.get(workspaceIdRef.current, serverId);
          if (refreshed.ok) {
            patchThread(threadId, (t) => ({
              ...t,
              messages: refreshed.data.messages.map(recordToMessage),
            }));
          }
          toast({
            tone: 'success',
            title: 'Context Compacted',
            detail: `Historical turns summarized. Saved ~${res.data.tokensSaved ?? 0} tokens.`,
          });
          return true;
        } else {
          toast({
            tone: 'info',
            title: 'Compaction Skipped',
            detail: 'Minimum 5 turns required to compact context.',
          });
          return false;
        }
      } else {
        toast({
          tone: 'error',
          title: 'Compaction Failed',
          detail: res.error,
        });
        return false;
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Compaction Error',
        detail: (err as Error)?.message || 'Failed to compact conversation history.',
      });
      return false;
    } finally {
      setIsCompacting(false);
    }
  }, [patchThread, serverIdFor, toast]);

  useEffect(() => {
    let cancelled = false;
    if (typeof agentApi?.listModels !== 'function') {
      setModelsLoading(false);
      return;
    }
    const p = agentApi.listModels();
    if (!p || typeof p.then !== 'function') {
      setModelsLoading(false);
      return;
    }
    p.then((res) => {
      if (cancelled) return;
      if (res && Array.isArray(res.models) && res.models.length > 0) {
        setAvailableModels(res.models as ModelOption[]);
      }
    })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Derived: the transcript ────────────────────────────────────────────────
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );
  const messages = activeThread?.messages ?? EMPTY_MESSAGES;

  // ── Merge the server list into local state ─────────────────────────────────
  // Server rows own the metadata; local state owns the messages (optimistic and
  // streamed ones are not on the server yet). Threads the server has not echoed
  // are kept rather than dropped, so a create in flight does not blink out of the
  // rail.
  useEffect(() => {
    if (conversationsState !== 'ready' || !listData) return;
    // A conversation the server listed already exists. Registering the id stops
    // `ensureServerThread` from creating a second, empty row for it on the first
    // write — and that would have split one transcript across two conversations.
    for (const item of listData.conversations) idMapRef.current.set(item.id, item.id);
    commitThreads((prev) => {
      if (prev.length === 0) {
        return listData.conversations.slice(0, MAX_THREADS).map((item) => ({
          id: item.id,
          title: item.title,
          ...(item.agentName ? { agentName: item.agentName } : {}),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          messages: [] as ChatMessage[],
        }));
      }
      const known = new Map(prev.map((t) => [t.id, t]));
      const merged = listData.conversations.slice(0, MAX_THREADS).map((item) => {
        const existing = known.get(item.id);
        known.delete(item.id);
        return {
          id: item.id,
          title: item.title,
          ...(item.agentName ? { agentName: item.agentName } : {}),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          messages: existing?.messages ?? [],
        };
      });
      return [...known.values(), ...merged].slice(0, MAX_THREADS);
    });
  }, [conversationsState, listData, commitThreads]);

  useEffect(() => {
    if (threads.length === 0) return;
    setActiveId((cur) => {
      if (cur && threads.some((t) => t.id === cur)) return cur;
      const first = threads[0];
      return first ? first.id : null;
    });
  }, [threads]);

  // ── Transcript read ────────────────────────────────────────────────────────
  const loadMessages = useCallback(
    async (conversationId: string) => {
      // Set before the await so a rapid thread switch cannot fire two reads of
      // the same conversation; a failure clears it so the next visit retries.
      if (loadedRef.current.has(conversationId)) return;
      loadedRef.current.add(conversationId);
      const res = await ConversationApi.get(workspaceIdRef.current, conversationId);
      if (!mountedRef.current) return;
      if (!res.ok) {
        if (!res.aborted) {
          loadedRef.current.delete(conversationId);
          setLoadError((prev) => prev ?? `Could not load this conversation: ${res.error}`);
        }
        return;
      }
      // A message still marked `streaming` was persisted by a tab that closed
      // mid-run. Nothing is producing tokens now, so it is normalised on read —
      // the same rule the old localStorage hydration applied.
      const loaded = res.data.messages.map((r) => normaliseOnRead(recordToMessage(r)));
      // Anything written locally while the read was in flight survives: a read must
      // not discard an optimistic message the user is looking at.
      const local = threadsRef.current.find((t) => t.id === conversationId)?.messages ?? [];
      const fromServer = new Set(loaded.map((m) => m.id));
      const extra = local.filter((m) => !fromServer.has(m.id));
      patchThread(conversationId, (t) => ({
        ...t,
        title: res.data.conversation.title || t.title,
        updatedAt: res.data.conversation.updatedAt || t.updatedAt,
        messages: [...loaded, ...extra].slice(-MAX_MESSAGES_PER_THREAD),
      }));
    },
    [patchThread],
  );

  useEffect(() => {
    if (!activeId) return;
    // Never let a read clobber writes that have not reached the server yet.
    if (pendingRef.current.some((p) => serverIdFor(p.conversationId) === activeId)) return;
    void loadMessages(activeId);
  }, [activeId, loadMessages, serverIdFor]);

  // ── Write-behind flush ─────────────────────────────────────────────────────
  const markFailed = useCallback(
    (clientId: string, message: string) => {
      commitPending((prev) =>
        prev.map((p) =>
          p.body.client_id === clientId
            ? { ...p, attempts: p.attempts + 1, lastError: message }
            : p,
        ),
      );
      setSyncError((prev) => prev ?? message);
    },
    [commitPending],
  );

  /**
   * Drain the outbox.
   *
   * A retried POST is safe because `client_id` is the server's idempotency key, so
   * a message that landed before the failure is not duplicated by the retry.
   */
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    if (offlineRef.current || (typeof navigator !== 'undefined' && navigator.onLine === false))
      return;
    const batch = pendingRef.current;
    if (batch.length === 0) return;
    flushingRef.current = true;
    try {
      for (const entry of batch) {
        if (!mountedRef.current) break;
        const serverId = await ensureServerThread(entry.conversationId);
        if (!serverId) {
          markFailed(entry.body.client_id, 'Could not create the conversation on the server.');
          continue;
        }
        const res = await ConversationApi.appendMessage(
          workspaceIdRef.current,
          serverId,
          entry.body,
        );
        if (!res.ok) {
          if (!res.aborted) markFailed(entry.body.client_id, res.error);
          continue;
        }
        commitPending((prev) => prev.filter((p) => p.body.client_id !== entry.body.client_id));
        // Reconcile: the server's row is authoritative for ids and timestamps.
        patchThread(serverId, (t) => ({
          ...t,
          messages: t.messages.map((m) =>
            m.id === res.data.clientId ? recordToMessage(res.data) : m,
          ),
        }));
      }
      if (mountedRef.current) void mutateListRef.current?.();
    } finally {
      flushingRef.current = false;
    }
  }, [commitPending, ensureServerThread, markFailed, patchThread]);

  /** A dropped message must not be resurrected by a retry of its queued POST. */
  const dropPending = useCallback(
    (clientId: string) => {
      commitPending((prev) => prev.filter((p) => p.body.client_id !== clientId));
    },
    [commitPending],
  );

  // A closed tab must not lose an in-flight message: rehydrate the outbox so the
  // retry survives a reload, not just an in-session failure.
  useEffect(() => {
    commitPending(() => readPending(workspaceId).map((p) => ({ ...p, attempts: 0 })));
  }, [commitPending, workspaceId]);

  // Mirror the queue into localStorage so an unsynced message survives a tab
  // close. This is the only transcript-shaped thing left in storage, and each entry
  // is removed the moment the server confirms it.
  useEffect(() => {
    const problem = writePending(workspaceId, pending);
    if (problem) setSyncError((prev) => prev ?? problem);
  }, [pending, workspaceId]);

  useEffect(() => {
    if (pending.length === 0) return;
    const worst = pending.reduce((max, p) => Math.max(max, p.attempts), 0);
    // First attempt is the debounce; later attempts back off so a down server is
    // not hammered once every 400ms for as long as the tab is open.
    const delay = Math.min(RETRY_MAX_MS, PERSIST_DEBOUNCE_MS * 2 ** worst);
    const handle = setTimeout(() => void flushPending(), delay);
    return () => clearTimeout(handle);
  }, [pending, flushPending]);

  // "Saved" is only claimed for a confirmed write, so the error clears when the
  // queue drains — never on a timer.
  useEffect(() => {
    if (pending.length === 0 && !isOffline) setSyncError(null);
  }, [pending.length, isOffline]);

  useEffect(() => {
    const onOnline = () => {
      offlineRef.current = false;
      setIsOffline(false);
      commitPending((prev) => prev.map((p) => ({ ...p, attempts: 0, lastError: undefined })));
    };
    const onOffline = () => {
      offlineRef.current = true;
      setIsOffline(true);
    };
    const initial = typeof navigator !== 'undefined' && navigator.onLine === false;
    offlineRef.current = initial;
    setIsOffline(initial);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [commitPending]);

  /**
   * Flush on the way out.
   *
   * `visibilitychange → hidden` is the only event iOS Safari reliably fires before
   * a tab is discarded, so it is the one that matters. A message still streaming is
   * sent with `status: 'streaming'` — that is what was true — and the read path
   * normalises it. `keepalive` lets the POST outlive the document. Best effort
   * only: the page is going away and there is nobody left to report to.
   */
  useEffect(() => {
    const onHide = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return;
      const outgoing = [...pendingRef.current];
      for (const thread of threadsRef.current) {
        for (const m of thread.messages) {
          if (m.status !== 'streaming') continue;
          if (outgoing.some((p) => p.body.client_id === m.id)) continue;
          outgoing.push({ conversationId: thread.id, body: messageToCreate(m), attempts: 0 });
        }
      }
      for (const entry of outgoing) {
        const target = idMapRef.current.get(entry.conversationId) ?? entry.conversationId;
        void ConversationApi.appendMessage(workspaceIdRef.current, target, entry.body, {
          keepalive: true,
        });
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // ── One-time migration of pre-server history ───────────────────────────────
  const runMigration = useCallback(async () => {
    const store = safeStorage();
    const ws = workspaceIdRef.current;
    if (!store) return;
    const raw = store.getItem(legacyThreadsKey(ws));
    if (!raw) {
      setMigration({ state: 'done', uploaded: 0, total: 0 });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt payload — nothing to upload, so do not leave a marker claiming a
      // migration that never happened.
      setMigration({ state: 'done', uploaded: 0, total: 0 });
      return;
    }
    const legacy = (Array.isArray(parsed) ? parsed : [])
      .filter((t): t is Thread => {
        if (typeof t !== 'object' || t === null) return false;
        const thread = t as Partial<Thread>;
        return typeof thread.id === 'string' && Array.isArray(thread.messages);
      })
      .slice(0, MAX_THREADS);
    if (legacy.length === 0) {
      setMigration({ state: 'done', uploaded: 0, total: 0 });
      return;
    }

    const total = legacy.reduce((sum, t) => sum + t.messages.length, 0);
    let uploaded = 0;
    let failure: string | null = null;
    setMigration({ state: 'running', uploaded, total });

    for (const thread of legacy) {
      if (failure) break;
      const created = await ConversationApi.create(ws, {
        ...(thread.title ? { title: thread.title } : {}),
        ...(thread.agentName ? { agentName: thread.agentName } : {}),
      });
      if (!created.ok) {
        failure = created.error;
        break;
      }
      const conversationId = created.data.id;
      for (const message of thread.messages) {
        // Local ids are already the `client_id`s, so a retried upload de-duplicates.
        const saved = await ConversationApi.appendMessage(ws, conversationId, {
          ...messageToCreate(message),
          client_id: message.id,
        });
        if (!saved.ok) {
          failure = saved.error;
          break;
        }
        uploaded += 1;
        setMigration({ state: 'running', uploaded, total });
      }
    }

    if (failure) {
      // Deliberately no `removeItem` and no marker: the key stays so the next load
      // retries, and the client_id idempotency means the rows that did land are
      // not duplicated by the retry.
      setMigration({ state: 'failed', uploaded, total, error: failure });
      return;
    }
    store.removeItem(legacyThreadsKey(ws));
    store.setItem(migratedMarkerKey(ws), new Date().toISOString());
    setMigration({ state: 'done', uploaded, total });
    void mutateListRef.current?.();
  }, []);

  useEffect(() => {
    if (migrationStartedRef.current) return;
    if (conversationsState !== 'ready') return;
    // Only when the server reports zero real conversation history. A workspace
    // that already has active conversations is not migrated, or the upload would
    // duplicate real history.
    const hasRealHistory = listData?.conversations.some((c) => (c.messageCount ?? 0) > 0);
    if (hasRealHistory) return;
    const store = safeStorage();
    if (!store) return;
    if (store.getItem(migratedMarkerKey(workspaceId)) !== null) return;
    migrationStartedRef.current = true;
    void runMigration();
  }, [conversationsState, listData, workspaceId, runMigration]);

  // ── The one honest error channel ───────────────────────────────────────────
  const persistenceError = useMemo(() => {
    if (localOnlyNotice) return localOnlyNotice;
    if (pending.length > 0) {
      const noun = pending.length === 1 ? 'message is' : 'messages are';
      const head = isOffline
        ? `Offline — ${pending.length} ${noun} saved on this device only and not yet sent to the server.`
        : `Sync problem — ${pending.length} ${noun} saved on this device but not confirmed by the server.`;
      const detail = syncError ? ` Last error: ${syncError}` : '';
      return `${head} They will be sent automatically once the connection recovers.${detail}`;
    }
    if (loadError) return `Chat history could not be read from the server. ${loadError}`;
    if (migration.state === 'failed') {
      return `Uploading your old chat history failed after ${migration.uploaded} of ${migration.total} messages. The old data is still on this device and will be retried. (${migration.error})`;
    }
    // A rename, delete or clear the server refused. The store rolled it back, and
    // saying so is the difference between "it failed" and "nothing happened".
    if (syncError) return `The last change was not saved to the server: ${syncError}`;
    return null;
  }, [pending.length, isOffline, syncError, localOnlyNotice, loadError, migration]);

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

  const reload = useCallback(async () => {
    await mutateListRef.current?.();
  }, []);

  // ── Thread operations ──────────────────────────────────────────────────────
  const newThread = useCallback(
    (opts?: { agent?: string; seedInput?: string }) => {
      const agent = opts?.agent;
      const id = nextId('th');
      const title = opts?.seedInput
        ? opts.seedInput.slice(0, 40)
        : agent && agent !== 'auto'
          ? `${agent} chat`
          : 'New conversation';
      const agentName = agent && agent !== 'auto' ? agent : undefined;
      const thread: Thread = {
        id,
        title,
        ...(agentName ? { agentName } : {}),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        messages: [],
      };
      activeIdRef.current = id;
      setActiveId(id);
      commitThreads((p) => [thread, ...p].slice(0, MAX_THREADS));
      if (agent) setSelectedAgent(agent);
      if (opts?.seedInput) setInput(opts.seedInput);
      // The row is created up front so the thread exists server-side from the
      // moment the user sees it, rather than only once a message needs an id.
      void ensureServerThread(id, { title, ...(agentName ? { agentName } : {}) });
    },
    [commitThreads, ensureServerThread],
  );

  const selectThread = useCallback((id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const renameThread = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().slice(0, 80);
      if (!clean) return;
      const previous = threadsRef.current.find((t) => t.id === id)?.title;
      patchThread(id, (t) => ({ ...t, title: clean }));
      const serverId = serverIdFor(id);
      void ConversationApi.rename(workspaceIdRef.current, serverId, clean).then((res) => {
        if (!mountedRef.current) return;
        if (res.ok) {
          patchThread(serverId, (t) => ({ ...t, title: res.data.title }));
          void mutateListRef.current?.();
          return;
        }
        if (res.aborted) return;
        // Roll back: a rename the user saw succeed but that never landed is worse
        // than an explicit failure.
        if (previous) patchThread(id, (t) => ({ ...t, title: previous }));
        setSyncError(`Rename not saved: ${res.error}`);
        toast({
          tone: 'error',
          title: 'Rename failed',
          detail: `${res.error} The title was not changed.`,
        });
      });
    },
    [patchThread, serverIdFor, toast],
  );

  const deleteThread = useCallback(
    (id: string) => {
      const all = threadsRef.current;
      const index = all.findIndex((t) => t.id === id);
      const removed = index >= 0 ? all[index] : undefined;
      const remaining = all.filter((t) => t.id !== id);
      const nextActive =
        activeIdRef.current === id ? (remaining[0]?.id ?? null) : activeIdRef.current;
      activeIdRef.current = nextActive;
      setActiveId(nextActive);
      commitThreads(() => remaining);
      const serverId = serverIdFor(id);
      commitPending((prev) => prev.filter((p) => serverIdFor(p.conversationId) !== serverId));
      loadedRef.current.delete(serverId);

      // Never created on the server (the user deleted it before the create landed),
      // so there is nothing to delete remotely. Removing it locally is the correct
      // outcome, not a failure to report.
      if (!isServerBacked(id)) {
        void mutateListRef.current?.();
        return;
      }

      void ConversationApi.remove(workspaceIdRef.current, serverId).then((res) => {
        if (!mountedRef.current) return;
        if (res.ok) {
          void mutateListRef.current?.();
          return;
        }
        if (res.aborted || !removed) return;
        // Restore at the original position, so a failed delete does not also
        // reorder the rail.
        commitThreads((prev) => {
          if (prev.some((t) => t.id === removed.id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
        setSyncError(`Delete not saved: ${res.error}`);
        toast({
          tone: 'error',
          title: 'Delete failed',
          detail: `${res.error} The conversation was restored.`,
        });
      });
    },
    [commitPending, commitThreads, isServerBacked, serverIdFor, toast],
  );

  const clearThread = useCallback(
    (id: string) => {
      const previous = threadsRef.current.find((t) => t.id === id)?.messages ?? [];
      patchThread(id, (t) => ({ ...t, messages: [], title: 'New conversation' }));
      commitPending((prev) =>
        prev.filter((p) => serverIdFor(p.conversationId) !== serverIdFor(id)),
      );
      const serverId = serverIdFor(id);
      if (!isServerBacked(id)) {
        loadedRef.current.add(serverId);
        return;
      }
      void ConversationApi.clearMessages(workspaceIdRef.current, serverId).then((res) => {
        if (!mountedRef.current) return;
        if (res.ok) {
          loadedRef.current.add(serverId);
          void mutateListRef.current?.();
          return;
        }
        if (res.aborted) return;
        patchThread(id, (t) => ({ ...t, messages: previous }));
        setSyncError(`Clear not saved: ${res.error}`);
        toast({
          tone: 'error',
          title: 'Clear failed',
          detail: `${res.error} The messages were restored.`,
        });
      });
    },
    [commitPending, isServerBacked, patchThread, serverIdFor, toast],
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
      // Computed from the ref, not inside the state updater: a side effect in an
      // updater runs twice under StrictMode and would double-queue the write.
      const settled = (threadsRef.current.find((t) => t.id === threadId)?.messages ?? [])
        .filter((m) => m.status === 'streaming')
        .map<ChatMessage>((m) => ({
          ...m,
          status: 'stopped',
          text: m.text || 'Stopped before any output arrived.',
        }));
      if (settled.length > 0) {
        patchThread(threadId, (t) => ({
          ...t,
          messages: t.messages.map((m) => settled.find((s) => s.id === m.id) ?? m),
        }));
        // `stopped` is terminal, so each stopped turn is now worth persisting.
        for (const m of settled) queuePersist(threadId, m);
      }
    }
    setBusy(false);
    setWorkflowId(null);
    toast({
      tone: 'info',
      title: 'Generation stopped',
      detail: hadStream ? undefined : 'The server-side run was cancelled too.',
    });
  }, [patchThread, queuePersist, toast]);

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
          ...(agentForCall ? { agentName: agentForCall } : {}),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          messages: [],
        };
        activeIdRef.current = threadId;
        setActiveId(threadId);
        commitThreads((p) => [thread, ...p].slice(0, MAX_THREADS));
        // Created before the run starts, not on first flush: the turn is about to
        // be long, and a message POST with no conversation to attach it to would be
        // lost. `seed` is required — `threadsRef` has not rendered this thread yet.
        void ensureServerThread(threadId, {
          title: thread.title,
          ...(agentForCall ? { agentName: agentForCall } : {}),
        });
      }

      const userMessage: ChatMessage = {
        id: nextId('m'),
        role: 'user',
        text: rawText,
        timestamp: nowIso(),
        status: 'complete',
        attachments,
      };
      const isMultiAgentSquad = selectedSquadRef.current.length > 1;
      const agentMessage: ChatMessage = {
        id: nextId('m'),
        role: 'agent',
        text: '',
        timestamp: nowIso(),
        status: 'streaming',
        replyTo: userMessage.id,
        agentName: agentForCall ?? (isMultiAgentSquad ? 'supervisor' : 'assistant'),
        model: selectedModelRef.current,
        squad: selectedSquadRef.current.length > 0 ? selectedSquadRef.current : undefined,
      };

      patchThread(threadId, (t) => ({
        ...t,
        title: t.messages.length === 0 ? promptText.slice(0, 40) : t.title,
        messages: [...t.messages, userMessage, agentMessage],
      }));
      // The user turn is already terminal, so it can be persisted immediately. The
      // agent turn is not: it is patched locally at stream speed and queued only
      // when it settles.
      queuePersist(threadId, userMessage);

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
            agentNames: isMultiAgentSquad ? selectedSquadRef.current : undefined,
            model: selectedModelRef.current,
            temperature: temperatureRef.current,
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
    [
      busy,
      commitThreads,
      ensureServerThread,
      patchMessage,
      patchThread,
      queuePersist,
      toast,
      workspaceId,
    ],
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
      dropPending(messageId);
      void send(source.text);
    },
    [dropPending, patchThread, send, toast],
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
      // The truncated tail and the edited text have no server endpoint: the
      // contract has no message-level PATCH or DELETE. Say so rather than let the
      // rail imply the branch was rewritten everywhere.
      setLocalOnlyNotice(
        'Edits are applied in this tab only — the API has no endpoint for rewriting a stored message yet, so other devices still show the original branch.',
      );
      void send(clean);
    },
    [patchThread, send],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      const threadId = activeIdRef.current;
      if (!threadId) return;
      const existing = threadsRef.current.find((t) => t.id === threadId)?.messages ?? [];
      const idx = existing.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      // Deleting a user message invalidates its answer too.
      const drop = new Set([messageId]);
      const reply = existing[idx + 1];
      const target = existing[idx];
      if (target?.role === 'user' && reply?.role === 'agent' && reply.replyTo === messageId) {
        drop.add(reply.id);
      }
      patchThread(threadId, (t) => ({ ...t, messages: t.messages.filter((m) => !drop.has(m.id)) }));
      for (const id of drop) dropPending(id);
      // The contract has no per-message DELETE, so the rows survive server-side.
      // Say so rather than let the rail imply they are gone everywhere.
      setLocalOnlyNotice(
        'Deleted messages are removed in this tab only — the API has no per-message delete endpoint yet, so other devices still show them.',
      );
    },
    [patchThread, dropPending],
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
    conversationsState,
    ...(conversationsError ? { conversationsError } : {}),
    unsyncedCount: pending.length,
    syncError,
    isOffline,
    migration,
    reload,
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
    selectedModel,
    setSelectedModel,
    availableModels,
    modelsLoading,
    selectedSquad,
    setSelectedSquad,
    toggleSquadAgent,
    temperature,
    setTemperature,
    activeTab,
    setActiveTab,
    pinMessageToMemory,
    isCompacting,
    compactThreadHistory,
    isMemoryDrawerOpen,
    setIsMemoryDrawerOpen,
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
  agentNames?: string[];
  model?: string;
  temperature?: number;
  signal: AbortSignal;
  patchMessage: (threadId: string, messageId: string, patch: Partial<ChatMessage>) => void;
}

async function runStreamedTurn(args: StreamedArgs): Promise<void> {
  const {
    workspaceId,
    threadId,
    agentMessageId,
    text,
    agentForCall,
    agentNames,
    model,
    temperature,
    signal,
    patchMessage,
  } = args;
  const startedAt = performance.now();
  let acc = emptyAccumulator();
  let lastRender = 0;

  try {
    await agentApi.chatStream(
      {
        workspaceId,
        message: text,
        agentName: agentForCall,
        agentNames,
        model,
        temperature,
      },
      (event, data) => {
        acc = applyStreamEvent(acc, event, data);
        // Coalesce renders: the old code called setState on every token, which
        // re-rendered the whole transcript (and every ReactMarkdown tree) per delta.
        const now = performance.now();
        if (event === 'token' && now - lastRender < 40) return;
        lastRender = now;
        patchMessage(threadId, agentMessageId, {
          text: acc.text,
          agentName:
            acc.agentName ??
            agentForCall ??
            (agentNames && agentNames.length > 1 ? 'supervisor' : 'assistant'),
          confidence: acc.confidence,
          toolCalls: acc.toolCalls.length ? acc.toolCalls : undefined,
          citations: acc.citations,
          proposals: acc.proposals.length ? acc.proposals : undefined,
          plan: acc.plan,
          phases: acc.phases.length ? acc.phases : undefined,
          status: 'streaming',
          parallelOutputs:
            Object.keys(acc.parallelOutputs).length > 0 ? acc.parallelOutputs : undefined,
          groundingDossier: acc.groundingDossier,
          tokenUsage: acc.tokenUsage,
          fallbackNotice: acc.fallbackNotice,
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
      const fallback = await runBufferedTurn({
        workspaceId,
        text,
        agentForCall,
        agentNames,
        model,
        temperature,
      });
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
  if (!acc.sawToken && !acc.text.trim()) {
    const fallback = await runBufferedTurn({
      workspaceId,
      text,
      agentForCall,
      agentNames,
      model,
      temperature,
    });
    finalize(patchMessage, threadId, agentMessageId, {
      ...fallback,
      latencyMs: Math.round(performance.now() - startedAt),
    });
    return;
  }
  finalize(patchMessage, threadId, agentMessageId, {
    ...acc,
    latencyMs: Math.round(performance.now() - startedAt),
  });
}

interface BufferedArgs {
  workspaceId: string;
  text: string;
  agentForCall?: string;
  agentNames?: string[];
  model?: string;
  temperature?: number;
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
  agentNames,
  model,
  temperature,
}: BufferedArgs): Promise<StreamAccumulator> {
  const res: unknown = await agentApi.chat({
    workspaceId,
    message: text,
    agentName: agentForCall,
    agentNames,
    model,
    temperature,
  });
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

  const rawDossier = (r['grounding_dossier'] ?? result?.['grounding_dossier']) as
    StreamEventData | undefined;
  if (rawDossier && Array.isArray(rawDossier['memories'])) {
    acc.groundingDossier = {
      memories: rawDossier['memories'] as any,
      contextTokenEstimate:
        typeof rawDossier['context_token_estimate'] === 'number'
          ? (rawDossier['context_token_estimate'] as number)
          : undefined,
    };
  }
  const rawUsage = (r['token_usage'] ?? result?.['token_usage'] ?? r['usage']) as
    StreamEventData | undefined;
  if (rawUsage && typeof rawUsage['prompt_tokens'] === 'number') {
    acc.tokenUsage = {
      promptTokens: rawUsage['prompt_tokens'] as number,
      completionTokens:
        typeof rawUsage['completion_tokens'] === 'number'
          ? (rawUsage['completion_tokens'] as number)
          : 0,
      totalTokens:
        typeof rawUsage['total_tokens'] === 'number'
          ? (rawUsage['total_tokens'] as number)
          : (rawUsage['prompt_tokens'] as number),
      contextWindowLimit:
        typeof rawUsage['context_window_limit'] === 'number'
          ? (rawUsage['context_window_limit'] as number)
          : undefined,
      contextPercent:
        typeof rawUsage['context_percent'] === 'number'
          ? (rawUsage['context_percent'] as number)
          : undefined,
    };
  }

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

  // A terminal status, so `patchMessage` queues this turn for the server.
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
    parallelOutputs: Object.keys(acc.parallelOutputs).length > 0 ? acc.parallelOutputs : undefined,
    groundingDossier: acc.groundingDossier,
    tokenUsage: acc.tokenUsage,
    fallbackNotice: acc.fallbackNotice,
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

/** Rehydrate the write-behind outbox for a workspace. Exported for tests. */
export function pendingQueueKey(workspaceId: string): string {
  return pendingKey(workspaceId);
}

/** Read the outbox from storage. Exported for tests and for a future replay button. */
export function readPendingQueue(workspaceId: string): PendingWrite[] {
  return readPending(workspaceId);
}

export type { PendingWrite };
