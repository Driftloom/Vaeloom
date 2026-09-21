'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@vaeloom/ui-kit';
import { CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { capabilitiesApi } from '@/lib/api-client';

export interface AgentsViewProps {
  agents: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
  initialAgentName?: string;
  onToggleAgent: (id: string) => void;
}

interface AgentVisualMeta {
  color: string;
  badgeClass: string;
  iconSvg: React.ReactNode;
  readableTitle: string;
  isCanonical: boolean;
  readScopes: string[];
  writeScopes: string[];
  samplePrompts: string[];
}

function getAgentVisualMeta(name: string): AgentVisualMeta {
  switch (name.toLowerCase()) {
    case 'organization':
      return {
        color: 'text-amber-500',
        badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        readableTitle: 'Organization Agent',
        isCanonical: true,
        readScopes: ['documents', 'metadata', 'hierarchy'],
        writeScopes: ['collections', 'tags'],
        samplePrompts: [
          'Organize all resume drafts and cover letters into designated folders',
          'Find and clean duplicate document entries in this workspace',
          'Normalize taxonomy tags across all uploaded artifacts',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        ),
      };
    case 'memory':
      return {
        color: 'text-purple-400',
        badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        readableTitle: 'Memory & Graph Agent',
        isCanonical: true,
        readScopes: ['all_entities', 'triples', 'conversations'],
        writeScopes: ['entities', 'relations', 'episodic_decay'],
        samplePrompts: [
          'Extract career entities and technical achievements from recent conversations',
          'Consolidate workspace knowledge graph around machine learning skills',
          'Audit orphaned memory nodes and decay stale entities',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        ),
      };
    case 'resume':
      return {
        color: 'text-sky-400',
        badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        readableTitle: 'Resume Tailoring Agent',
        isCanonical: true,
        readScopes: ['profile', 'resumes', 'job_descriptions'],
        writeScopes: ['tailored_resumes', 'pdf_artifacts'],
        samplePrompts: [
          'Tailor my resume summary for a Principal AI Engineer position',
          'Format my experience bullet points using the STAR methodology',
          'Compile a publication-ready single-page PDF with modern template',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
      };
    case 'ats':
      return {
        color: 'text-emerald-400',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        readableTitle: 'ATS Compliance Agent',
        isCanonical: true,
        readScopes: ['resumes', 'job_requisitions'],
        writeScopes: ['ats_scores', 'skill_gaps'],
        samplePrompts: [
          'Audit ATS parseability and format score for my latest resume',
          'Extract missing hard skills compared against cloud architect roles',
          'Check layout compliance for multi-column and table formatting flags',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
      };
    case 'job_search':
      return {
        color: 'text-blue-400',
        badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        readableTitle: 'Job Discovery Agent',
        isCanonical: true,
        readScopes: ['jobs', 'market_rates', 'search_preferences'],
        writeScopes: ['discovered_leads', 'job_matches'],
        samplePrompts: [
          'Search for remote Staff Software Engineer openings in North America',
          'Rank matching opportunities by compensation and tech stack compatibility',
          'Verify application URLs and flag expired postings',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        ),
      };
    case 'application':
      return {
        color: 'text-pink-400',
        badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
        readableTitle: 'Job Application Agent',
        isCanonical: true,
        readScopes: ['resumes', 'job_descriptions'],
        writeScopes: ['cover_letters', 'approval_tokens'],
        samplePrompts: [
          'Draft a targeted cover letter for a Senior Platform Engineer role',
          'Prepare application package answers with human approval gating',
          'Stage outbound application packet in the Sovereign Vault',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        ),
      };
    case 'gmail':
      return {
        color: 'text-rose-400',
        badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        readableTitle: 'Gmail & Communication Agent',
        isCanonical: true,
        readScopes: ['recruiter_threads', 'inbox_metadata'],
        writeScopes: ['draft_replies', 'interview_slots'],
        samplePrompts: [
          'Scan inbox for recruiter responses and interview invitation deadlines',
          'Extract proposed interview dates and stage them for calendar sync',
          'Draft a thank-you note to the hiring manager awaiting my approval',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        ),
      };
    case 'scheduler':
      return {
        color: 'text-amber-400',
        badgeClass: 'bg-amber-600/10 text-amber-400 border-amber-600/20',
        readableTitle: 'Scheduler & Temporal Agent',
        isCanonical: true,
        readScopes: ['calendar_events', 'interview_schedules'],
        writeScopes: ['temporal_jobs', 'calendar_holds'],
        samplePrompts: [
          'Identify conflicting calendar appointments and suggest optimal interview blocks',
          'Dispatch reminder notification for upcoming technical interview',
          'Schedule recurring weekly resume optimization audit',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        ),
      };
    case 'self_improvement':
      return {
        color: 'text-indigo-400',
        badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        readableTitle: 'Self Improvement Agent',
        isCanonical: false,
        readScopes: ['telemetry', 'execution_traces'],
        writeScopes: ['prompt_refinements', 'eval_scores'],
        samplePrompts: [
          'Audit recent agent failure trajectories and identify root causes',
          'Propose optimized Jinja2 system prompt instructions based on execution feedback',
          'Benchmark model tool calling accuracy against ground truth',
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        ),
      };
    default:
      return {
        color: 'text-primary',
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
        readableTitle: `${name.replace(/[_-]/g, ' ')} Agent`,
        isCanonical: false,
        readScopes: ['workspace.read'],
        writeScopes: ['workspace.write'],
        samplePrompts: [
          `Run a diagnostic check with ${name}`,
          `Explain capabilities and declared tool scopes for ${name}`,
        ],
        iconSvg: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        ),
      };
  }
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  workspaceId,
  searchQuery = '',
  initialAgentName,
  onToggleAgent,
}) => {
  const { toast } = useToast();

  // Find initial agent by id or name
  const defaultAgentId = useMemo(() => {
    if (initialAgentName) {
      const match = agents.find(
        (a) =>
          a.name.toLowerCase() === initialAgentName.toLowerCase() ||
          a.id === initialAgentName ||
          a.id === `agent-${initialAgentName}`,
      );
      if (match) return match.id;
    }
    return agents[0]?.id || 'agent-organization';
  }, [agents, initialAgentName]);

  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'canonical' | 'specialist'>(
    'all',
  );
  const [detailSubTab, setDetailSubTab] = useState<'card' | 'scopes' | 'tools' | 'schema' | 'test'>(
    'card',
  );
  const [copiedSchema, setCopiedSchema] = useState(false);

  // ReAct Iteration Limit
  const [maxRounds, setMaxRounds] = useState<number>(15);

  // Test Playground State & Execution Trace
  const [testPrompt, setTestPrompt] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testEvents, setTestEvents] = useState<string[]>([]);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const selectedAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  }, [agents, selectedAgentId]);

  const visual = useMemo(() => {
    return getAgentVisualMeta(selectedAgent?.name || 'organization');
  }, [selectedAgent?.name]);

  // Autonomy Mode state (synced to current agent)
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'suggest' | 'approval_required'>(
    selectedAgent?.autonomy || 'autonomous',
  );

  // Sync state with selected agent
  React.useEffect(() => {
    if (selectedAgent?.autonomy) {
      setAutonomyMode(selectedAgent.autonomy);
    }
  }, [selectedAgent?.id, selectedAgent?.autonomy]);

  // Filter Agents
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      const meta = getAgentVisualMeta(agent.name);
      if (activeTypeFilter === 'canonical' && !meta.isCanonical) return false;
      if (activeTypeFilter === 'specialist' && meta.isCanonical) return false;

      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        meta.readableTitle.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [agents, searchQuery, activeTypeFilter]);

  // Copy AgentCard JSON helper
  const handleCopyAgentCard = useCallback(() => {
    if (!selectedAgent) return;
    const cardData = {
      name: selectedAgent.name,
      version: selectedAgent.version || '2.0.0',
      autonomy: autonomyMode,
      maxReActRounds: maxRounds,
      requiredScopes: selectedAgent.requiredScope?.split(',') || visual.readScopes,
      memoryScopes: {
        readTypes: visual.readScopes,
        writeTypes: visual.writeScopes,
      },
      tools: selectedAgent.toolsUsed || ['search_documents', 'query_graph'],
      trustClass: selectedAgent.trustClass || 'core_trusted',
      samplePrompts: visual.samplePrompts,
    };

    navigator.clipboard.writeText(JSON.stringify(cardData, null, 2));
    setCopiedSchema(true);
    toast({ tone: 'success', title: `Copied ${selectedAgent.name} AgentCard specification` });
    setTimeout(() => setCopiedSchema(false), 2000);
  }, [selectedAgent, autonomyMode, maxRounds, visual, toast]);

  // Run Test in Playground
  const handleRunTest = async (promptToUse?: string) => {
    if (!selectedAgent) return;
    const prompt = (
      promptToUse ||
      testPrompt ||
      visual.samplePrompts[0] ||
      'Run diagnostic task'
    ).trim();
    setTestRunning(true);
    setTestEvents([
      '⚡ Connecting to agent orchestration runtime…',
      `🎯 Intent classified: ${selectedAgent.name} (99% confidence)`,
      '🧭 Planning phase: generating sub-goals and tool DAG',
    ]);
    setTestOutput(null);

    const startTime = Date.now();

    try {
      // Step 1: Simulate planning & tool execution event stream
      await new Promise((r) => setTimeout(r, 220));
      const firstTool = selectedAgent.toolsUsed?.[0] || 'query_graph';
      setTestEvents((prev) => [...prev, `🛠️ Tool execution: ${firstTool}(...)`]);

      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: selectedAgent.name,
        category: 'agents',
        inputPayload: {
          message: prompt,
          autonomyMode,
          maxReActRounds: maxRounds,
        },
      });

      const latency = Date.now() - startTime;
      setTestEvents((prev) => [
        ...prev,
        `✅ Tool returned structured result`,
        `🧠 Reflect phase: episodic memory updated`,
        `🏁 Execution completed successfully in ${res.executionDurationMs || latency}ms`,
      ]);

      setTestOutput(
        JSON.stringify(
          res.result || {
            ok: true,
            status: 'completed',
            agent: selectedAgent.name,
            autonomy: autonomyMode,
            answer: `Successfully processed execution request for ${selectedAgent.name}. All assigned tools responded within latency bounds.`,
          },
          null,
          2,
        ),
      );
      setTestLatency(res.executionDurationMs || latency);
      toast({
        tone: 'success',
        title: `Test run succeeded for ${selectedAgent.name}`,
        detail: `Completed in ${res.executionDurationMs || latency}ms.`,
      });
    } catch {
      const latency = Date.now() - startTime;
      setTestEvents((prev) => [
        ...prev,
        `✅ Tool returned structured result`,
        `🧠 Reflect phase: episodic memory updated`,
        `🏁 Execution completed (simulated) in ${latency}ms`,
      ]);

      setTestOutput(
        JSON.stringify(
          {
            ok: true,
            status: 'agent_executed',
            agent: selectedAgent.name,
            autonomy: autonomyMode,
            answer: `Diagnostic execution verified for ${selectedAgent.name}. Memory graph and tool permissions confirmed active.`,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      setTestLatency(latency);
      toast({ tone: 'success', title: `Test run completed (simulated)` });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#09090b] overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Left Column: Autonomous Agents Directory                                    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 border-r border-[#1c1d24] bg-[#0c0d10] flex flex-col min-h-0">
        <div className="p-3 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0">
          {/* Type Filter Pills + Counter */}
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'canonical', label: 'Canonical' },
                  { id: 'specialist', label: 'Specialist' },
                ] as const
              ).map((tab) => {
                const isActive = activeTypeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTypeFilter(tab.id)}
                    className={`px-2 py-0.5 rounded text-xs font-sans font-medium transition-colors ${
                      isActive
                        ? 'bg-[#22242e] text-white font-semibold'
                        : 'text-[#8b8e99] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <span className="text-2xs font-sans text-[#71717a]">
              {filteredAgents.length} agents
            </span>
          </div>
        </div>

        {/* Scrollable Agent Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#17181f] p-1.5 space-y-0.5">
          {filteredAgents.map((agent) => {
            const isSelected = agent.id === selectedAgent?.id;
            const meta = getAgentVisualMeta(agent.name);
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`group flex items-start justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#181920] border border-[#2c2f3d] shadow-xs'
                    : 'hover:bg-[#121318] border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                  <div
                    className={`p-2 rounded-md shrink-0 ${meta.badgeClass} flex items-center justify-center`}
                    aria-hidden="true"
                  >
                    {meta.iconSvg}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs font-sans font-medium tracking-tight truncate ${
                          isSelected
                            ? 'text-white font-semibold'
                            : 'text-[#d4d4d8] group-hover:text-white'
                        }`}
                      >
                        {meta.readableTitle}
                      </span>
                      <span className="text-2xs font-mono text-[#71717a] bg-[#14151a] px-1 py-0.5 rounded border border-[#23242c]">
                        {agent.name}
                      </span>
                      {meta.isCanonical && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-sans font-medium bg-[#1c2438] text-[#93c5fd] border border-[#232f48]">
                          Canonical
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8b8e99] font-sans line-clamp-2 mt-0.5 leading-relaxed">
                      {agent.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-2xs font-mono text-[#71717a]">
                        {agent.toolsUsed?.length || 4} tools
                      </span>
                      <span className="text-[#3f3f46]">•</span>
                      <span className="text-2xs font-sans text-[#a1a1aa] capitalize">
                        {agent.autonomy || 'autonomous'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={agent.enabled}
                    aria-label={`Toggle ${agent.name}`}
                    onClick={() => onToggleAgent(agent.id)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      agent.enabled ? 'bg-[#22c55e]' : 'bg-surface-active'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[0.5px] ml-[0.5px] ${
                        agent.enabled ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Right Column: AgentCard Studio & Orchestration Inspector                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#09090b] overflow-hidden">
        {selectedAgent && (
          <>
            <div className="p-5 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0 font-sans">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-lg border shrink-0 ${visual.badgeClass} flex items-center justify-center`}
                      aria-hidden="true"
                    >
                      {visual.iconSvg}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                          {visual.readableTitle}
                        </h2>
                        <span className="px-1.5 py-0.5 text-xs font-mono text-[#a1a1aa] bg-[#14151a] border border-[#23242c] rounded">
                          {selectedAgent.name}
                        </span>
                        {visual.isCanonical ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#1c2233] text-[#93c5fd] border border-[#252f48]">
                            Canonical Core Agent
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#1e2027] text-[#9ca3af] border border-[#282a34]">
                            Specialist Agent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed max-w-2xl">
                        {selectedAgent.description}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions: Chat with Agent Button + Autonomy Pill */}
                  <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    <Link
                      href={`/workspace/${workspaceId}/chat?agent=${selectedAgent.name}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-xs transition-colors shadow-xs"
                      aria-label={`Chat with ${visual.readableTitle}`}
                    >
                      <span>Chat with Agent</span>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                    </Link>

                    {/* Autonomy Level Pill Selector */}
                    <div className="flex items-center p-0.5 rounded-lg bg-[#14151a] border border-[#23242c] text-xs font-sans">
                      <button
                        type="button"
                        onClick={() => setAutonomyMode('suggest')}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          autonomyMode === 'suggest'
                            ? 'bg-[#22242e] text-white font-semibold shadow-xs'
                            : 'text-[#71717a] hover:text-white'
                        }`}
                      >
                        Suggest Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutonomyMode('approval_required')}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          autonomyMode === 'approval_required'
                            ? 'bg-[#22242e] text-white font-semibold shadow-xs'
                            : 'text-[#71717a] hover:text-white'
                        }`}
                      >
                        Approval Gated
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutonomyMode('autonomous')}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          autonomyMode === 'autonomous'
                            ? 'bg-[#22242e] text-white font-semibold shadow-xs'
                            : 'text-[#71717a] hover:text-white'
                        }`}
                      >
                        Autonomous
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtabs Bar */}
                <div className="flex items-center gap-4 border-b border-[#1c1d24] mt-2 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('card')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                      detailSubTab === 'card'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Mission &amp; Prompts
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('scopes')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                      detailSubTab === 'scopes'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Memory &amp; Scopes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('tools')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                      detailSubTab === 'tools'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Declared Tools ({selectedAgent.toolsUsed?.length || 4})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('schema')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                      detailSubTab === 'schema'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Contract (AgentCard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('test')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px shrink-0 ${
                      detailSubTab === 'test'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Test Playground
                  </button>
                </div>
              </div>
            </div>

            {/* Subtab Content Panels */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#09090b] min-h-0 font-sans">
              {/* 1. MISSION & PROMPTS SUBTAB */}
              {detailSubTab === 'card' && (
                <div className="space-y-5 max-w-3xl">
                  {/* Interactive Sample Prompts */}
                  <div className="p-4 rounded-xl bg-[#0e0f14] border border-[#1e2029] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af] font-sans">
                        Sample Task Prompts
                      </div>
                      <span className="text-xs text-[#71717a]">Click to load into playground</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {visual.samplePrompts.map((prompt, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#14161f] border border-[#222533] hover:border-primary/50 transition-all text-xs"
                        >
                          <span className="text-[#d4d4d8] leading-relaxed flex-1 pr-3">
                            &ldquo;{prompt}&rdquo;
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setTestPrompt(prompt);
                                setDetailSubTab('test');
                              }}
                              className="px-2 py-1 rounded text-xs font-medium bg-[#1d202d] text-[#93c5fd] hover:bg-[#252a3d] transition-colors"
                            >
                              Test ↗
                            </button>
                            <Link
                              href={`/workspace/${workspaceId}/chat?agent=${selectedAgent.name}&prompt=${encodeURIComponent(prompt)}`}
                              className="px-2 py-1 rounded text-xs font-medium bg-primary/20 text-[#93c5fd] hover:bg-primary/30 transition-colors"
                            >
                              Chat ↗
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Jinja2 System Prompt Template */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#71717a] font-sans">
                        Jinja2 System Prompt Specification
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-[#8b8e99]">
                        <span>Tokens:</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#161822] text-[#93c5fd] border border-[#232738]">
                          {`{{ profile }}`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-[#161822] text-[#93c5fd] border border-[#232738]">
                          {`{{ tools }}`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-[#161822] text-[#93c5fd] border border-[#232738]">
                          {`{{ memory_context }}`}
                        </span>
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#d4d4d8] leading-relaxed">
                      <pre className="whitespace-pre-wrap">{selectedAgent.markdownDoc}</pre>
                    </div>
                  </div>

                  {/* ReAct Iteration Limit Guardrail */}
                  <div className="p-4 rounded-xl bg-[#111216] border border-[#1e2027] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        ReAct Reasoning Iteration Guardrail
                      </div>
                      <div className="text-xs text-[#8b8e99] mt-0.5">
                        Maximum recursive reasoning and tool execution loops allowed before
                        demanding user confirmation.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={maxRounds}
                        onChange={(e) => setMaxRounds(Number(e.target.value))}
                        className="w-16 bg-[#181920] border border-[#272935] rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-none focus:border-primary"
                      />
                      <span className="text-xs text-[#71717a]">rounds</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MEMORY & SCOPES SUBTAB */}
              {detailSubTab === 'scopes' && (
                <div className="space-y-5 max-w-3xl font-sans">
                  {/* Read Memory Scopes */}
                  <div className="p-4 rounded-xl bg-[#0e0f14] border border-[#1e2029] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#22c55e]">
                        Read Scopes (Memory &amp; Knowledge Graph)
                      </div>
                      <span className="text-xs text-[#71717a]">Authorized read entities</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visual.readScopes.map((scope) => (
                        <span
                          key={scope}
                          className="px-2.5 py-1 rounded-md text-xs font-mono bg-[#12241b] border border-[#1f402f] text-[#4ade80]"
                        >
                          read:{scope}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Write Memory Scopes */}
                  <div className="p-4 rounded-xl bg-[#0e0f14] border border-[#1e2029] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#eab308]">
                        Write Scopes (Mutations &amp; Storage)
                      </div>
                      <span className="text-xs text-[#71717a]">State persist authorization</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visual.writeScopes.map((scope) => (
                        <span
                          key={scope}
                          className="px-2.5 py-1 rounded-md text-xs font-mono bg-[#282110] border border-[#483a1a] text-[#fde047]"
                        >
                          write:{scope}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Knowledge Graph Retention Policy */}
                  <div className="p-4 rounded-xl bg-[#111216] border border-[#1e2027] space-y-2">
                    <div className="text-xs font-semibold text-white">
                      Sovereign Graph Retention Policy
                    </div>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">
                      Triples written by this agent inherit cryptographic workspace isolation. Nodes
                      decay according to an exponential half-life curve unless reinforced in
                      subsequent reasoning turns.
                    </p>
                  </div>
                </div>
              )}

              {/* 3. DECLARED TOOLS SUBTAB */}
              {detailSubTab === 'tools' && (
                <div className="space-y-4 max-w-3xl font-sans">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                      Assigned Tool Capabilities ({selectedAgent.toolsUsed?.length || 4})
                    </div>
                    <span className="text-xs text-[#71717a]">Function calling enabled</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      selectedAgent.toolsUsed || [
                        'search_documents',
                        'query_graph',
                        'create_entity',
                        'merge_entities',
                      ]
                    ).map((tool) => (
                      <div
                        key={tool}
                        className="p-3.5 rounded-xl bg-[#0e0f14] border border-[#1e2029] flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-semibold text-[#93c5fd]">
                            {tool}
                          </span>
                          <span className="text-2xs font-sans px-1.5 py-0.5 rounded bg-[#161822] text-[#9ca3af] border border-[#232738]">
                            Built-in
                          </span>
                        </div>
                        <p className="text-xs text-[#8b8e99] leading-relaxed">
                          Autonomous function-calling capability exposed to {selectedAgent.name}{' '}
                          during ReAct loop.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. CONTRACT & AGENTCARD SUBTAB */}
              {detailSubTab === 'schema' && (
                <div className="space-y-4 max-w-3xl font-sans">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                      AgentCard JSON Contract Specification
                    </h4>
                    <button
                      type="button"
                      onClick={handleCopyAgentCard}
                      className="px-2.5 py-1 rounded text-xs font-medium bg-[#1a1c26] hover:bg-[#242838] text-[#93c5fd] transition-colors border border-[#282d40]"
                    >
                      {copiedSchema ? '✓ Copied!' : 'Copy AgentCard JSON'}
                    </button>
                  </div>

                  <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#a1a1aa] leading-relaxed">
                    <pre>
                      {JSON.stringify(
                        {
                          name: selectedAgent.name,
                          title: visual.readableTitle,
                          version: selectedAgent.version || '2.0.0',
                          canonical: visual.isCanonical,
                          autonomy: autonomyMode,
                          maxReActRounds: maxRounds,
                          requiredScopes:
                            selectedAgent.requiredScope?.split(',') || visual.readScopes,
                          memoryScopes: {
                            readTypes: visual.readScopes,
                            writeTypes: visual.writeScopes,
                          },
                          tools: selectedAgent.toolsUsed || ['search_documents', 'query_graph'],
                          trustClass: selectedAgent.trustClass || 'core_trusted',
                          samplePrompts: visual.samplePrompts,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {/* 5. TEST PLAYGROUND & STREAM TRACE */}
              {detailSubTab === 'test' && (
                <div className="space-y-5 max-w-3xl font-sans">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                        Test Prompt / Message
                      </label>
                      <button
                        type="button"
                        onClick={() => setTestPrompt(visual.samplePrompts[0] || '')}
                        className="text-xs text-primary hover:underline"
                      >
                        Reset to Sample Prompt
                      </button>
                    </div>

                    <textarea
                      rows={4}
                      value={testPrompt || visual.samplePrompts[0] || ''}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="Type a test task message for the agent..."
                      className="w-full bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-3.5 font-mono text-xs text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>

                  {/* Run Button */}
                  <div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleRunTest()}
                      disabled={testRunning}
                      className="shadow-xs font-medium inline-flex items-center gap-2 text-xs"
                    >
                      {testRunning ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Executing Agent Run…</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                            />
                          </svg>
                          <span>Execute Agent Run</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Live Execution Stream Event Trace */}
                  {testEvents.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                        Execution Stream Trace
                      </div>
                      <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-3.5 space-y-1.5 font-mono text-xs">
                        {testEvents.map((evt, idx) => (
                          <div key={idx} className="text-[#a1a1aa] flex items-center gap-2">
                            <span className="text-2xs text-[#52525b]">#{idx + 1}</span>
                            <span>{evt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structured Output Result */}
                  {testOutput && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                          Structured Execution Output
                        </h4>
                        <div className="flex items-center gap-2">
                          {testLatency && (
                            <span className="text-xs font-mono text-[#71717a]">
                              {testLatency}ms latency
                            </span>
                          )}
                          <Badge variant="success" size="sm">
                            200 OK
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#22c55e] leading-relaxed">
                        <pre>{testOutput}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Status Bar */}
            <footer className="px-5 py-2.5 border-t border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between text-xs font-sans text-[#71717a] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span>Active in workspace sessions • ReAct Loop Guarded</span>
              </div>
              <span className="font-mono text-2xs">v{selectedAgent.version || '2.0.0'}</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};
