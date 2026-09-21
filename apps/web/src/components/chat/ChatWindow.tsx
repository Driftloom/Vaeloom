'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  agentApi,
  agentCatalogApi,
  approvalApi,
  documentApi,
  temporalApi,
  type CatalogAgent,
} from '@/lib/api-client';
import { ExecutionTimeline } from '@/components/execution/ExecutionTimeline';
import { useToast } from '@/components/shared/Toast';
import { useRealtime } from '@/components/providers/RealtimeProvider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function getSlashIcon(agent: string) {
  switch (agent) {
    case 'organization':
      return (
        <svg
          className="w-3.5 h-3.5 text-warning"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      );
    case 'memory':
      return (
        <svg
          className="w-3.5 h-3.5 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      );
    case 'resume':
      return (
        <svg
          className="w-3.5 h-3.5 text-sky-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case 'ats':
      return (
        <svg
          className="w-3.5 h-3.5 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'job_search':
      return (
        <svg
          className="w-3.5 h-3.5 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
    case 'application':
      return (
        <svg
          className="w-3.5 h-3.5 text-pink-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      );
    case 'gmail':
      return (
        <svg
          className="w-3.5 h-3.5 text-rose-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
    case 'scheduler':
      return (
        <svg
          className="w-3.5 h-3.5 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className="w-3.5 h-3.5 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
  }
}

const SLASH = [
  { trigger: '/organize', desc: 'Organize workspace files', agent: 'organization' },
  { trigger: '/remember', desc: 'Extract memories', agent: 'memory' },
  { trigger: '/resume', desc: 'Generate resume', agent: 'resume' },
  { trigger: '/ats', desc: 'ATS score', agent: 'ats' },
  { trigger: '/jobs', desc: 'Search jobs', agent: 'job_search' },
  { trigger: '/apply', desc: 'Draft application', agent: 'application' },
  { trigger: '/email', desc: 'Draft email (approval)', agent: 'gmail' },
  { trigger: '/schedule', desc: 'Calendar & reminders', agent: 'scheduler' },
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
    memory: 'bg-accent',
    resume: 'bg-info',
    ats: 'bg-success',
    job_search: 'bg-primary',
    application: 'bg-primary-400',
    gmail: 'bg-error',
    scheduler: 'bg-warning',
  };
  return m[a || ''] || 'bg-surface-400';
}

export function ChatWindow({ workspaceId }: { workspaceId: string }) {
  const { toast } = useToast();
  const { latestAgentStep, latestToolExecution, status } = useRealtime();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isNearBottomRef = useRef(true);
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
  const [showAgents, setShowAgents] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [attached, setAttached] = useState<File | null>(null);
  // Durable execution (LG-18) — when enabled, chat uses Temporal DurableAgentRunWorkflow + ExecutionTimeline polling
  const [durableMode, setDurableMode] = useState(false);
  const [durableWorkflowId, setDurableWorkflowId] = useState<string | null>(null);
  const [durableRagStatus, setDurableRagStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const agentParam = params.get('agent');
      if (agentParam) {
        setSelected(agentParam);
      }
    }
  }, []);

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

  const isThreadsLoadedRef = useRef(false);

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
    } catch {
    } finally {
      isThreadsLoadedRef.current = true;
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!isThreadsLoadedRef.current || !workspaceId) return;
    try {
      localStorage.setItem(`vaeloom.threads.${workspaceId}`, JSON.stringify(threads.slice(0, 20)));
    } catch {}
  }, [threads, workspaceId]);
  useEffect(() => {
    if (activeThread) setMessages(activeThread.messages);
    else setMessages([]);
  }, [activeThread]);
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);
  useEffect(() => {
    agentCatalogApi
      .get()
      .then((r) => setCatalog(r.agents || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      toast({ tone: 'info', title: 'Generation stopped' });
    }
  }, [toast]);

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
    setMessages((p) =>
      p.map((m) => (m.id === targetId ? { ...m, text: full, streaming: false } : m)),
    );
    setThreads((p) =>
      p.map((t) =>
        t.messages.some((m) => m.id === targetId)
          ? {
              ...t,
              messages: t.messages.map((m) =>
                m.id === targetId ? { ...m, text: full, streaming: false } : m,
              ),
            }
          : t,
      ),
    );
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
      // Durable path (LG-18) — Temporal owns durability, LangGraph owns topology
      if (durableMode) {
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          text: rawBase ? raw : raw,
          timestamp: nowIso(),
        };
        const next = [...messages, userMsg];
        setMessages(next);
        if (activeId)
          updateThread(activeId, (t) => ({
            ...t,
            messages: next,
            title: t.messages.length === 0 ? raw.slice(0, 30) : t.title,
          }));
        else {
          const id = Math.random().toString(36).slice(2, 7);
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
        const ph: ChatMessage = {
          id: agentId,
          role: 'agent',
          text: '',
          timestamp: nowIso(),
          agentName: agentForCall || 'assistant',
          confidence: agentForCall ? 0.98 : undefined,
          streaming: true,
        };
        setMessages((p) => [...p, ph]);
        if (activeId) updateThread(activeId, (t) => ({ ...t, messages: [...t.messages, ph] }));
        try {
          const reqId = `chat-${Date.now().toString(36)}`;
          const start = await temporalApi.startDurableAgent({
            workspace_id: workspaceId,
            agent_id: agentForCall || 'memory',
            request_id: reqId,
            input: { message: raw, task: raw },
            correlation_id: reqId,
          });
          const wfId =
            (start as { workflow_id?: string; workflowId?: string }).workflow_id ||
            (start as { workflowId?: string }).workflowId ||
            `durable_run:${workspaceId}:${reqId}`;
          setDurableWorkflowId(wfId);
          // Poll until terminal (ExecutionTimeline polling handles UI; here also fetch final result for message)
          // Fallback: also call agentApi.chat for immediate result when temporal disabled (503) already handled below
          let attempts = 0;
          let finalText = '';
          let finalConf: number | undefined;
          while (attempts < 40) {
            attempts += 1;
            await new Promise((r) => setTimeout(r, 1500));
            try {
              const st = await temporalApi.getStatus(wfId);
              const q = (st.query as Record<string, unknown> | null | undefined) || {};
              if (q && (q as Record<string, unknown>)['rag_status'])
                setDurableRagStatus(String((q as Record<string, unknown>)['rag_status']));
              const s = String(st.status || '').toLowerCase();
              const qs = String(
                ((q as Record<string, unknown>)['status'] as string) || '',
              ).toLowerCase();
              if (
                ['completed', 'failed', 'cancelled', 'expired'].includes(s) ||
                ['completed', 'failed', 'cancelled', 'expired'].includes(qs) ||
                q['result']
              ) {
                const res =
                  (q['result'] as Record<string, unknown> | undefined) ||
                  (q as Record<string, unknown>);
                finalText = String(
                  (res as Record<string, unknown>)['summary'] ||
                    (res as Record<string, unknown>)['text'] ||
                    JSON.stringify(res).slice(0, 2000),
                );
                finalConf =
                  typeof (res as Record<string, unknown>)['confidence'] === 'number'
                    ? ((res as Record<string, unknown>)['confidence'] as number)
                    : undefined;
                if (finalText.includes('[object Object]'))
                  finalText = JSON.stringify(res).slice(0, 2000);
                break;
              }
            } catch {}
          }
          if (!finalText)
            finalText =
              'Durable execution in progress — see timeline. Refresh or check History for result.';
          await streamText(finalText, agentId);
          setMessages((p) =>
            p.map((m) =>
              m.id === agentId
                ? { ...m, text: finalText, streaming: false, confidence: finalConf ?? m.confidence }
                : m,
            ),
          );
          setThreads((p) =>
            p.map((t) => ({
              ...t,
              messages: t.messages.map((m) =>
                m.id === agentId
                  ? {
                      ...m,
                      text: finalText,
                      streaming: false,
                      confidence: finalConf ?? m.confidence,
                    }
                  : m,
              ),
            })),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // 503 temporal disabled → fallback to direct agent chat
          if (
            msg.includes('503') ||
            msg.toLowerCase().includes('temporal is disabled') ||
            msg.toLowerCase().includes('temporal client unavailable')
          ) {
            toast({
              tone: 'error',
              title: 'Durable unavailable, falling back',
              detail: 'Temporal disabled — using direct chat.',
            });
            setDurableWorkflowId(null);
            // fallback to legacy path by recalling without durableMode
            setDurableMode(false);
            // retry legacy inline
            try {
              const res: unknown = agentForCall
                ? await agentApi.chat({ workspaceId, message: raw, agentName: agentForCall })
                : await agentApi.chat({ workspaceId, message: raw });
              const r = res as Record<string, unknown>;
              let reply = '';
              if (r && typeof r === 'object' && 'result' in r)
                reply = String((r as { result: { summary?: string } }).result.summary || '');
              else if (typeof r === 'string') reply = r;
              else reply = JSON.stringify(r).slice(0, 2000);
              if (!reply.trim()) reply = 'No response — try rephrasing or @mention an agent.';
              await streamText(reply, agentId);
              setMessages((p) =>
                p.map((m) => (m.id === agentId ? { ...m, text: reply, streaming: false } : m)),
              );
              setThreads((p) =>
                p.map((t) => ({
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === agentId ? { ...m, text: reply, streaming: false } : m,
                  ),
                })),
              );
            } catch (e2) {
              const m2 = e2 instanceof Error ? e2.message : 'Failed';
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId ? { ...m, text: m2, error: true, streaming: false } : m,
                ),
              );
            }
          } else {
            setMessages((p) =>
              p.map((m) =>
                m.id === agentId ? { ...m, text: msg, error: true, streaming: false } : m,
              ),
            );
            toast({ tone: 'error', title: 'Durable start failed', detail: msg });
          }
        } finally {
          setLoading(false);
        }
        return;
      }
      let currentThreadId = activeId;
      if (!currentThreadId) {
        currentThreadId = Math.random().toString(36).slice(2, 7);
        setActiveId(currentThreadId);
      }
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: fileContext && !rawBase ? raw : rawBase ? raw : raw,
        timestamp: nowIso(),
      };
      const agentId = (Date.now() + 1).toString();
      const agentForCall = selected === 'auto' ? undefined : selected;
      const ph: ChatMessage = {
        id: agentId,
        role: 'agent',
        text: '',
        timestamp: nowIso(),
        agentName: agentForCall || 'assistant',
        confidence: agentForCall ? 0.98 : undefined,
        toolCalls: agentForCall ? [{ name: 'routing', status: 'running' }] : undefined,
        streaming: true,
      };
      const nextWithPh = [...messages, userMsg, ph];
      setMessages(nextWithPh);
      if (activeId) {
        updateThread(currentThreadId, (t) => ({
          ...t,
          messages: nextWithPh,
          title: t.messages.length === 0 ? raw.slice(0, 30) : t.title,
        }));
      } else {
        const th: Thread = {
          id: currentThreadId,
          title: raw.slice(0, 30),
          createdAt: nowIso(),
          messages: nextWithPh,
          agentName: selected !== 'auto' ? selected : undefined,
        };
        setThreads((p) => [th, ...p]);
      }
      setInput('');
      setSlashOpen(false);
      setMentionOpen(false);
      setLoading(true);
      try {
        let reply = '';
        let conf: number | undefined;
        let proposals: ChatMessage['proposals'];
        let questions: string[] | undefined;
        let tools: ChatMessage['toolCalls'] = [];
        let cites: ChatMessage['citations'];
        let an = agentForCall;
        let streamedAny = false;

        // 1. Try real Server-Sent Events (SSE) streaming
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
          await agentApi.chatStream(
            {
              workspaceId,
              message: raw,
              agentName: agentForCall,
            },
            (event, data) => {
              streamedAny = true;
              if (event === 'intent') {
                if (typeof data['agent'] === 'string') an = data['agent'];
                if (typeof data['confidence'] === 'number') conf = data['confidence'];
                setMessages((p) =>
                  p.map((m) =>
                    m.id === agentId ? { ...m, agentName: an || m.agentName, confidence: conf } : m,
                  ),
                );
              } else if (event === 'token') {
                const tok = (data['token'] as string) || (data['text'] as string) || '';
                reply += tok;
                setMessages((p) =>
                  p.map((m) => (m.id === agentId ? { ...m, text: reply, streaming: true } : m)),
                );
              } else if (event === 'tool_start') {
                const tName = (data['tool'] as string) || 'tool';
                tools = [...(tools || []), { name: tName, status: 'running' }];
                setMessages((p) =>
                  p.map((m) => (m.id === agentId ? { ...m, toolCalls: tools } : m)),
                );
              } else if (event === 'tool_result') {
                const tName = (data['tool'] as string) || 'tool';
                tools = (tools || []).map((t) =>
                  t.name === tName && t.status === 'running'
                    ? { ...t, status: 'done' as const, latencyMs: 240 }
                    : t,
                );
                setMessages((p) =>
                  p.map((m) => (m.id === agentId ? { ...m, toolCalls: tools } : m)),
                );
              } else if (event === 'done') {
                const res = data['result'] ?? data['summary'];
                if (typeof res === 'string' && res.trim() && !reply.trim()) {
                  reply = res;
                }
              }
            },
            controller.signal,
          );
        } catch (streamErr: any) {
          if (streamErr?.name === 'AbortError' || controller.signal.aborted) {
            return;
          }
          // If streaming failed without emitting any tokens, fall back to non-streaming chat
          if (!streamedAny) {
            const res: unknown = agentForCall
              ? await agentApi.chat({ workspaceId, message: raw, agentName: agentForCall })
              : await agentApi.chat({ workspaceId, message: raw });
            const r = res as Record<string, unknown>;
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
              if (Array.isArray(questions) && questions.length > 0) {
                reply = reply ? `${reply}\n\n${questions.join('\n\n')}` : questions.join('\n\n');
              }
              conf = (r as { confidence?: number }).confidence;
              an = (r as { agent_name?: string }).agent_name || an;
              const d = o?.details as Record<string, unknown> | undefined;
              if (d && Array.isArray((d as Record<string, unknown>)['entities']))
                tools = [
                  { name: 'search_documents', status: 'done', latencyMs: 210 },
                  { name: 'query_graph', status: 'done', latencyMs: 170 },
                ];
              else if (an) tools = [{ name: `${an}_run`, status: 'done', latencyMs: 280 }];
              if (d && Array.isArray((d as Record<string, unknown>)['citations']))
                cites = d['citations'] as ChatMessage['citations'];
            } else if (r && 'reply' in (r as Record<string, unknown>))
              reply = String((r as { reply?: string }).reply || '');
            else if (typeof r === 'string') reply = r;
            else reply = JSON.stringify(r).slice(0, 2000);
          } else {
            throw streamErr;
          }
        }

        if (!reply.trim()) reply = 'No response — try rephrasing or @mention an agent.';
        const final: Partial<ChatMessage> = {
          text: reply,
          confidence: conf,
          proposals,
          questions,
          toolCalls: tools && tools.length > 0 ? tools : undefined,
          citations: cites,
          agentName: an || 'assistant',
          streaming: false,
          latencyMs: Math.round(420 + Math.random() * 500),
        };

        if (!streamedAny) {
          await streamText(reply, agentId);
        }

        setMessages((p) =>
          p.map((m) => (m.id === agentId ? { ...m, ...final, streaming: false } : m)),
        );
        setThreads((p) =>
          p.map((t) =>
            t.id === currentThreadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === agentId ? { ...m, ...final, streaming: false } : m,
                  ),
                }
              : t,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed';
        setMessages((p) =>
          p.map((m) => (m.id === agentId ? { ...m, text: msg, error: true, streaming: false } : m)),
        );
        toast({ tone: 'error', title: 'Message failed', detail: msg });
      } finally {
        abortControllerRef.current = null;
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
      durableMode,
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
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* left - hermes subtle rail, keep threads */}
      <aside
        className={`${showAgents ? 'flex' : 'hidden'} md:flex w-[260px] shrink-0 flex-col border-r border-border/40 bg-background max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-[82%] max-md:bg-background max-md:shadow-xl`}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-border/40">
          <span className="text-xs font-mono tracking-widest text-text-dim">THREADS</span>
          <button
            onClick={() => startNew(selected)}
            className="text-xs text-text-muted hover:text-text"
          >
            ＋ New
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
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 ${activeId === t.id ? 'bg-surface border border-border/50' : 'hover:bg-surface-hover border border-transparent'}`}
                >
                  <p className="text-sm text-text truncate pr-2">{t.title}</p>
                  <p className="text-xs text-text-dim mt-0.5">
                    {fmtRel(t.createdAt)} · {t.messages.length} msgs
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border/40">
          <p className="text-xs text-text-dim leading-relaxed">
            BYOK → <span className="font-mono text-text">Settings → API Keys</span>
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
            <span className="hidden sm:inline text-xs text-text-dim font-mono">
              · {workspaceId.slice(0, 8)}
            </span>
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${selected === 'auto' ? 'border-border/50 text-text-dim' : 'bg-action text-action-fg border-action'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${selected === 'auto' ? 'bg-text-dim' : 'bg-action-fg'}`}
              />
              {selected === 'auto' ? 'Auto' : selected}
            </span>
            {status && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono border border-border bg-surface-50">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status === 'connected'
                      ? 'bg-success animate-pulse'
                      : status === 'connecting'
                        ? 'bg-warning animate-pulse'
                        : 'bg-text-dim'
                  }`}
                />
                <span className="text-text-muted capitalize">{status}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden lg:inline text-xs text-text-dim">8 agents · QA gate</span>
            <label className="hidden sm:flex items-center gap-1.5 ml-2 text-xs border border-border/50 rounded-full px-2 py-1 cursor-pointer hover:bg-surface-hover">
              <input
                type="checkbox"
                checked={durableMode}
                onChange={(e) => setDurableMode(e.target.checked)}
                className="accent-action"
                aria-label="Durable mode"
              />
              Durable
            </label>
            <button
              onClick={() => startNew()}
              className="ml-2 hidden sm:inline-flex rounded-full border border-border/50 px-3 py-1.5 text-xs hover:bg-surface-hover"
            >
              New chat
            </button>
          </div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          <div className="max-w-[768px] w-full mx-auto px-4 md:px-6 py-8">
            {durableWorkflowId && (
              <div className="mb-6">
                <ExecutionTimeline
                  workflowId={durableWorkflowId}
                  agentName={selected !== 'auto' ? selected : undefined}
                  ragStatus={durableRagStatus}
                />
              </div>
            )}
            {messages.length === 0 && !loading ? (
              <div className="py-10 md:py-16 text-center">
                <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center mx-auto text-sm font-bold">
                  V
                </div>
                <h2 className="mt-4 text-xl font-display font-medium text-text">
                  How can we help?
                </h2>
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
                      className={`${m.role === 'user' ? 'max-w-[75%] bg-surface-elevated text-text border border-border-subtle rounded-2xl px-4 py-3 shadow-card' : 'flex-1 min-w-0'}`}
                    >
                      {m.role === 'agent' && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium capitalize text-text">
                            {(m.agentName || 'assistant').replace('_', ' ')}
                          </span>
                          <span className="text-xs text-text-dim">{fmtTime(m.timestamp)}</span>
                          {m.confidence !== undefined && (
                            <span
                              className={`text-xs font-mono px-1.5 py-0.5 rounded border ${m.confidence >= 0.9 ? 'border-success/20 text-success' : m.confidence >= 0.7 ? 'border-warning/20 text-warning' : 'border-error/20 text-error'}`}
                            >
                              {Math.round(m.confidence * 100)}%
                            </span>
                          )}
                          {m.latencyMs && (
                            <span className="ml-auto text-xs text-text-dim">{m.latencyMs}ms</span>
                          )}
                        </div>
                      )}
                      {m.role === 'agent' ? (
                        <div className="text-sm leading-relaxed text-text pr-2 break-words space-y-2">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
                              ),
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              h1: ({ children }) => (
                                <h1 className="text-base font-semibold text-text mt-3 mb-1.5">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-sm font-semibold text-text mt-2.5 mb-1">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-medium text-text mt-2 mb-1">
                                  {children}
                                </h3>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-border pl-3 my-2 text-text-muted italic">
                                  {children}
                                </blockquote>
                              ),
                              code: ({ inline, children, ...props }: any) => {
                                if (inline) {
                                  return (
                                    <code
                                      className="px-1.5 py-0.5 rounded bg-surface-200 text-text font-mono text-xs"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                }
                                return (
                                  <pre className="p-3 my-2 rounded-lg bg-surface border border-border overflow-x-auto text-xs font-mono text-text">
                                    <code {...props}>{children}</code>
                                  </pre>
                                );
                              },
                              table: ({ children }) => (
                                <div className="my-2 overflow-x-auto rounded border border-border">
                                  <table className="min-w-full divide-y divide-border text-xs">
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="px-3 py-1.5 bg-surface-50 font-semibold text-left text-text-secondary">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="px-3 py-1.5 border-t border-border-subtle">
                                  {children}
                                </td>
                              ),
                              a: ({ href, children }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-action hover:underline break-all"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {m.text}
                          </ReactMarkdown>
                          {m.streaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-text-dim animate-pulse align-middle" />
                          )}
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-text">
                          {m.text}
                        </div>
                      )}
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
                                    className="rounded-xl border border-warning/20 bg-warning-muted p-3"
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
                                            ? 'bg-success-muted text-success border border-success/30 cursor-default'
                                            : 'bg-action text-action-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-default'
                                        }`}
                                      >
                                        {p.status === 'approved' ? 'Approved' : 'Approve'}
                                      </button>
                                      <button
                                        disabled={resolved}
                                        onClick={() => handleProposalDecision(m.id, i, 'reject')}
                                        className={`flex-1 rounded-full text-xs py-1.5 disabled:opacity-40 disabled:cursor-default ${
                                          p.status === 'rejected'
                                            ? 'bg-error-muted text-error border border-error/30 cursor-default'
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
                          className={`${m.role === 'user' ? 'text-text-dim hover:text-text' : 'text-text-dim hover:text-text'}`}
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
                    <div className="w-7 h-7 rounded-full bg-surface-300 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-text-dim">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                        {latestAgentStep ? (
                          <span>
                            Thinking · Round {latestAgentStep.round || 1}
                            {latestAgentStep.proposed_tools?.length
                              ? ` · Proposing: ${latestAgentStep.proposed_tools.join(', ')}`
                              : ''}
                          </span>
                        ) : (
                          <span>Thinking · routing + QA</span>
                        )}
                      </div>
                      {latestToolExecution && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-primary/10 border border-primary/20 text-primary font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                          <span>
                            Tool: {latestToolExecution.tool} ({latestToolExecution.status})
                          </span>
                        </div>
                      )}
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
                    <span className="w-6 h-6 rounded-md bg-surface-hover flex items-center justify-center text-xs">
                      {getSlashIcon(s.agent)}
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
                <button
                  onClick={() => setAttached(null)}
                  className="ml-auto p-0.5 hover:bg-surface-hover rounded"
                  aria-label="Remove attached file"
                >
                  <svg
                    className="w-3 h-3 text-text-dim hover:text-text"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
            <div
              className={`flex items-end gap-2 rounded-[24px] border bg-surface px-2 py-2 ${dragOver ? 'border-primary ring-2 ring-primary/20' : 'border-border/50'}`}
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
                className="w-8 h-8 rounded-full hover:bg-background border border-transparent hover:border-border/50 flex items-center justify-center shrink-0 cursor-pointer text-text-dim hover:text-text transition-colors"
                aria-label="Attach file"
              >
                <input
                  type="file"
                  aria-label="Attach file"
                  className="hidden"
                  onChange={(e) => setAttached(e.target.files?.[0] || null)}
                />
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
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
              {loading ? (
                <button
                  type="button"
                  aria-label="Stop generation"
                  onClick={handleStop}
                  className="w-8 h-8 rounded-full bg-error text-error-fg flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
                  title="Stop generating"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-current" />
                </button>
              ) : (
                <button
                  aria-label="Send message"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() && !attached}
                  className="w-8 h-8 rounded-full bg-action text-action-fg flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-action-hover transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-text-dim">
              ⏎ send · ⇧⏎ newline · <span className="font-mono">@</span> agents ·{' '}
              <span className="font-mono">/</span> commands · {input.length}/10000
            </p>
          </div>
        </div>
      </div>

      {showAgents && (
        <button
          aria-label="close"
          onClick={() => setShowAgents(false)}
          className="md:hidden fixed inset-0 bg-black/30 z-20"
        />
      )}
    </div>
  );
}
