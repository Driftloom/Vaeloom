'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Badge,
  Button,
  ButtonGroup,
  EmptyState,
  ErrorState,
  Skeleton,
  Switch,
  Tabs,
  TabPanel,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import { CapabilityItem, formatRelativeTime } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import {
  agentCatalogApi,
  capabilitiesApi,
  type AgentCatalogResponse,
  type CatalogAgent,
  type CapabilityTestResponse,
} from '@/lib/api-client';

export interface AgentsViewProps {
  agents: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
  initialAgentName?: string;
  onToggleAgent: (id: string) => void;
}

type AutonomyMode = 'suggest' | 'autonomous' | 'approval_required';
type DetailSubTab = 'mission' | 'scopes' | 'tools' | 'contract' | 'validate';

/**
 * Per-agent accent hue.
 *
 * `globals.css` declares `--agent-hue-*` once per theme, and it is the only
 * accent in the app that already has a light and a high-contrast variant. The
 * previous hard-coded `text-purple-400` / `bg-amber-500/10` palette had neither.
 * `tailwind.config.ts` is outside this file's scope and has no `agentHue`
 * namespace, so the vars are consumed directly: `color` for the glyph and
 * `color-mix()` off the same var for the tint, which keeps the background and
 * the border on the same theme value as the foreground.
 *
 * Only the agents the token set actually names get a hue. Everything else — the
 * ~20 non-canonical registry agents, `application`, `self_improvement` — renders
 * in the neutral token surface rather than being assigned a hue that does not
 * describe it.
 */
const AGENT_HUE_BY_NAME: Readonly<Record<string, string>> = {
  organization: 'organization',
  memory: 'memory',
  resume: 'resume',
  ats: 'ats',
  job_search: 'jobsearch',
  gmail: 'gmail',
  scheduler: 'scheduler',
};

interface AgentHue {
  color: string;
  background: string;
  border: string;
}

const NEUTRAL_HUE: AgentHue = {
  color: 'var(--text-secondary)',
  background: 'var(--surface-elevated)',
  border: 'var(--border)',
};

function agentHue(name: string): AgentHue {
  const key = AGENT_HUE_BY_NAME[name.toLowerCase()];
  if (!key) return NEUTRAL_HUE;
  const color = `var(--agent-hue-${key})`;
  return {
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `color-mix(in srgb, ${color} 32%, transparent)`,
  };
}

function formatAgentTitle(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').trim();
  if (!words) return 'Agent';
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} Agent`;
}

function AgentGlyph({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    organization: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    memory:
      'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    resume:
      'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    ats: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    job_search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    gmail:
      'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    scheduler:
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  };
  const d = paths[name.toLowerCase()] ?? 'M13 10V3L4 14h7v7l9-11h-7z';
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

const AUTONOMY_OPTIONS: { value: AutonomyMode; label: string; hint: string }[] = [
  { value: 'suggest', label: 'Suggest Only', hint: 'Proposes actions and waits for a human.' },
  {
    value: 'approval_required',
    label: 'Approval Gated',
    hint: 'Acts, but every consequential step needs explicit approval.',
  },
  { value: 'autonomous', label: 'Autonomous', hint: 'Acts without per-step approval.' },
];

const AUTONOMY_VALUES: ReadonlySet<string> = new Set<AutonomyMode>([
  'suggest',
  'autonomous',
  'approval_required',
]);

function coerceAutonomy(value: string | undefined, fallback: AutonomyMode): AutonomyMode {
  return value && AUTONOMY_VALUES.has(value) ? (value as AutonomyMode) : fallback;
}

const DEFAULT_REACT_ROUNDS = 15;

interface ReactRoundsSetting {
  value: number;
  /** True only once `capabilitiesApi.update` confirmed the write. */
  persisted: boolean;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  workspaceId,
  searchQuery = '',
  initialAgentName,
  onToggleAgent,
}) => {
  const { toast } = useToast();

  // The same SWR key the page uses, so the catalog request is deduplicated and
  // both components read one cache entry rather than racing two fetches.
  const {
    data: catalog,
    error: catalogError,
    isLoading: catalogLoading,
  } = useSWR('agent-catalog', () => agentCatalogApi.get(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const catalogByName = useMemo(() => {
    const map = new Map<string, CatalogAgent>();
    if (catalog?.agents && Array.isArray(catalog.agents)) {
      for (const agent of catalog.agents) map.set(agent.name.toLowerCase(), agent);
    }
    return map;
  }, [catalog]);

  const defaultAgentId = useMemo(() => {
    if (initialAgentName) {
      const wanted = initialAgentName.toLowerCase();
      const match = agents.find(
        (a) =>
          a.name.toLowerCase() === wanted ||
          a.id === initialAgentName ||
          a.id === `agent-${wanted}`,
      );
      if (match) return match.id;
    }
    return agents[0]?.id ?? null;
  }, [agents, initialAgentName]);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(defaultAgentId);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'canonical' | 'other'>('all');
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('mission');
  const [copiedContract, setCopiedContract] = useState(false);

  const [testPrompt, setTestPrompt] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<CapabilityTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId],
  );

  const selectedCatalogEntry = useMemo(
    () => (selectedAgent ? (catalogByName.get(selectedAgent.name.toLowerCase()) ?? null) : null),
    [catalogByName, selectedAgent],
  );

  // Autonomy and round budget are per-agent server state, so they are re-seeded
  // whenever the selection changes rather than leaking across agents.
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('autonomous');
  const [reactRounds, setReactRounds] = useState<ReactRoundsSetting>({
    value: DEFAULT_REACT_ROUNDS,
    persisted: false,
  });
  // The last value the server confirmed, so a blur that changed nothing does not
  // issue a PATCH.
  const [savedRounds, setSavedRounds] = useState<number | null>(null);
  const [savingAutonomy, setSavingAutonomy] = useState(false);

  useEffect(() => {
    if (!selectedAgent) return;
    setAutonomyMode(
      coerceAutonomy(
        selectedCatalogEntry?.defaultAutonomy,
        coerceAutonomy(selectedAgent.autonomy, 'autonomous'),
      ),
    );
    setTestResult(null);
    setTestError(null);
    setCopiedContract(false);
  }, [selectedAgent, selectedCatalogEntry]);

  // `maxReActRounds` lives in the capability's `config` bag, which is only
  // readable once the agent is a real workspace capability row. Until a catalog
  // entry is attached the setting is presented as unset rather than defaulted.
  useEffect(() => {
    const stored = selectedAgent?.metadata?.['maxReActRounds'];
    const parsed = typeof stored === 'number' && Number.isFinite(stored) ? stored : null;
    setReactRounds(
      parsed === null
        ? { value: DEFAULT_REACT_ROUNDS, persisted: false }
        : { value: parsed, persisted: true },
    );
    setSavedRounds(parsed);
  }, [selectedAgent]);

  const isCanonical = selectedCatalogEntry?.isCanonical ?? null;

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents.filter((agent) => {
      const entry = catalogByName.get(agent.name.toLowerCase());
      const canonical = entry?.isCanonical ?? false;
      if (activeTypeFilter === 'canonical' && !canonical) return false;
      if (activeTypeFilter === 'other' && canonical) return false;

      if (!q) return true;
      return (
        agent.name.toLowerCase().includes(q) ||
        formatAgentTitle(agent.name).toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.tags.some((t) => t.toLowerCase().includes(q)) ||
        (entry?.mission ?? '').toLowerCase().includes(q)
      );
    });
  }, [agents, catalogByName, searchQuery, activeTypeFilter]);

  const handleToggleAutonomy = useCallback(
    async (next: AutonomyMode) => {
      if (!selectedAgent) return;
      const previous = autonomyMode;
      setAutonomyMode(next);
      setSavingAutonomy(true);
      try {
        await capabilitiesApi.update(selectedAgent.id, { autonomy: next });
        toast({
          tone: 'success',
          title: `Autonomy set to ${next.replace('_', ' ')}`,
          detail: `Saved on the ${selectedAgent.name} capability row.`,
        });
      } catch (err) {
        setAutonomyMode(previous);
        toast({
          tone: 'error',
          title: 'Autonomy not saved',
          detail: `${err instanceof Error ? err.message : 'The server write failed.'} Reverted to ${previous.replace('_', ' ')}.`,
        });
      } finally {
        setSavingAutonomy(false);
      }
    },
    [selectedAgent, autonomyMode, toast],
  );

  const handleCommitRounds = useCallback(
    async (next: number) => {
      if (!selectedAgent) return;
      const previous = reactRounds;
      setReactRounds({ value: next, persisted: false });
      try {
        await capabilitiesApi.update(selectedAgent.id, { config: { maxReActRounds: next } });
        setReactRounds({ value: next, persisted: true });
        setSavedRounds(next);
        toast({
          tone: 'success',
          title: `ReAct round budget set to ${next}`,
          detail: 'Stored in the capability config bag. No agent runtime reads it yet.',
        });
      } catch (err) {
        setReactRounds(previous);
        toast({
          tone: 'error',
          title: 'Round budget not saved',
          detail: err instanceof Error ? err.message : 'The server write failed.',
        });
      }
    },
    [selectedAgent, reactRounds, toast],
  );
  /**
   * Contract probe. `POST /agents/capabilities/test` reads the agent's declared
   * contract out of the live registry and executes nothing, so the panel reports
   * the returned `status`/`executed` pair verbatim and never narrates a run that
   * did not happen.
   */
  const handleRunContractProbe = useCallback(async () => {
    if (!selectedAgent) return;
    setTestRunning(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: selectedAgent.name,
        category: 'agents',
        inputPayload: { message: testPrompt.trim() },
      });
      setTestResult(res);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'The request failed.');
    } finally {
      setTestRunning(false);
    }
  }, [selectedAgent, testPrompt, workspaceId]);

  const contract = useMemo(() => {
    if (!selectedAgent) return null;
    const entry = selectedCatalogEntry;
    return {
      name: selectedAgent.name,
      title: formatAgentTitle(selectedAgent.name),
      version: selectedAgent.version ?? null,
      // `null` means the registry has no opinion. It must not be rendered as
      // `false`, which would claim the server classified the agent.
      isCanonical: entry ? entry.isCanonical : null,
      registry: entry ? 'live' : 'not-registered',
      autonomy: autonomyMode,
      maxReActRounds: reactRounds.persisted ? reactRounds.value : null,
      requiredScopes: entry
        ? Array.from(new Set(entry.tools.map((t) => t.requiredScope).filter(Boolean))).sort()
        : selectedAgent.requiredScope
          ? [selectedAgent.requiredScope]
          : [],
      requiredScopesSource: entry ? 'registry' : 'workspace-capability-row',
      memoryScopes: entry ? entry.memoryScopes : null,
      tools: entry ? entry.toolNames : (selectedAgent.toolsUsed ?? []),
      toolsSource: entry ? 'registry' : 'workspace-capability-row',
      trustClass: selectedAgent.trustClass ?? null,
    };
  }, [selectedAgent, selectedCatalogEntry, autonomyMode, reactRounds]);

  const handleCopyContract = useCallback(() => {
    if (!contract) return;
    navigator.clipboard.writeText(JSON.stringify(contract, null, 2));
    setCopiedContract(true);
    toast({ tone: 'success', title: `Copied the ${contract.name} contract as served` });
    setTimeout(() => setCopiedContract(false), 2000);
  }, [contract, toast]);

  const detailTabs = useMemo(
    () => [
      { id: 'mission' as DetailSubTab, label: 'Mission' },
      { id: 'scopes' as DetailSubTab, label: 'Memory & Scopes' },
      {
        id: 'tools' as DetailSubTab,
        label: 'Declared Tools',
        badge: selectedCatalogEntry?.tools.length ?? selectedAgent?.toolsUsed?.length ?? 0,
      },
      { id: 'contract' as DetailSubTab, label: 'Contract' },
      { id: 'validate' as DetailSubTab, label: 'Contract Probe' },
    ],
    [selectedCatalogEntry, selectedAgent],
  );

  if (agents.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-6">
        <EmptyState
          title="No agents in this workspace"
          description="The capability list for this workspace contains no agent entries. Agents become available once one is registered as a capability."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 bg-background text-text overflow-hidden">
      <section
        className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[410px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0"
        aria-labelledby="agents-directory-heading"
      >
        <div className="p-3 border-b border-border bg-surface shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2
              id="agents-directory-heading"
              className="text-xs font-semibold text-text uppercase tracking-wider font-sans"
            >
              Agents
            </h2>
            <span className="text-2xs font-sans text-text-muted">
              {filteredAgents.length} of {agents.length}
            </span>
          </div>

          <ButtonGroup
            attached
            className="w-full [&>button]:flex-1 [&>button]:text-xs [&>button]:px-2"
            aria-label="Filter agents by registry classification"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'canonical', label: 'Canonical' },
                { id: 'other', label: 'Other' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTypeFilter(tab.id)}
                aria-pressed={activeTypeFilter === tab.id}
                className={`py-1 rounded-md text-xs font-sans font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  activeTypeFilter === tab.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </ButtonGroup>

          {catalogError && (
            <p role="status" className="text-2xs font-sans text-warning leading-relaxed">
              Agent registry unavailable: {catalogError.message}. Scopes and tools below come from
              the workspace capability row, not the registry.
            </p>
          )}
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain divide-y divide-border p-1.5 pb-12">
          {filteredAgents.length === 0 && (
            <li className="p-2">
              <EmptyState
                title="No agents match"
                description={
                  searchQuery.trim()
                    ? `Nothing in this workspace matches “${searchQuery.trim()}”.`
                    : 'No agent has this registry classification.'
                }
              />
            </li>
          )}

          {filteredAgents.map((agent) => {
            const entry = catalogByName.get(agent.name.toLowerCase());
            const isSelected = agent.id === selectedAgent?.id;
            const hue = agentHue(agent.name);
            const toolCount = entry?.tools.length ?? agent.toolsUsed?.length ?? 0;
            return (
              <li key={agent.id}>
                <div
                  className={`group flex items-start justify-between gap-2 p-3 rounded-lg transition-colors border ${
                    isSelected
                      ? 'bg-primary/10 border-l-2 border-l-primary border-primary/30 text-primary'
                      : 'hover:bg-surface-hover border-transparent text-text'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className="flex items-start gap-2.5 min-w-0 flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <span
                      className="p-2 rounded-md shrink-0 border flex items-center justify-center"
                      style={{
                        color: hue.color,
                        backgroundColor: hue.background,
                        borderColor: hue.border,
                      }}
                      aria-hidden="true"
                    >
                      <AgentGlyph name={agent.name} />
                    </span>
                    <span className="min-w-0 flex-1 block">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-sans font-semibold tracking-tight truncate ${
                            isSelected ? 'text-primary' : 'text-text'
                          }`}
                        >
                          {formatAgentTitle(agent.name)}
                        </span>
                        <span className="text-2xs font-mono text-text-muted bg-surface-elevated px-1 py-0.5 rounded border border-border">
                          {agent.name}
                        </span>
                        {entry?.isCanonical === true && (
                          <Badge variant="primary" size="sm">
                            Canonical
                          </Badge>
                        )}
                        {entry === undefined && catalog && (
                          <Badge variant="warning" size="sm">
                            Not in registry
                          </Badge>
                        )}
                      </span>
                      <span className="block text-xs text-text-secondary font-sans line-clamp-2 mt-0.5 leading-relaxed">
                        {agent.description}
                      </span>
                      <span className="flex items-center gap-2 mt-1.5">
                        <span className="text-2xs font-mono text-text-muted">
                          {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
                        </span>
                        <span className="text-text-muted" aria-hidden="true">
                          •
                        </span>
                        <span className="text-2xs font-sans text-text-secondary">
                          {coerceAutonomy(
                            entry?.defaultAutonomy,
                            selectedAgent?.autonomy ?? 'autonomous',
                          )}
                        </span>
                      </span>
                    </span>
                  </button>

                  <div className="shrink-0 pt-0.5">
                    <Switch
                      checked={agent.enabled}
                      onChange={() => onToggleAgent(agent.id)}
                      label={<span className="sr-only">{`Toggle ${agent.name}`}</span>}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden">
        {selectedAgent && selectedCatalogEntry === undefined && catalogLoading && (
          <div className="p-5 space-y-3 border-b border-border bg-surface shrink-0">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3 w-full max-w-xl" />
          </div>
        )}

        {selectedAgent ? (
          <>
            <div className="p-5 border-b border-border bg-surface shrink-0 font-sans shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="p-2.5 rounded-lg border shrink-0 flex items-center justify-center"
                    style={{
                      color: agentHue(selectedAgent.name).color,
                      backgroundColor: agentHue(selectedAgent.name).background,
                      borderColor: agentHue(selectedAgent.name).border,
                    }}
                    aria-hidden="true"
                  >
                    <AgentGlyph name={selectedAgent.name} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans">
                        {formatAgentTitle(selectedAgent.name)}
                      </h3>
                      <span className="px-1.5 py-0.5 text-xs font-mono text-text-muted bg-surface-elevated border border-border rounded">
                        {selectedAgent.name}
                      </span>
                      {isCanonical === true ? (
                        <Badge variant="primary" size="sm">
                          Canonical core agent
                        </Badge>
                      ) : isCanonical === false ? (
                        <Badge variant="default" size="sm">
                          Non-canonical
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Classification not served
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed max-w-2xl">
                      {selectedCatalogEntry?.mission || selectedAgent.description}
                    </p>
                    {selectedCatalogEntry ? (
                      <p className="text-2xs font-mono text-text-muted mt-1">
                        mission from GET /agents/catalog
                      </p>
                    ) : (
                      <p className="text-2xs font-mono text-warning mt-1">
                        Not in the live agent registry &mdash; the text above is this
                        workspace&apos;s capability description, not the server&apos;s agent
                        mission.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                  {/* A Link styled to match Button's primary variant. Button renders a
                      <button>, and nesting the anchor inside it is invalid interactive
                      content, so the two are not composed here. */}
                  <Link
                    href={`/workspace/${workspaceId}/chat?agent=${selectedAgent.name}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-action hover:bg-action-hover active:bg-action-active text-action-fg font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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

                  <fieldset
                    className="flex items-center p-0.5 rounded-lg bg-surface-elevated border border-border"
                    aria-label="Agent autonomy"
                  >
                    <legend className="sr-only">Agent autonomy</legend>
                    {AUTONOMY_OPTIONS.map((option) => {
                      const isActive = autonomyMode === option.value;
                      return (
                        <Tooltip key={option.value} content={option.hint}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            disabled={savingAutonomy}
                            onClick={() => void handleToggleAutonomy(option.value)}
                            className={`px-2 py-1 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface-elevated disabled:opacity-60 ${
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                                : 'text-text-muted hover:text-text'
                            }`}
                          >
                            {option.label}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </fieldset>
                </div>
              </div>

              <Tabs
                tabs={detailTabs}
                activeTab={detailSubTab}
                onTabChange={(id) => setDetailSubTab(id as DetailSubTab)}
                variant="underline"
                size="sm"
                ariaLabel={`${formatAgentTitle(selectedAgent.name)} detail`}
              />
            </div>

            <div className="flex-1 overflow-y-auto overscroll-y-contain p-5 pb-16 bg-background min-h-0 font-sans">
              <TabPanel id="mission" activeTab={detailSubTab}>
                <div className="space-y-5 max-w-3xl">
                  {selectedCatalogEntry && selectedCatalogEntry.skills.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary font-sans">
                        Registry capability labels
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCatalogEntry.skills.map((skill) => (
                          <Badge key={skill} variant="default" size="sm">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary font-sans">
                      Workspace capability document
                    </h4>
                    {selectedAgent.markdownDoc ? (
                      <div className="bg-surface-elevated border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-text leading-relaxed">
                        <pre className="whitespace-pre-wrap">{selectedAgent.markdownDoc}</pre>
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted">
                        This capability row carries no document. The server&apos;s agent mission is
                        above.
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-text">ReAct round budget</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Stored in the capability config bag. No agent runtime reads this field yet,
                        so it is a recorded setting, not an enforced guardrail.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label
                        htmlFor="agent-react-rounds"
                        className="text-2xs font-sans text-text-muted"
                      >
                        Max rounds
                      </label>
                      <input
                        id="agent-react-rounds"
                        type="number"
                        min={1}
                        max={50}
                        value={reactRounds.value}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          if (Number.isFinite(next)) {
                            setReactRounds({
                              value: Math.min(50, Math.max(1, Math.trunc(next))),
                              persisted: false,
                            });
                          }
                        }}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (Number.isFinite(next) && next !== savedRounds) {
                            void handleCommitRounds(Math.min(50, Math.max(1, Math.trunc(next))));
                          }
                        }}
                        className="w-16 bg-surface-elevated border border-border rounded px-2 py-1 text-xs font-mono text-text text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-primary"
                      />
                      <Badge variant={reactRounds.persisted ? 'success' : 'warning'} size="sm">
                        {reactRounds.persisted ? 'Saved' : 'Not saved'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </TabPanel>

              <TabPanel id="scopes" activeTab={detailSubTab}>
                <div className="space-y-5 max-w-3xl font-sans">
                  <ScopeList
                    title="Read Scopes"
                    description="memory_scopes.read_types from the live registry"
                    scopes={selectedCatalogEntry?.memoryScopes?.readTypes ?? []}
                    emptyText="The registry declares no read memory scopes for this agent."
                    variant="success"
                  />
                  <ScopeList
                    title="Write Scopes"
                    description="memory_scopes.write_types from the live registry"
                    scopes={selectedCatalogEntry?.memoryScopes?.writeTypes ?? []}
                    emptyText="The registry declares no write memory scopes for this agent."
                    variant="warning"
                  />
                  <ScopeList
                    title="Required Tool Scopes"
                    description={
                      selectedCatalogEntry
                        ? 'union of required_scope across the tools the registry declares'
                        : 'fallback: the required scope on this workspace capability row'
                    }
                    scopes={contract?.requiredScopes ?? []}
                    emptyText="No required scope is declared anywhere for this agent."
                    variant="primary"
                  />
                </div>
              </TabPanel>

              <TabPanel id="tools" activeTab={detailSubTab}>
                <div className="space-y-4 max-w-3xl font-sans">
                  {selectedCatalogEntry && selectedCatalogEntry.tools.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedCatalogEntry.tools.map((tool) => (
                        <div
                          key={tool.name}
                          className="p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-between space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-semibold text-primary">
                              {tool.name}
                            </span>
                            <span className="text-2xs font-sans px-1.5 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border">
                              {tool.category}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {tool.description ||
                              'The registry returned no description for this tool.'}
                          </p>
                          <span className="text-2xs font-mono text-text-muted">
                            scope: {tool.requiredScope}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No declared tools"
                      description={
                        selectedCatalogEntry
                          ? 'The live registry reports this agent declares no tools.'
                          : 'This agent is not in the live registry. The names below come from the workspace capability row, which is a stored list and is not verified against the server.'
                      }
                    />
                  )}
                </div>
              </TabPanel>

              <TabPanel id="contract" activeTab={detailSubTab}>
                <div className="space-y-4 max-w-3xl font-sans">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Contract as served
                    </h4>
                    <Button variant="secondary" size="sm" onClick={handleCopyContract}>
                      {copiedContract ? 'Copied' : 'Copy JSON'}
                    </Button>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Every field below is either read from <code>GET /agents/catalog</code> or is
                    explicitly <code>null</code> because no source supplied it. Unset values are not
                    defaulted into something that looks configured.
                  </p>
                  <div className="bg-surface-elevated border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-text leading-relaxed">
                    <pre>{contract ? JSON.stringify(contract, null, 2) : ''}</pre>
                  </div>
                </div>
              </TabPanel>

              <TabPanel id="validate" activeTab={detailSubTab}>
                <div className="space-y-5 max-w-3xl font-sans">
                  <div className="space-y-2">
                    <Textarea
                      label="Probe message (sent for validation only)"
                      rows={3}
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="Optional. This endpoint validates the agent's contract; it never sends the message to an LLM."
                      helperText="POST /api/v1/agents/capabilities/test validates the agent's declared contract against the live registry. It performs no planning run and no LLM call."
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRunContractProbe}
                      loading={testRunning}
                    >
                      Read contract from registry
                    </Button>
                  </div>

                  {testError && (
                    <ErrorState
                      title="Contract probe failed"
                      message={testError}
                      onRetry={handleRunContractProbe}
                      actionText="Retry probe"
                    />
                  )}

                  {testResult && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            testResult.status === 'success'
                              ? 'success'
                              : testResult.status === 'error'
                                ? 'error'
                                : 'warning'
                          }
                          size="sm"
                        >
                          {testResult.status}
                        </Badge>
                        <Badge variant={testResult.executed ? 'success' : 'default'} size="sm">
                          {testResult.executed
                            ? 'executed: true'
                            : 'executed: false — nothing was run'}
                        </Badge>
                        <span className="text-2xs font-mono text-text-muted">
                          {testResult.executionDurationMs}ms server-side
                        </span>
                      </div>

                      {testResult.validationErrors.length > 0 && (
                        <ul className="space-y-1 text-xs text-error font-sans list-disc list-inside">
                          {testResult.validationErrors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                      )}

                      <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                        <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                          <span className="text-2xs font-sans font-semibold uppercase tracking-wider text-text-muted">
                            Response body
                          </span>
                          <span className="text-2xs font-mono text-text-muted">
                            {testResult.timestamp}
                          </span>
                        </div>
                        <pre className="p-3 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-text overflow-x-auto max-h-80">
                          {JSON.stringify(testResult.result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {!testResult && !testError && !testRunning && (
                    <p className="text-xs text-text-muted font-sans leading-relaxed">
                      No probe has been run. This pane will show only what the server returns.
                    </p>
                  )}
                </div>
              </TabPanel>
            </div>

            <footer className="px-5 py-2.5 border-t border-border bg-surface flex flex-wrap items-center justify-between gap-2 text-xs font-sans text-text-muted shrink-0">
              <span className="inline-flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${selectedAgent.enabled ? 'bg-success' : 'bg-text-muted'}`}
                  aria-hidden="true"
                />
                {selectedAgent.enabled ? 'Enabled in this workspace' : 'Disabled in this workspace'}
              </span>
              <span className="inline-flex items-center gap-3 font-mono text-2xs">
                <span>runs: {selectedAgent.usageCount}</span>
                <span>last used: {formatRelativeTime(selectedAgent.lastUsedAt)}</span>
                {selectedAgent.version && <span>v{selectedAgent.version}</span>}
              </span>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              title="No agent selected"
              description="Pick an agent from the directory to inspect its registry contract."
            />
          </div>
        )}
      </section>
    </div>
  );
};

function ScopeList({
  title,
  description,
  scopes,
  emptyText,
  variant,
}: {
  title: string;
  description: string;
  scopes: string[];
  emptyText: string;
  variant: 'primary' | 'success' | 'warning';
}) {
  const tone: Record<'primary' | 'success' | 'warning', string> = {
    primary: 'bg-primary/10 text-primary border-primary/30',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
  };
  return (
    <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text font-sans">
          {title}
        </h4>
        <span className="text-2xs font-mono text-text-muted">{description}</span>
      </div>
      {scopes.length === 0 ? (
        <p className="text-xs text-text-muted font-sans">{emptyText}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {scopes.map((scope) => (
            <li key={scope}>
              <Badge variant={variant} size="sm" className="font-mono">
                {scope}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
