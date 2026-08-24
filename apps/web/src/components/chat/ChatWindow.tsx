'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  agentApi,
  agentCatalogApi,
  approvalApi,
  documentApi,
  type CatalogAgent,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'error';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
  agentName?: string;
  confidence?: number;
  toolCalls?: Array<{ name: string; status: 'running' | 'done' | 'error'; latencyMs?: number }>;
  citations?: Array<{ title: string; uri?: string; score?: number }>;
  proposals?: Array<{
    title: string;
    detail?: string;
    requiresApproval?: boolean;
    approvalId?: string;
    status?: ProposalStatus;
  }>;
  questions?: string[];
  error?: boolean;
  latencyMs?: number;
  streaming?: boolean;
}
interface Thread {
  id: string;
  title: string;
  agentName?: string;
  createdAt: string;
  messages: ChatMessage[];
}

const SLASH = [
  { trigger: '/organize', desc: 'Organize workspace files', agent: 'organization', icon: 'â—§' },
  { trigger: '/remember', desc: 'Extract memories', agent: 'memory', icon: 'â—Ž' },
  { trigger: '/resume', desc: 'Generate resume', agent: 'resume', icon: 'â‰¡' },
  { trigger: '/ats', desc: 'ATS score', agent: 'ats', icon: 'â–£' },
  { trigger: '/jobs', desc: 'Search jobs', agent: 'job_search', icon: '◩' },
  { trigger: '/apply', desc: 'Draft application', agent: 'application', icon: 'âœ‰' },
  { trigger: '/email', desc: 'Draft email (approval)', agent: 'gmail', icon: 'âœ‰' },
  { trigger: '/schedule', desc: 'Calendar & reminders', agent: 'scheduler', icon: 'â—·' },
];

const QUICK = [
  { label: 'Organize my files', prompt: '/organize my recent files' },
  { label: 'Summarize last doc', prompt: 'Summarize the last document as key entities' },
  {
    label: 'Tailor resume for PM at Linear',
    prompt: '/resume for a Product Manager role at Linear',
  },
];

function nowIso() {
  return new Date().toISOString();
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtRel(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function agentDot(a?: string) {
  const m: Record<string, string> = {
    organization: 'bg-warning',
    memory: 'bg-violet-500',
    resume: 'bg-sky-500',
    ats: 'bg-success',
    job_search: 'bg-blue-500',
    application: 'bg-pink-500',
    gmail: 'bg-error',
    scheduler: 'bg-amber-600',
  };
  return m[a || ''] || 'bg-zinc-600';
}

function parseBlockingChatResponse(
  res: unknown,
  fallbackAgent?: string,
): {
  reply: string;
  proposals?: ChatMessage['proposals'];
  questions?: string[];
  tools?: ChatMessage['toolCalls'];
  cites?: ChatMessage['citations'];
  agentName?: string;
  confidence?: number;
} {
  const r = res as Record<string, unknown>;
  let reply = '';
  let conf: number | undefined;
  let proposals: ChatMessage['proposals'];
  let questions: string[] | undefined;
  let tools: ChatMessage['toolCalls'];
  let cites: ChatMessage['citations'];
  let an = fallbackAgent;
  if (r && typeof r === 'object' && 'result' in r) {
    const o = (
      r as {
        result: {
          summary?: string;
          proposals?: unknown[];
          questions?: string[];
          details?: unknown;
        };
        agent_name?: string;
        confidence?: number;
      }
    ).result;
    reply = (o?.summary as string) || '';
    proposals = (o?.proposals as unknown[])?.map((p) => {
      const q = p as Record<string, unknown>;
      const approvalId =
        typeof q['approval_id'] === 'string' || typeof q['approvalId'] === 'string'
          ? String(q['approval_id'] || q['approvalId'])
          : undefined;
      return {
        title: String(q['title'] || q['action'] || 'Proposal'),
        detail: String(q['detail'] || q['description'] || ''),
        requiresApproval: q['requires_approval'] === true || Boolean(approvalId),
        approvalId,
        status: approvalId ? ('pending' as const) : undefined,
      };
    }) as ChatMessage['proposals'];
    questions = o?.questions as string[];
    conf = (r as { confidence?: number }).confidence;
    an = (r as { agent_name?: string }).agent_name || an;
    // F-02: no fabricated tool executions are synthesized from response shape;
    // toolCalls render only when the backend reports them.
    const d = o?.details as Record<string, unknown> | undefined;
    if (d && Array.isArray((d as Record<string, unknown>)['citations']))
      cites = d['citations'] as ChatMessage['citations'];
  } else if (r && 'reply' in (r as Record<string, unknown>))
    reply = String((r as { reply?: string }).reply || '');
  else if (typeof r === 'string') reply = r;
  else reply = JSON.stringify(r).slice(0, 2000);
  if (!reply.trim()) reply = 'No response — try rephrasing or @mention an agent.';
  return { reply, proposals, questions, tools, cites, agentName: an, confidence: conf };
}

export function ChatWindow({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('auto');
  const [catalog, setCatalog] = useState<CatalogAgent[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [slashF, setSlashF] = useState('');
  const [mentionF, setMentionF] = useState('');
  // F-24: threads rail overlays content below md — default it CLOSED on
  // mobile so the composer is never covered on first paint.
  const [showAgents, setShowAgents] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768,
  );

  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const commitRename = (): void => {
    const id = editingThreadId;
    const title = editingTitle.trim();
    setEditingThreadId(null);
    if (!id || !title) return;
    const apply = (list: Thread[]): Thread[] =>
      list.map((x) => (x.id === id ? { ...x, title } : x));
    setThreads(apply);
  };

  // F-24: Escape closes the mobile threads rail.
  useEffect(() => {
    if (!showAgents) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && window.innerWidth < 768) setShowAgents(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAgents]);
  const [dragOver, setDragOver] = useState(false);
  const [attached, setAttached] = useState<File | null>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) || null,
    [threads, activeId],
  );
  const canonical = useMemo(() => {
    const list = catalog.filter((c) => c.isCanonical);
    if (list.length) return list;
    // fallback — 10 canonical now (planning + research promoted as main)
    const fallback: CatalogAgent[] = [
      {
        name: 'organization',
        mission: 'Organize workspace',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Organization'],
        category: 'canonical',
      },
      {
        name: 'memory',
        mission: 'Extract memories',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Memory'],
        category: 'canonical',
      },
      {
        name: 'resume',
        mission: 'Generate resume',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Resume'],
        category: 'canonical',
      },
      {
        name: 'ats',
        mission: 'ATS score',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['ATS'],
        category: 'canonical',
      },
      {
        name: 'job_search',
        mission: 'Search jobs',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Jobs'],
        category: 'canonical',
      },
      {
        name: 'application',
        mission: 'Draft application',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Application'],
        category: 'canonical',
      },
      {
        name: 'gmail',
        mission: 'Gmail draft-only',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Gmail'],
        category: 'canonical',
      },
      {
        name: 'scheduler',
        mission: 'Schedule & reminders',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Schedule'],
        category: 'canonical',
      },
      {
        name: 'planning',
        mission: 'Build roadmaps & milestones',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Planning'],
        category: 'canonical',
      },
      {
        name: 'research',
        mission: 'Deep research synthesis',
        tools: [],
        toolNames: [],
        memoryScopes: { readTypes: [], writeTypes: [] },
        defaultAutonomy: 'suggest',
        isCanonical: true,
        skills: ['Research'],
        category: 'canonical',
      },
    ];
    return fallback;
  }, [catalog]);

  useEffect(() => {
    try {
      const r = localStorage.getItem(`vaeloom.threads.${workspaceId}`);
      if (r) {
        const p: Thread[] = JSON.parse(r);
        if (Array.isArray(p) && p.length) {
          setThreads(p.slice(0, 20));
          const f = p[0] as Thread;
          setActiveId(f.id);
          setMessages(f.messages || []);
        }
      }
    } catch {}
  }, [workspaceId]);
  useEffect(() => {
    localStorage.setItem(`vaeloom.threads.${workspaceId}`, JSON.stringify(threads.slice(0, 20)));
  }, [threads, workspaceId]);
  useEffect(() => {
    if (activeThread) setMessages(activeThread.messages);
    else setMessages([]);
  }, [activeThread]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);
  useEffect(() => {
    agentCatalogApi
      .get()
      .then((r) => setCatalog(r.agents || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const startNew = useCallback((agent?: string, prompt?: string) => {
    const id = Math.random().toString(36).slice(2, 7);
    const t: Thread = {
      id,
      title: prompt
        ? prompt.slice(0, 30)
        : agent && agent !== 'auto'
          ? `${agent} chat`
          : 'New conversation',
      agentName: agent && agent !== 'auto' ? agent : undefined,
      createdAt: nowIso(),
      messages: [],
    };
    setThreads((p) => [t, ...p]);
    setActiveId(id);
    setSelected(agent || 'auto');
    if (prompt) setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);
  const updateThread = useCallback(
    (id: string, up: (t: Thread) => Thread) =>
      setThreads((p) => p.map((t) => (t.id === id ? up(t) : t))),
    [],
  );

  type ProposalPatch = Partial<{
    title: string;
    detail?: string;
    requiresApproval?: boolean;
    approvalId?: string;
    status?: ProposalStatus;
  }>;

  const patchProposal = useCallback(
    (messageId: string, proposalIndex: number, patch: ProposalPatch) => {
      setMessages((p) =>
        p.map((m) =>
          m.id === messageId
            ? {
                ...m,
                proposals: m.proposals?.map((pr, i) =>
                  i === proposalIndex ? { ...pr, ...patch } : pr,
                ),
              }
            : m,
        ),
      );
      updateThread(activeId ?? '', (t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                proposals: m.proposals?.map((pr, i) =>
                  i === proposalIndex ? { ...pr, ...patch } : pr,
                ),
              }
            : m,
        ),
      }));
    },
    [activeId, updateThread],
  );

  const handleProposalDecision = useCallback(
    async (messageId: string, proposalIndex: number, decision: 'approve' | 'reject') => {
      const proposal = messages.find((m) => m.id === messageId)?.proposals?.[proposalIndex];
      if (!proposal) return;
      if (!proposal.approvalId) {
        patchProposal(messageId, proposalIndex, { status: 'error' });
        toast({
          tone: 'error',
          title: 'No approval record',
          detail:
            'This proposal is not linked to a backend approval. Review pending approvals in Notifications.',
        });
        return;
      }
      try {
        const result =
          decision === 'approve'
            ? await approvalApi.approve(proposal.approvalId)
            : await approvalApi.reject(proposal.approvalId);
        const nextStatus: ProposalStatus = (
          ((result?.status ?? decision === 'approve') ? 'approved' : 'rejected') as string
        ).toLowerCase() as ProposalStatus;
        patchProposal(messageId, proposalIndex, { status: nextStatus });
        toast({
          tone: 'success',
          title: decision === 'approve' ? 'Approved' : 'Rejected',
          detail: proposal.title,
        });
      } catch (err) {
        patchProposal(messageId, proposalIndex, { status: 'error' });
        toast({
          tone: 'error',
          title: decision === 'approve' ? 'Approval failed' : 'Rejection failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    },
    [messages, patchProposal, toast],
  );

  const filteredSlash = useMemo(() => {
    const f = slashF.toLowerCase();
    return !f
      ? SLASH
      : SLASH.filter((s) => s.trigger.includes(f) || s.desc.toLowerCase().includes(f));
  }, [slashF]);
  const filteredMention = useMemo(() => {
    const f = mentionF.toLowerCase();
    const list = [
      { name: 'auto', mission: 'Auto routing' } as unknown as CatalogAgent,
      ...canonical,
    ];
    return !f ? list : list.filter((a) => a.name.toLowerCase().includes(f));
  }, [canonical, mentionF]);

  const handleInput = (v: string) => {
    setInput(v);
    const ls = v.lastIndexOf('/'),
      la = v.lastIndexOf('@');
    if (v.endsWith('/') || (ls >= 0 && ls > la && !v.slice(ls).includes(' '))) {
      setSlashOpen(true);
      setMentionOpen(false);
      setSlashF(v.slice(ls + 1));
    } else if (v.includes('@') && la >= 0 && !v.slice(la).includes(' ')) {
      setMentionOpen(true);
      setSlashOpen(false);
      setMentionF(v.slice(la + 1));
    } else {
      setSlashOpen(false);
      setMentionOpen(false);
    }
  };
  const commitSlash = (s: (typeof SLASH)[number]) => {
    const i = input.lastIndexOf('/');
    setInput(`${i >= 0 ? input.slice(0, i) : input}${s.trigger} `);
    setSlashOpen(false);
    if (s.agent) setSelected(s.agent);
    inputRef.current?.focus();
  };
  const commitMention = (n: string) => {
    const i = input.lastIndexOf('@');
    setInput(`${i >= 0 ? input.slice(0, i) : input}@${n} `);
    setMentionOpen(false);
    setSelected(n);
    inputRef.current?.focus();
  };

  const streamText = useCallback(async (full: string, targetId: string) => {
    const words = full.split(/(\s+)/);
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += words[i];
      await new Promise((r) => setTimeout(r, words[i]?.trim() ? 18 : 4));
      setMessages((p) =>
        p.map((m) =>
          m.id === targetId ? { ...m, text: acc, streaming: i < words.length - 1 } : m,
        ),
      );
      setThreads((p) =>
        p.map((t) =>
          t.messages.some((m) => m.id === targetId)
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === targetId ? { ...m, text: acc, streaming: i < words.length - 1 } : m,
                ),
              }
            : t,
        ),
      );
    }
  }, []);

  const handleSend = useCallback(
    async (override?: string) => {
      const rawBase = (override ?? input).trim();
      if ((!rawBase && !attached) || loading) return;
      // If file attached, upload first and append to message context
      let raw = rawBase;
      let fileContext: string | undefined;
      if (attached) {
        const toUpload = attached;
        setAttached(null);
        raw = rawBase
          ? `${rawBase}\n\n[Attached file: ${toUpload.name}]`
          : `[Attached file: ${toUpload.name}]`;
        fileContext = toUpload.name;
        // fire upload non-blocking but provide toast; chat includes filename context even if upload fails
        try {
          const doc = await documentApi.upload(toUpload, workspaceId);
          toast({
            tone: 'success',
            title: 'File attached',
            detail: `${doc.path} — referenced in message`,
          });
          fileContext = `${toUpload.name} (stored as ${doc.path})`;
          raw = rawBase ? `${rawBase}\n\n[File stored: ${doc.path}]` : `[File stored: ${doc.path}]`;
        } catch {
          toast({
            tone: 'error',
            title: 'Attach failed',
            detail: `${toUpload.name} not stored — message sent with name only`,
          });
        }
      }
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: fileContext && !rawBase ? raw : rawBase ? raw : raw,
        timestamp: nowIso(),
      };
      const next = [...messages, userMsg];
      setMessages(next);
      let freshThreadId: string | null = null;
      if (activeId)
        updateThread(activeId, (t) => ({
          ...t,
          messages: next,
          title: t.messages.length === 0 ? raw.slice(0, 30) : t.title,
        }));
      else {
        const id = Math.random().toString(36).slice(2, 7);
        freshThreadId = id;
        const th: Thread = {
          id,
          title: raw.slice(0, 30),
          createdAt: nowIso(),
          messages: next,
          agentName: selected !== 'auto' ? selected : undefined,
        };
        setThreads((p) => [th, ...p]);
        setActiveId(id);
      }
      setInput('');
      setSlashOpen(false);
      setMentionOpen(false);
      setLoading(true);
      const agentId = (Date.now() + 1).toString();
      const agentForCall = selected === 'auto' ? undefined : selected;
      // F-02: latency shown to users is always client-measured wall time.
      const requestStartedAt = Date.now();
      setStreamingId(agentId);
      const ph: ChatMessage = {
        id: agentId,
        role: 'agent',
        text: '',
        timestamp: nowIso(),
        agentName: agentForCall || 'assistant',
        confidence: undefined,
        toolCalls: [{ name: 'routing', status: 'running' }],
        streaming: true,
      };
      setMessages((p) => [...p, ph]);
      if (activeId) updateThread(activeId, (t) => ({ ...t, messages: [...t.messages, ph] }));
      else if (freshThreadId)
        // Fresh thread: the activeThread sync effect replaces `messages` from
        // the thread — the placeholder must live there too or the assistant
        // reply (and its stopped/partial states) never render.
        setThreads((p) =>
          p.map((t) => (t.id === freshThreadId ? { ...t, messages: [...t.messages, ph] } : t)),
        );

      // â”€â”€ Streaming orchestrator (phase-by-phase SSE) with blocking fallback â”€â”€
      let streamedText = '';
      let streamedProposals: ChatMessage['proposals'] = [];
      let streamedQuestions: string[] | undefined;
      let streamedTools: ChatMessage['toolCalls'] = [];
      let streamedCitations: ChatMessage['citations'];
      let streamedAgent = agentForCall || 'assistant';
      // F-02: confidence is only ever shown when the backend supplies it.
      let streamedConfidence: number | undefined;
      let streamedError = false;
      let gotDone = false;
      let abortCtrl: AbortController | null = null;

      const applyPatch = (patch: Partial<ChatMessage>) => {
        setMessages((p) => p.map((m) => (m.id === agentId ? { ...m, ...patch } : m)));
        setThreads((p) =>
          p.map((t) => ({
            ...t,
            messages: t.messages.map((m) => (m.id === agentId ? { ...m, ...patch } : m)),
          })),
        );
      };

      const onSseEvent = (event: string, data: Record<string, unknown>) => {
        if (event === 'intent') {
          streamedAgent = (data['agent'] as string) || streamedAgent;
          streamedConfidence = (data['confidence'] as number) ?? streamedConfidence;
          applyPatch({
            agentName: streamedAgent,
            confidence: streamedConfidence,
            toolCalls: [{ name: `intent:${streamedAgent}`, status: 'running' }],
          });
        } else if (event === 'plan') {
          const plan = (data['plan'] as Record<string, unknown>) || {};
          const rag = plan['rag_context'] as Record<string, unknown> | undefined;
          const ragCount = rag
            ? ((rag['entities'] as unknown[])?.length || 0) +
              ((rag['documents'] as unknown[])?.length || 0)
            : 0;
          applyPatch({
            toolCalls: [
              { name: 'plan', status: 'done' },
              ...(ragCount ? [{ name: `rag:${ragCount} hits`, status: 'done' as const }] : []),
            ],
          });
        } else if (event === 'act' || event === 'tool_start') {
          const tool =
            (data['tool'] as string) ||
            ((data['result'] as Record<string, unknown>)?.['tool'] as string) ||
            'tool';
          streamedTools = [...(streamedTools || []), { name: tool, status: 'running' as const }];
          // keep only last 6 to avoid clutter
          if ((streamedTools?.length || 0) > 6) streamedTools = streamedTools!.slice(-6);
          applyPatch({ toolCalls: streamedTools });
        } else if (event === 'observe' || event === 'reflect') {
          // mark tools done — F-02: no fabricated per-tool latency is shown;
          // durations are only rendered when actually measured.
          if (streamedTools?.length) {
            streamedTools = streamedTools!.map((t) => ({
              ...t,
              status: 'done' as const,
            }));
            applyPatch({ toolCalls: streamedTools });
          }
        } else if (event === 'supervisor_start') {
          const dag = (data['dag'] as unknown[]) || (data['subtasks'] as unknown[]) || [];
          applyPatch({
            toolCalls: [
              { name: `supervisor DAG ${JSON.stringify(dag).slice(0, 60)}`, status: 'running' },
            ],
          });
        } else if (event === 'supervisor_layer_start' || event === 'supervisor_parallel') {
          const agents = (data['agents'] as string[]) || [];
          applyPatch({ toolCalls: agents.map((a) => ({ name: a, status: 'running' as const })) });
        } else if (event === 'supervisor_agent_done') {
          const an = (data['agent_name'] as string) || 'agent';
          const summary =
            ((data['result'] as Record<string, unknown>)?.['summary'] as string) || '';
          if (summary) streamedText += (streamedText ? '\n\n' : '') + `[${an}] ${summary}`;
          applyPatch({
            text: streamedText,
            streaming: true,
            toolCalls: [{ name: `${an}:done`, status: 'done' }],
          });
        } else if (event === 'token') {
          const t = (data['text'] as string) || '';
          streamedText += t;
          applyPatch({ text: streamedText, streaming: true });
        } else if (event === 'qa') {
          // QA gate — show as tool
          const decision = data['decision'] as string;
          applyPatch({
            toolCalls: [
              { name: `qa:${decision}`, status: decision === 'approved' ? 'done' : 'running' },
            ],
          });
        } else if (event === 'approval_required') {
          const p = data as Record<string, unknown>;
          const approvalId = (p['approval_id'] as string) || (p['approvalId'] as string);
          const item: NonNullable<ChatMessage['proposals']>[number] = {
            title: (p['title'] as string) || 'Approval required',
            detail: (p['detail'] as string) || (p['reason'] as string) || '',
            requiresApproval: true,
            approvalId,
            status: 'pending',
          };
          streamedProposals = [...(streamedProposals || []), item];
          applyPatch({ proposals: streamedProposals });
        } else if (event === 'out_of_scope') {
          streamedText = (data['message'] as string) || 'Outside MVP scope';
          streamedError = true;
          applyPatch({ text: streamedText, error: true, streaming: false });
        } else if (event === 'ask_clarification') {
          const qs = (data['questions'] as string[]) || [];
          streamedQuestions = qs;
          streamedText = 'Could you clarify what you need help with?';
          applyPatch({ text: streamedText, questions: streamedQuestions, streaming: false });
        } else if (event === 'error') {
          streamedText = (data['message'] as string) || 'Error';
          streamedError = true;
          applyPatch({ text: streamedText, error: true, streaming: false });
        } else if (event === 'done') {
          gotDone = true;
          // Final payload may carry summary/proposals/questions
          const result = (data['result'] as string | Record<string, unknown>) || data;
          let finalText = '';
          let finalProposals = streamedProposals;
          let finalQuestions = streamedQuestions;
          if (typeof result === 'string') finalText = result;
          else if (result && typeof result === 'object') {
            const r = result as Record<string, unknown>;
            if (typeof r['summary'] === 'string') finalText = r['summary'] as string;
            else if (typeof r['result'] === 'string') finalText = r['result'] as string;
            // proposals/questions may be nested in result.result
            const nested = (r['result'] as Record<string, unknown>) || r;
            if (Array.isArray(nested['proposals'])) {
              finalProposals = (nested['proposals'] as unknown[]).map((p) => {
                const q = p as Record<string, unknown>;
                const approvalId = (q['approval_id'] as string) || (q['approvalId'] as string);
                return {
                  title: String(q['title'] || q['action'] || 'Proposal'),
                  detail: String(q['detail'] || q['description'] || ''),
                  requiresApproval: q['requires_approval'] === true || Boolean(approvalId),
                  approvalId,
                  status: approvalId ? ('pending' as const) : undefined,
                };
              }) as typeof finalProposals;
            }
            if (Array.isArray(nested['questions']))
              finalQuestions = nested['questions'] as string[];
            // citations
            const d = nested['details'] as Record<string, unknown> | undefined;
            if (d && Array.isArray((d as Record<string, unknown>)['citations'])) {
              streamedCitations = d['citations'] as ChatMessage['citations'];
            }
          }
          // If tokens already streamed, prefer streamedText; otherwise use finalText
          const displayText = streamedText.trim()
            ? streamedText
            : finalText || 'No response — try rephrasing or @mention an agent.';
          // Mark tools done
          const doneTools = (streamedTools || []).map((t) => ({ ...t, status: 'done' as const }));
          applyPatch({
            text: displayText,
            proposals: finalProposals?.length ? finalProposals : streamedProposals,
            questions: finalQuestions,
            toolCalls: doneTools.length
              ? doneTools
              : [{ name: `${streamedAgent}:done`, status: 'done' }],
            citations: streamedCitations,
            agentName: streamedAgent,
            confidence: streamedConfidence,
            streaming: false,
            error: streamedError,
            latencyMs: Date.now() - requestStartedAt,
          });
          setStreamingId(null);
        }
      };

      try {
        abortCtrl = new AbortController();
        abortRef.current = abortCtrl;
        await agentApi.chatStream(
          { workspaceId, message: raw, agentName: agentForCall },
          onSseEvent,
          abortCtrl.signal,
        );
        // If stream ended without done, finalize
        if (!gotDone && !streamedError) {
          const fallbackText =
            streamedText.trim() || 'No response — try rephrasing or @mention an agent.';
          applyPatch({
            text: fallbackText,
            streaming: false,
            toolCalls: (streamedTools || []).map((t) => ({ ...t, status: 'done' as const })),
          });
          setStreamingId(null);
        }
      } catch (err) {
        // Streaming failed — fallback to blocking chat
        // F-19: detect user-initiated cancellation robustly — some browsers /
        // proxy layers surface abort as TypeError(net::ERR_FAILED) rather than
        // DOMException(AbortError), so honor the signal itself as ground truth.
        const isAbort =
          (err instanceof DOMException && err.name === 'AbortError') ||
          Boolean(abortCtrl?.signal?.aborted);
        if (isAbort) {
          // F-19: user stopped generation — keep the partial response with an
          // honest stopped notice instead of leaving a phantom streaming bubble.
          const partial = streamedText.trim();
          applyPatch({
            text: partial
              ? `${partial}\n\n_(generation stopped)_`
              : '_Generation stopped before any output._',
            streaming: false,
            toolCalls: (streamedTools || []).map((t) => ({ ...t, status: 'done' as const })),
            latencyMs: Date.now() - requestStartedAt,
          });
          setLoading(false);
          setStreamingId(null);
          return;
        }
        try {
          const res: unknown = agentForCall
            ? await agentApi.chat({ workspaceId, message: raw, agentName: agentForCall })
            : await agentApi.chat({ workspaceId, message: raw });
          const parsed = parseBlockingChatResponse(res, agentForCall);
          const final: Partial<ChatMessage> = {
            text: parsed.reply,
            confidence: parsed.confidence ?? streamedConfidence,
            proposals: parsed.proposals,
            questions: parsed.questions,
            toolCalls: parsed.tools,
            citations: parsed.cites,
            agentName: parsed.agentName || streamedAgent || 'assistant',
            streaming: false,
            latencyMs: Date.now() - requestStartedAt,
          };
          await streamText(parsed.reply, agentId);
          setMessages((p) =>
            p.map((m) => (m.id === agentId ? { ...m, ...final, streaming: false } : m)),
          );
          setThreads((p) =>
            p.map((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === agentId ? { ...m, ...final, streaming: false } : m,
              ),
            })),
          );
        } catch (fallbackErr) {
          const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Failed';
          setMessages((p) =>
            p.map((m) =>
              m.id === agentId ? { ...m, text: msg, error: true, streaming: false } : m,
            ),
          );
          toast({ tone: 'error', title: 'Message failed', detail: msg });
        } finally {
          setStreamingId(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      input,
      loading,
      messages,
      workspaceId,
      selected,
      activeId,
      updateThread,
      toast,
      streamText,
      attached,
    ],
  );

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
    if (e.key === 'Escape') {
      setSlashOpen(false);
      setMentionOpen(false);
    }
  };
  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    toast({ tone: 'success', title: 'Copied' });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      {/* left - hermes subtle rail, keep threads */}
      <aside
        aria-label="Chat threads"
        className={`${showAgents ? 'flex' : 'hidden'} md:flex w-[260px] shrink-0 flex-col border-r border-border/40 bg-background max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-[82%] max-md:bg-background max-md:shadow-xl`}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-border/40">
          <span className="text-xs font-mono tracking-widest text-text-dim">THREADS</span>
          <button
            onClick={() => startNew(selected)}
            className="text-xs text-text-muted hover:text-text"
          >
            ï¼‹ New
          </button>
        </div>
        <div className="px-3 py-2 border-b border-border/40">
          <p className="text-xs text-text-dim">
            Single agentic chat — just ask. Orchestrator routes to planning, research & 8
            specialists behind the scenes.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {threads.length === 0 ? (
            <p className="px-3 py-6 text-sm text-text-dim text-center">No conversations yet</p>
          ) : (
            <div className="space-y-1">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center rounded-lg ${activeId === t.id ? 'bg-surface border border-border/50' : 'hover:bg-surface-hover border border-transparent'}`}
                >
                  {editingThreadId === t.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setEditingThreadId(null);
                      }}
                      onBlur={commitRename}
                      aria-label="Thread name"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-text focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setActiveId(t.id)}
                      className="flex-1 min-w-0 text-left rounded-lg px-3 py-2.5"
                    >
                      <p className="text-sm text-text truncate pr-2">{t.title}</p>
                      <p className="text-xs text-text-dim mt-0.5">
                        {fmtRel(t.createdAt)} {'\u00B7'} {t.messages.length} msgs
                      </p>
                    </button>
                  )}
                  {/* F-19b: threads live only in this browser (localStorage) —
                      rename/delete are honest local operations. */}
                  {editingThreadId !== t.id && (
                    <div className="flex shrink-0 pr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        aria-label={'Rename thread ' + t.title}
                        title="Rename"
                        onClick={() => {
                          setEditingThreadId(t.id);
                          setEditingTitle(t.title);
                        }}
                        className="p-1.5 text-xs text-text-muted hover:text-text"
                      >
                        {'\u270E'}
                      </button>
                      <button
                        aria-label={'Delete thread ' + t.title}
                        title="Delete (from this browser)"
                        onClick={() => {
                          const nextThreads = threads.filter((x) => x.id !== t.id);
                          setThreads(nextThreads);
                          if (activeId === t.id) setActiveId(nextThreads[0]?.id ?? null);
                        }}
                        className="p-1.5 text-xs text-text-muted hover:text-error"
                      >
                        {'\u2715'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border/40">
          <p className="text-[11px] text-text-dim leading-relaxed">
            Threads are stored in this browser only.
          </p>
        </div>
      </aside>

      {/* center - hermes centered 768 */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="h-12 flex items-center justify-between px-4 md:px-6 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAgents((v) => !v)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-hover"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
            <h1 className="text-sm font-medium text-text">Chat</h1>
            <span
              className="hidden md:inline text-[10px] font-mono uppercase tracking-wider text-text-dim border border-border/60 rounded-full px-2 py-0.5"
              title="Messages are generated by AI agents and may contain mistakes. Consequential actions always require your approval."
            >
              AI assistant
            </span>
            <span className="hidden sm:inline text-xs text-text-dim font-mono">
              · {workspaceId.slice(0, 8)}
            </span>
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${selected === 'auto' ? 'border-border/50 text-text-dim' : 'bg-action text-action-fg border-primary'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${selected === 'auto' ? 'bg-text-dim' : 'bg-black'}`}
              />
              {selected === 'auto' ? 'Auto' : selected}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden lg:inline text-xs text-text-dim">8 agents · QA gate</span>
            <button
              onClick={() => startNew()}
              className="ml-2 hidden sm:inline-flex rounded-full border border-border/50 px-3 py-1.5 text-xs hover:bg-surface-hover"
            >
              New chat
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[768px] w-full mx-auto px-4 md:px-6 py-8">
            {messages.length === 0 && !loading ? (
              <div className="py-10 md:py-16 text-center">
                <div className="w-10 h-10 rounded-xl bg-surface-200 text-text flex items-center justify-center mx-auto text-sm font-bold">
                  V
                </div>
                <h2 className="mt-4 text-xl font-medium text-text">How can we help?</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Ask anything, or use <span className="font-mono text-text">/</span> and{' '}
                  <span className="font-mono text-text">@</span>
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {QUICK.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => handleSend(q.prompt)}
                      className="rounded-full border border-border/50 bg-surface hover:bg-surface-hover px-4 py-2 text-sm text-text"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-1.5">
                  {SLASH.slice(0, 5).map((s) => (
                    <button
                      key={s.trigger}
                      onClick={() => {
                        setInput(s.trigger + ' ');
                        if (s.agent) setSelected(s.agent);
                      }}
                      className="text-xs text-text-dim hover:text-text"
                    >
                      <span className="font-mono text-text-muted">{s.trigger}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}
                  >
                    {m.role === 'agent' && (
                      <div
                        className={`w-7 h-7 rounded-full ${agentDot(m.agentName)} shrink-0 mt-1`}
                      />
                    )}
                    <div
                      className={`${m.role === 'user' ? 'max-w-[75%] bg-action text-action-fg rounded-2xl px-4 py-3' : 'flex-1 min-w-0'}`}
                    >
                      {m.role === 'agent' && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium capitalize text-text">
                            {(m.agentName || 'assistant').replace('_', ' ')}
                          </span>
                          <span className="text-xs text-text-dim">{fmtTime(m.timestamp)}</span>
                          {m.confidence !== undefined && (
                            <span
                              className={`text-xs font-mono px-1.5 py-0.5 rounded border ${m.confidence >= 0.9 ? 'border-success/30 text-success' : m.confidence >= 0.7 ? 'border-warning/30 text-warning' : 'border-error/30 text-error'}`}
                            >
                              {Math.round(m.confidence * 100)}%
                            </span>
                          )}
                          {m.latencyMs && (
                            <span className="ml-auto text-xs text-text-dim">{m.latencyMs}ms</span>
                          )}
                        </div>
                      )}
                      <div
                        className={`text-sm leading-7 whitespace-pre-wrap break-words ${m.role === 'agent' ? 'text-text' : 'text-black'} ${m.role === 'user' ? '' : 'pr-2'}`}
                      >
                        {m.text}
                        {m.streaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-text-dim animate-pulse align-middle" />
                        )}
                      </div>
                      {m.role === 'agent' && !m.error && (
                        <>
                          {m.toolCalls && m.toolCalls.length > 0 && (
                            <div className="mt-3 border-l-2 border-dashed border-border/60 pl-3 space-y-1">
                              {m.toolCalls.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-success' : t.status === 'error' ? 'bg-error' : 'bg-warning'}`}
                                  />
                                  {t.name}
                                  <span className="text-text-dim">
                                    {t.status}
                                    {t.latencyMs ? ` · ${t.latencyMs}ms` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {m.citations && m.citations.length > 0 && (
                            <div className="mt-3 flex gap-2 overflow-x-auto">
                              {m.citations.map((c, i) => (
                                <a
                                  key={i}
                                  href={c.uri || '#'}
                                  className="shrink-0 text-xs border border-border/50 rounded-full px-3 py-1 hover:bg-surface-hover"
                                >
                                  {c.title}
                                </a>
                              ))}
                            </div>
                          )}
                          {m.proposals && m.proposals.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {m.proposals.map((p, i) => {
                                const resolved =
                                  p.status === 'approved' ||
                                  p.status === 'rejected' ||
                                  p.status === 'expired';
                                return (
                                  <div
                                    key={i}
                                    className="rounded-xl border border-warning/30 bg-warning/10 p-3"
                                  >
                                    <p className="text-sm font-medium text-text">{p.title}</p>
                                    {p.detail && (
                                      <p className="text-xs text-text-muted mt-1">{p.detail}</p>
                                    )}
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        disabled={resolved}
                                        onClick={() => handleProposalDecision(m.id, i, 'approve')}
                                        className={`flex-1 rounded-full text-xs py-1.5 ${
                                          p.status === 'approved'
                                            ? 'bg-success/15 text-success border border-success/30 cursor-default'
                                            : 'bg-action text-action-fg hover:bg-action-hover disabled:opacity-40 disabled:cursor-default'
                                        }`}
                                      >
                                        {p.status === 'approved' ? 'Approved' : 'Approve'}
                                      </button>
                                      <button
                                        disabled={resolved}
                                        onClick={() => handleProposalDecision(m.id, i, 'reject')}
                                        className={`flex-1 rounded-full text-xs py-1.5 disabled:opacity-40 disabled:cursor-default ${
                                          p.status === 'rejected'
                                            ? 'bg-error/15 text-error-fg border border-error/30 cursor-default'
                                            : 'border border-border'
                                        }`}
                                      >
                                        {p.status === 'rejected' ? 'Rejected' : 'Reject'}
                                      </button>
                                    </div>
                                    {p.status === 'expired' && (
                                      <p className="text-xs text-text-dim mt-2">Expired</p>
                                    )}
                                    {p.status === 'error' && (
                                      <p className="text-xs text-error mt-2">
                                        Action failed — pending approvals live in Notifications
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {m.questions && m.questions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {m.questions.map((q, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleSend(q)}
                                  className="rounded-full border border-border/50 px-3 py-1 text-xs hover:bg-surface-hover"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <button
                          onClick={() => copy(m.text)}
                          className={`${m.role === 'user' ? 'text-black/50 hover:text-black' : 'text-text-dim hover:text-text'}`}
                        >
                          Copy
                        </button>
                        {m.error && (
                          <button
                            onClick={() =>
                              handleSend(
                                messages.filter((x) => x.role === 'user').slice(-1)[0]?.text || '',
                              )
                            }
                            className="text-primary"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-text-dim">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                        Thinking · routing + QA
                      </div>
                      <div className="mt-2 flex gap-1">
                        <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background">
          <div className="max-w-[768px] mx-auto w-full px-4 md:px-6 py-3">
            {slashOpen && (
              <div className="mb-2 rounded-xl border border-border/50 bg-surface shadow-lg overflow-hidden">
                {filteredSlash.map((s) => (
                  <button
                    key={s.trigger}
                    onClick={() => commitSlash(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-hover flex items-center gap-2.5"
                  >
                    <span className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs">
                      {s.icon}
                    </span>
                    <span className="text-sm font-mono text-text">{s.trigger}</span>
                    <span className="text-xs text-text-dim truncate">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {mentionOpen && (
              <div className="mb-2 rounded-xl border border-border/50 bg-surface shadow-lg overflow-hidden max-h-[200px] overflow-y-auto">
                {filteredMention.map((a) => (
                  <button
                    key={a.name}
                    onClick={() => commitMention(a.name)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover flex items-center gap-2.5"
                  >
                    <span className={`w-6 h-6 rounded-md ${agentDot(a.name)}`} />
                    <span className="text-sm">@{a.name}</span>
                    <span className="text-xs text-text-dim truncate">
                      {(a as unknown as { mission?: string }).mission || ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {attached && (
              <div className="mb-2 flex items-center gap-2 text-xs border border-border/50 rounded-full px-3 py-1.5 bg-surface">
                <span className="truncate">{attached.name}</span>
                <button onClick={() => setAttached(null)} className="ml-auto">
                  âœ•
                </button>
              </div>
            )}
            <div
              className={`flex items-end gap-2 rounded-[24px] border bg-surface px-2 py-2 ${dragOver ? 'border-white' : 'border-border/50'}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setAttached(f);
              }}
            >
              <label
                className="w-8 h-8 rounded-full hover:bg-background border border-transparent hover:border-border/50 flex items-center justify-center shrink-0 cursor-pointer text-text-dim"
                aria-label="Attach file"
              >
                <input
                  type="file"
                  aria-label="Attach file"
                  className="hidden"
                  onChange={(e) => setAttached(e.target.files?.[0] || null)}
                />
                ï¼‹
              </label>
              <textarea
                ref={inputRef}
                aria-label="Chat message"
                value={input}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder={selected === 'auto' ? 'Ask anything…' : 'Message @' + selected}
                className="flex-1 max-h-[120px] min-h-[24px] resize-none bg-transparent text-sm placeholder:text-text-dim focus:outline-none py-2"
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                }}
              />
              {streamingId ? (
                <button
                  aria-label="Stop generating"
                  title="Stop generating"
                  onClick={() => abortRef.current?.abort()}
                  className="w-8 h-8 rounded-full bg-error text-white flex items-center justify-center shrink-0 hover:brightness-110"
                >
                  <span aria-hidden className="block w-2.5 h-2.5 bg-current rounded-[2px]" />
                </button>
              ) : (
                <button
                  aria-label="Send message"
                  onClick={() => void handleSend()}
                  disabled={loading || (!input.trim() && !attached)}
                  className="w-8 h-8 rounded-full bg-action text-action-fg flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-action-hover"
                >
                  ↑
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-text-dim">
              âŽ send · â‡§âŽ newline · <span className="font-mono">@</span> agents ·{' '}
              <span className="font-mono">/</span> commands · {input.length}/10000
            </p>
          </div>
        </div>
      </div>

      {showAgents && (
        <button
          aria-label="Close chat threads"
          onClick={() => setShowAgents(false)}
          className="md:hidden fixed inset-0 bg-black/30 z-20"
        />
      )}
    </div>
  );
}
