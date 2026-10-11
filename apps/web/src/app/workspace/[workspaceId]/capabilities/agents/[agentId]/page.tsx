'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  FormField,
  Spinner,
  StatusDot,
  Switch,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import { SEED_CAPABILITIES } from '@/lib/capabilities-data';
import {
  agentCatalogApi,
  capabilitiesApi,
  capabilityConfigReactRounds,
  reactRoundsAcceptance,
  CAPABILITY_MAX_REACT_ROUNDS_KEY,
  MAX_REACT_ROUNDS,
  MIN_REACT_ROUNDS,
  type CapabilityTestResponse,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';

function formatAgentTitle(name: string): string {
  const words = name.replace(/[_-]+/g, ' ').trim();
  if (!words) return 'Agent';
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} Agent`;
}

type AutonomyMode = 'suggest' | 'autonomous' | 'approval_required';
type SubTab = 'mission' | 'autonomy' | 'tools' | 'contract' | 'test';

export default function AgentSubpage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const agentId = (params?.['agentId'] as string) || '';
  const decodedAgentId = decodeURIComponent(agentId);

  const [activeTab, setActiveTab] = useState<SubTab>('mission');
  const [testPrompt, setTestPrompt] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<CapabilityTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [roundsText, setRoundsText] = useState('6');
  const [savingRounds, setSavingRounds] = useState(false);

  const { data: catalog, isLoading: catalogLoading } = useSWR('agent-catalog', () =>
    agentCatalogApi.get(),
  );

  const { data: workspaceRows, mutate: mutateWorkspaceRows } = useSWR(
    workspaceId ? ['workspace-capabilities', workspaceId] : null,
    () => capabilitiesApi.list(undefined, workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const seededAgents = useMemo(() => SEED_CAPABILITIES.filter((c) => c.category === 'agents'), []);

  const selectedAgent = useMemo(() => {
    if (!decodedAgentId) return null;
    const cleanId = decodedAgentId.toLowerCase();
    const cleanNoPrefix = cleanId.startsWith('agent-') ? cleanId.slice('agent-'.length) : cleanId;

    // Check catalog first
    const catalogEntry = catalog?.agents?.find(
      (a) =>
        a.name.toLowerCase() === cleanId ||
        a.name.toLowerCase() === cleanNoPrefix ||
        a.name.replace(/_/g, '-') === cleanNoPrefix,
    );

    // Check workspace capability row
    const workspaceRow = workspaceRows?.find(
      (r) =>
        r.id === cleanId ||
        r.name.toLowerCase() === cleanId ||
        r.name.toLowerCase() === cleanNoPrefix,
    );

    // Check seed
    const seed = seededAgents.find(
      (s) =>
        s.id === cleanId ||
        s.name.toLowerCase() === cleanId ||
        s.name.toLowerCase() === cleanNoPrefix,
    );

    if (!catalogEntry && !workspaceRow && !seed) return null;

    const baseName = catalogEntry?.name || workspaceRow?.name || seed?.name || cleanNoPrefix;
    const baseId = workspaceRow?.id || seed?.id || `agent-${baseName}`;

    return {
      id: baseId,
      name: baseName,
      title: formatAgentTitle(baseName),
      description:
        catalogEntry?.mission ||
        (catalogEntry as any)?.description ||
        workspaceRow?.description ||
        seed?.description ||
        '',
      enabled: workspaceRow ? workspaceRow.enabled : (seed?.enabled ?? true),
      version: workspaceRow?.version || seed?.version || '1.0.0',
      author: workspaceRow?.author || seed?.author || 'Vaeloom Core Team',
      // No invented fallback. `lib/capabilities-data.ts` is explicit that a
      // scope the backend does not emit "fails closed at execution time with a
      // permission error the user cannot act on", so guessing `tools.execute`
      // here is worse than reporting that nothing was declared.
      requiredScope:
        catalogEntry?.tools?.[0]?.requiredScope ||
        workspaceRow?.config?.['required_scope'] ||
        seed?.requiredScope ||
        null,
      defaultAutonomy:
        (catalogEntry?.defaultAutonomy as AutonomyMode) ||
        (seed?.autonomy as AutonomyMode) ||
        'autonomous',
      tools: catalogEntry?.tools || [],
      toolNames: catalogEntry?.toolNames || seed?.toolsUsed || [],
      markdownDoc:
        seed?.markdownDoc || `# ${formatAgentTitle(baseName)}\n\n${catalogEntry?.mission || ''}`,
      workspaceRow,
    };
  }, [decodedAgentId, catalog, workspaceRows, seededAgents]);

  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>(() =>
    selectedAgent ? selectedAgent.defaultAutonomy : 'autonomous',
  );

  const handleToggleEnabled = useCallback(
    async (next: boolean) => {
      if (!selectedAgent) return;
      try {
        await capabilitiesApi.update(selectedAgent.id, { enabled: next });
        void mutateWorkspaceRows();
        toast({
          tone: next ? 'success' : 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${selectedAgent.title}`,
          detail: 'Applies to new agent sessions in this workspace.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not change status for ${selectedAgent.title}`,
          detail: err instanceof Error ? err.message : 'The workspace was not updated.',
        });
      }
    },
    [selectedAgent, mutateWorkspaceRows, toast],
  );

  const handleSaveAutonomy = useCallback(
    async (nextMode: AutonomyMode) => {
      if (!selectedAgent) return;
      setAutonomyMode(nextMode);
      try {
        await capabilitiesApi.update(selectedAgent.id, {
          config: { autonomy: nextMode },
        });
        void mutateWorkspaceRows();
        toast({
          tone: 'success',
          title: `Autonomy updated to ${nextMode.replace('_', ' ')}`,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Could not update autonomy',
          detail: err instanceof Error ? err.message : 'Server update failed.',
        });
      }
    },
    [selectedAgent, mutateWorkspaceRows, toast],
  );

  const handleSaveRounds = useCallback(async () => {
    if (!selectedAgent) return;
    const verdict = reactRoundsAcceptance(roundsText);
    if (!verdict.ok) {
      toast({ tone: 'error', title: 'Invalid round budget', detail: verdict.reason });
      return;
    }
    setSavingRounds(true);
    try {
      await capabilitiesApi.update(selectedAgent.id, {
        config: { [CAPABILITY_MAX_REACT_ROUNDS_KEY]: verdict.rounds },
      });
      void mutateWorkspaceRows();
      toast({
        tone: 'success',
        title: `ReAct round budget set to ${verdict.rounds}`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Could not save round budget',
        detail: err instanceof Error ? err.message : 'Write failed.',
      });
    } finally {
      setSavingRounds(false);
    }
  }, [selectedAgent, roundsText, mutateWorkspaceRows, toast]);

  const handleRunDiagnostic = useCallback(async () => {
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
      setTestError(err instanceof Error ? err.message : 'Diagnostic run failed.');
    } finally {
      setTestRunning(false);
    }
  }, [selectedAgent, workspaceId, testPrompt]);

  const breadcrumbsBackUrl = `/workspace/${workspaceId}/capabilities?category=agents&agent=${encodeURIComponent(
    decodedAgentId,
  )}`;

  const breadcrumbItems = [
    { label: 'Capabilities', href: `/workspace/${workspaceId}/capabilities` },
    { label: 'Agents', href: breadcrumbsBackUrl },
    { label: selectedAgent?.title ?? decodedAgentId, current: true },
  ];

  const subTabs = [
    { id: 'mission', label: 'Mission & Docs' },
    { id: 'autonomy', label: 'Autonomy & Budget' },
    { id: 'tools', label: `Tools (${selectedAgent?.toolNames.length ?? 0})` },
    { id: 'contract', label: 'Contract Schema' },
    { id: 'test', label: 'Diagnostic Test' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border bg-surface">
        <PageHeader
          title={selectedAgent?.title ?? decodedAgentId}
          description={
            selectedAgent?.description ||
            'Inspect, govern, and probe this autonomous workspace agent.'
          }
          eyebrow="Agent Capability"
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
          actions={
            <div className="flex items-center gap-3">
              <Link
                href={breadcrumbsBackUrl}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
              >
                <Button variant="secondary" size="sm">
                  Back to Agents
                </Button>
              </Link>
              {selectedAgent && (
                <>
                  <Link
                    href={`/workspace/${workspaceId}/chat?agent=${selectedAgent.name}`}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
                  >
                    <Button variant="secondary" size="sm">
                      Chat with Agent
                    </Button>
                  </Link>
                  <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
                    <span className="text-xs text-text-muted">Enabled:</span>
                    <Switch
                      checked={selectedAgent.enabled}
                      onChange={(next) => void handleToggleEnabled(next)}
                      label={`Enable ${selectedAgent.title}`}
                    />
                  </div>
                </>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
        {catalogLoading && !selectedAgent ? (
          <CapabilitySubpageSkeleton eyebrow="Agent Capability" />
        ) : !selectedAgent ? (
          <div className="max-w-xl mx-auto py-12">
            <EmptyState
              title={`Agent "${decodedAgentId}" not found`}
              description="This agent was not found in the catalog or workspace registrations."
              action={{
                label: 'View all Agents',
                onClick: () =>
                  router.push(`/workspace/${workspaceId}/capabilities?category=agents`),
              }}
            />
          </div>
        ) : selectedAgent ? (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Metadata Bar */}
            <div className="p-4 rounded-xl border border-border-subtle bg-surface flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusDot status={selectedAgent.enabled ? 'active' : 'idle'} />
                <div>
                  <div className="text-sm font-semibold text-text">{selectedAgent.title}</div>
                  <div className="text-xs text-text-muted font-mono">{selectedAgent.name}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="mono" size="sm">
                  v{selectedAgent.version}
                </Badge>
                <Badge variant="primary" size="sm">
                  {selectedAgent.author}
                </Badge>
                {selectedAgent.requiredScope ? (
                  <Badge variant="mono" size="sm">
                    Scope: {String(selectedAgent.requiredScope)}
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Scope not declared
                  </Badge>
                )}
                <Badge variant={selectedAgent.enabled ? 'success' : 'default'} size="sm">
                  {selectedAgent.enabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-border-subtle">
              <Tabs
                ariaLabel="Agent Inspection Subtabs"
                size="sm"
                tabs={subTabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as SubTab)}
              />
            </div>

            {/* Tab Contents */}
            <TabPanel id="mission" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">
                  Mission Statement & Directives
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-text-secondary text-sm leading-relaxed">
                  {selectedAgent.markdownDoc}
                </div>
              </div>
            </TabPanel>

            <TabPanel id="autonomy" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-text mb-1">Autonomy Level</h3>
                  <p className="text-xs text-text-muted mb-4">
                    Governs whether the agent asks for confirmation before executing actions.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['suggest', 'autonomous', 'approval_required'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => void handleSaveAutonomy(mode)}
                        className={`p-3 text-left rounded-lg border transition-all text-xs ${
                          autonomyMode === mode
                            ? 'border-primary bg-primary/5 text-text font-medium'
                            : 'border-border-subtle hover:border-border text-text-secondary'
                        }`}
                      >
                        <div className="font-semibold capitalize mb-1">
                          {mode.replace('_', ' ')}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {mode === 'autonomous' && 'Runs actions directly without user approval.'}
                          {mode === 'approval_required' &&
                            'Requires explicit human confirmation for sensitive tools.'}
                          {mode === 'suggest' &&
                            'Suggests tool calls but never executes autonomously.'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border-subtle">
                  <h3 className="text-base font-semibold text-text mb-1">ReAct Loop Budget</h3>
                  <p className="text-xs text-text-muted mb-3">
                    Maximum reasoning / action iterations per agent run ({MIN_REACT_ROUNDS} -{' '}
                    {MAX_REACT_ROUNDS}).
                  </p>
                  <div className="flex items-center gap-3 max-w-xs">
                    <input
                      type="number"
                      min={MIN_REACT_ROUNDS}
                      max={MAX_REACT_ROUNDS}
                      value={roundsText}
                      onChange={(e) => setRoundsText(e.target.value)}
                      className="w-24 px-3 py-1.5 text-xs rounded border border-border bg-surface-elevated text-text"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={savingRounds}
                      onClick={() => void handleSaveRounds()}
                    >
                      {savingRounds ? 'Saving...' : 'Save Budget'}
                    </Button>
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="tools" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text">Declared Tool Access</h3>
                  <Badge variant="mono" size="sm">
                    {selectedAgent.toolNames.length} tools attached
                  </Badge>
                </div>
                {selectedAgent.toolNames.length === 0 ? (
                  <p className="text-xs text-text-muted">No explicit tools bound to this agent.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedAgent.toolNames.map((toolName) => (
                      <div
                        key={toolName}
                        className="p-3 rounded-lg border border-border-subtle bg-surface-elevated flex items-center justify-between"
                      >
                        <span className="font-mono text-xs text-text">{toolName}</span>
                        <Link
                          href={`/workspace/${workspaceId}/capabilities/tools/${encodeURIComponent(toolName)}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Inspect Schema &rarr;
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel id="contract" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text">Agent Contract Schema</h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(selectedAgent, null, 2));
                      toast({ tone: 'success', title: 'Copied contract JSON' });
                    }}
                  >
                    Copy Contract
                  </Button>
                </div>
                <pre className="p-4 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-text-secondary overflow-x-auto max-h-96">
                  {JSON.stringify(selectedAgent, null, 2)}
                </pre>
              </div>
            </TabPanel>

            <TabPanel id="test" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Diagnostic Contract Probe</h3>
                <p className="text-xs text-text-muted">
                  Dispatches a non-destructive dry-run probe to validate parameter contracts and
                  tool permissions.
                </p>

                <FormField label="Probe Input Prompt">
                  <Textarea
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder={`e.g. Run a diagnostic check for ${selectedAgent.title}`}
                    rows={3}
                  />
                </FormField>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={testRunning}
                    onClick={() => void handleRunDiagnostic()}
                  >
                    {testRunning ? <Spinner size="sm" /> : 'Run Diagnostic Probe'}
                  </Button>
                </div>

                {testError && (
                  <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
                    {testError}
                  </div>
                )}

                {testResult && (
                  <div className="p-4 rounded-lg border border-border-subtle bg-surface-elevated space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-text">Diagnostic Output:</span>
                      <Badge
                        variant={testResult.status === 'success' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {testResult.executionDurationMs == null
                          ? 'no duration reported'
                          : `${testResult.executionDurationMs}ms`}
                      </Badge>
                    </div>
                    <pre className="p-3 rounded bg-surface border border-border text-xs font-mono overflow-x-auto">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </TabPanel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
