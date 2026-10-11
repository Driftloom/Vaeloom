'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabPanel,
  Textarea,
} from '@vaeloom/ui-kit';
import { formatRelativeTime, type CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import {
  capabilitiesApi,
  capabilityConfigReactRounds,
  reactRoundsAcceptance,
  CAPABILITY_MAX_REACT_ROUNDS_KEY,
  type CatalogAgent,
  type CapabilityTestResponse,
  type CapabilityItemRecord,
} from '@/lib/api-client';
import {
  AgentGlyph,
  agentHue,
  formatAgentTitle,
  coerceAutonomy,
  DEFAULT_REACT_ROUNDS,
  type AutonomyMode,
  type DetailSubTab,
  type ReactRoundsSetting,
} from './types';
import { AgentAutonomySelector, AgentReactRoundsBudget } from './AgentAutonomySelector';

export interface AgentContract {
  name: string;
  title: string;
  version: string | null;
  isCanonical: boolean | null;
  registry: string;
  autonomy: AutonomyMode;
  maxReActRounds: number | null;
  maxReActRoundsSource: string | null;
  requiredScopes: string[];
  requiredScopesSource: string;
  memoryScopes: { readTypes: string[]; writeTypes: string[] } | null;
  tools: string[];
  toolsSource: string;
  trustClass: string | null;
}

export interface AgentDetailPaneProps {
  selectedAgent: CapabilityItem | null;
  selectedCatalogEntry: CatalogAgent | null;
  selectedCapabilityRow: CapabilityItemRecord | null;
  catalogLoading: boolean;
  workspaceId: string;
  agentCapabilityRowsError: Error | null;
  mutateAgentCapabilityRows: () => Promise<unknown>;
}

export const ScopeList: React.FC<{
  title: string;
  description: string;
  scopes: string[];
  emptyText: string;
  variant: 'primary' | 'success' | 'warning';
}> = ({ title, description, scopes, emptyText, variant }) => {
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
};

export const AgentDetailPane: React.FC<AgentDetailPaneProps> = ({
  selectedAgent,
  selectedCatalogEntry,
  selectedCapabilityRow,
  catalogLoading,
  workspaceId,
  agentCapabilityRowsError,
  mutateAgentCapabilityRows,
}) => {
  const { toast } = useToast();

  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('mission');
  const [copiedContract, setCopiedContract] = useState(false);

  const [testPrompt, setTestPrompt] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<CapabilityTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('autonomous');
  const [roundsText, setRoundsText] = useState(String(DEFAULT_REACT_ROUNDS));
  const [reactRounds, setReactRounds] = useState<ReactRoundsSetting>({
    rounds: null,
    saving: false,
    issue: null,
  });
  const [savingAutonomy, setSavingAutonomy] = useState(false);

  const storedRounds = useMemo(
    () => capabilityConfigReactRounds(selectedCapabilityRow?.config),
    [selectedCapabilityRow],
  );

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

  useEffect(() => {
    if (storedRounds.state === 'honoured') {
      setRoundsText(String(storedRounds.rounds));
      setReactRounds({ rounds: storedRounds.rounds, saving: false, issue: null });
      return;
    }
    setRoundsText(String(DEFAULT_REACT_ROUNDS));
    setReactRounds({ rounds: null, saving: false, issue: null });
  }, [storedRounds]);

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

  const handleCommitRounds = useCallback(async () => {
    if (!selectedAgent) return;
    const verdict = reactRoundsAcceptance(roundsText);
    if (!verdict.ok) {
      setReactRounds((previous) => ({ ...previous, issue: verdict.reason }));
      return;
    }
    if (verdict.rounds === reactRounds.rounds) {
      setReactRounds((previous) => ({ ...previous, issue: null }));
      return;
    }
    setReactRounds({ rounds: reactRounds.rounds, saving: true, issue: null });
    try {
      const updated = await capabilitiesApi.update(selectedAgent.id, {
        config: { [CAPABILITY_MAX_REACT_ROUNDS_KEY]: verdict.rounds },
      });
      const stored = capabilityConfigReactRounds(updated.config);
      setReactRounds({
        rounds: stored.state === 'honoured' ? stored.rounds : null,
        saving: false,
        issue:
          stored.state === 'honoured'
            ? null
            : `The server accepted the write but the row does not hold ${verdict.rounds}.`,
      });
      void mutateAgentCapabilityRows();
      toast({
        tone: 'success',
        title: `ReAct round budget set to ${verdict.rounds}`,
        detail: `Stored as config.${CAPABILITY_MAX_REACT_ROUNDS_KEY} on this workspace's ${selectedAgent.name} row. A run resolves this row first, then the agent card, then AGENT_MAX_REACT_ROUNDS.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The server write failed.';
      setReactRounds({ rounds: reactRounds.rounds, saving: false, issue: message });
      toast({
        tone: 'error',
        title: 'Round budget not saved',
        detail: message,
      });
    }
  }, [selectedAgent, roundsText, reactRounds.rounds, mutateAgentCapabilityRows, toast]);

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

  const contract = useMemo<AgentContract | null>(() => {
    if (!selectedAgent) return null;
    const entry = selectedCatalogEntry;
    return {
      name: selectedAgent.name,
      title: formatAgentTitle(selectedAgent.name),
      version: selectedAgent.version ?? null,
      isCanonical: entry ? entry.isCanonical : null,
      registry: entry ? 'live' : 'not-registered',
      autonomy: autonomyMode,
      maxReActRounds: reactRounds.rounds,
      maxReActRoundsSource: reactRounds.rounds === null ? null : 'workspace-capability-row',
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

  const isCanonical = selectedCatalogEntry?.isCanonical ?? null;

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

  return (
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
                      Not in the live agent registry &mdash; the text above is this workspace&apos;s
                      capability description, not the server&apos;s agent mission.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
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

                <Link
                  href={`/workspace/${workspaceId}/capabilities/agents/${encodeURIComponent(selectedAgent.name)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface text-text font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>Open Full Page ↗</span>
                </Link>

                <AgentAutonomySelector
                  autonomyMode={autonomyMode}
                  disabled={savingAutonomy}
                  onAutonomyChange={(mode) => void handleToggleAutonomy(mode)}
                />
              </div>
            </div>

            <Tabs
              tabs={detailTabs}
              activeTab={detailSubTab}
              onTabChange={(id: string) => setDetailSubTab(id as DetailSubTab)}
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

                <AgentReactRoundsBudget
                  roundsText={roundsText}
                  reactRounds={reactRounds}
                  storedRounds={storedRounds}
                  agentCapabilityRowsError={agentCapabilityRowsError}
                  onRoundsTextChange={(text) => {
                    setRoundsText(text);
                    setReactRounds((previous) => ({ ...previous, issue: null }));
                  }}
                  onCommitRounds={() => void handleCommitRounds()}
                />
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
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setTestPrompt(e.target.value)
                    }
                    placeholder="Optional. This endpoint validates the agent's contract; it never sends the message to an LLM."
                    helperText="POST /api/v1/agents/capabilities/test validates the agent's declared contract against the live registry. It performs no planning run and no LLM call."
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleRunContractProbe()}
                    loading={testRunning}
                  >
                    Read contract from registry
                  </Button>
                </div>

                {testError && (
                  <ErrorState
                    title="Contract probe failed"
                    message={testError}
                    onRetry={() => void handleRunContractProbe()}
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
  );
};
