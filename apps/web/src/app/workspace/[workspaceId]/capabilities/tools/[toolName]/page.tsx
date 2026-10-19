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
import { capabilitiesApi, type CapabilityTestResponse } from '@/lib/api-client';
import {
  TOOL_DEFINITIONS_SWR_KEY,
  definitionFromRecord,
  suiteKeyForScope,
  suiteLabelForKey,
} from '@/lib/tool-definitions-catalog';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';

type SubTab = 'contract' | 'schema' | 'test';

export default function ToolSubpage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const toolName = (params?.['toolName'] as string) || '';
  const decodedToolName = decodeURIComponent(toolName);

  const [activeTab, setActiveTab] = useState<SubTab>('contract');
  const [testPayload, setTestPayload] = useState('{}');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<CapabilityTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Served from the backend tool registry — the same `GET
  // /capabilities/tools/definitions` fetch (and SWR cache key) the Tools tab
  // uses. The lookup is an exact name match: registry names are snake_case
  // identifiers and guessing a dash/underscore normalization would silently
  // alias two tools that are deliberately distinct.
  const { data: definitions, isLoading: loadingDefinitions } = useSWR(
    TOOL_DEFINITIONS_SWR_KEY,
    () => capabilitiesApi.listToolDefinitions(),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const tool = useMemo(() => {
    if (!decodedToolName || !definitions) return null;
    const record = definitions.find((d) => d.name === decodedToolName) ?? null;
    if (!record) return null;
    return {
      ...definitionFromRecord(record),
      // The subpage header renders this as "<suiteId> Suite", so it carries
      // the readable suite label rather than the raw scope prefix.
      suiteId: suiteLabelForKey(suiteKeyForScope(record.requiredScope)),
    };
  }, [definitions, decodedToolName]);

  const {
    data: workspaceRows,
    isLoading: loadingWorkspaceRows,
    mutate: mutateWorkspaceRows,
  } = useSWR(
    workspaceId ? ['workspace-capabilities', workspaceId] : null,
    () => capabilitiesApi.list(undefined, workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const disabledToolRow = useMemo(() => {
    if (!tool || !workspaceRows) return null;
    return workspaceRows.find((r) => r.category === 'tool' && r.name === tool.name);
  }, [tool, workspaceRows]);

  const isEnabled = disabledToolRow ? disabledToolRow.enabled : true;

  // Initialize test payload from schema parameters
  React.useEffect(() => {
    if (tool?.samplePayload && Object.keys(tool.samplePayload).length > 0) {
      setTestPayload(JSON.stringify(tool.samplePayload, null, 2));
    } else if (tool?.parameters && tool.parameters.length > 0) {
      const sample: Record<string, unknown> = {};
      tool.parameters.forEach((param) => {
        if (param.default !== undefined) {
          sample[param.name] = param.default;
        } else if (param.type === 'string') {
          sample[param.name] = 'sample_value';
        } else if (param.type === 'integer' || param.type === 'number') {
          sample[param.name] = 1;
        } else if (param.type === 'boolean') {
          sample[param.name] = true;
        } else if (param.type === 'array') {
          sample[param.name] = [];
        } else {
          sample[param.name] = null;
        }
      });
      setTestPayload(JSON.stringify(sample, null, 2));
    }
  }, [tool]);

  const handleToggle = useCallback(
    async (nextState: boolean) => {
      if (!tool) return;
      try {
        if (disabledToolRow) {
          await capabilitiesApi.update(disabledToolRow.id, { enabled: nextState });
        } else {
          await capabilitiesApi.create({
            name: tool.name,
            category: 'tool',
            description: tool.description,
            type: 'built-in',
            config: { enabled: nextState },
          });
        }
        void mutateWorkspaceRows();
        toast({
          tone: nextState ? 'success' : 'warning',
          title: `${nextState ? 'Enabled' : 'Disabled'} ${tool.name}`,
          detail: 'Workspace execution permissions updated.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not update status for ${tool.name}`,
          detail: err instanceof Error ? err.message : 'Write failed.',
        });
      }
    },
    [tool, disabledToolRow, mutateWorkspaceRows, toast],
  );

  const handleExecuteTest = useCallback(async () => {
    if (!tool) return;
    setTestRunning(true);
    setTestError(null);
    setTestResult(null);

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(testPayload);
    } catch (e) {
      setTestError('Invalid JSON payload syntax. Please check formatting.');
      setTestRunning(false);
      return;
    }

    try {
      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: tool.name,
        category: 'tools',
        inputPayload: parsedPayload,
      });
      setTestResult(res);
      toast({
        tone: res.status === 'success' ? 'success' : 'warning',
        title: `Validation result: ${res.status}`,
        detail:
          res.executionDurationMs == null
            ? 'The server reported no duration for this validation.'
            : `Duration: ${res.executionDurationMs}ms`,
      });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Execution failed.');
      toast({
        tone: 'error',
        title: 'Tool test failed',
        detail: err instanceof Error ? err.message : 'Server error.',
      });
    } finally {
      setTestRunning(false);
    }
  }, [tool, workspaceId, testPayload, toast]);

  const breadcrumbsBackUrl = `/workspace/${workspaceId}/capabilities?category=tools`;

  const breadcrumbItems = [
    { label: 'Capabilities', href: `/workspace/${workspaceId}/capabilities` },
    { label: 'Tools', href: breadcrumbsBackUrl },
    { label: tool?.name ?? decodedToolName, current: true },
  ];

  const subTabs = [
    { id: 'contract', label: 'Contract & Scopes' },
    { id: 'schema', label: 'JSON Schema' },
    { id: 'test', label: 'Schema Validator & Tester' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border bg-surface">
        <PageHeader
          title={tool?.name ?? decodedToolName}
          description={
            tool?.description ||
            'Inspect signature, parameter schemas, and test invocation contracts for this tool.'
          }
          eyebrow="Tool Capability"
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
          actions={
            <div className="flex items-center gap-3">
              <Link
                href={breadcrumbsBackUrl}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-lg"
              >
                <Button variant="secondary" size="sm">
                  Back to Tools
                </Button>
              </Link>
              {tool && (
                <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
                  <span className="text-xs text-text-muted">Enabled:</span>
                  <Switch
                    checked={isEnabled}
                    onChange={(next) => void handleToggle(next)}
                    label={`Enable ${tool.name}`}
                  />
                </div>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
        {!tool && (loadingWorkspaceRows || loadingDefinitions) ? (
          <CapabilitySubpageSkeleton eyebrow="Tool Capability" />
        ) : !tool ? (
          <div className="max-w-xl mx-auto py-12">
            <EmptyState
              title={`Tool "${decodedToolName}" not found`}
              description="No definition with this name exists in the backend tool registry, so there is no served contract to inspect."
              action={{
                label: 'View all Tools',
                onClick: () => router.push(breadcrumbsBackUrl),
              }}
            />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Metadata Card */}
            <div className="p-4 rounded-xl border border-border-subtle bg-surface flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusDot status={isEnabled ? 'active' : 'idle'} />
                <div>
                  <div className="text-sm font-semibold font-mono text-text">{tool.name}</div>
                  <div className="text-xs text-text-muted">{tool.suiteId} Suite</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary" size="sm">
                  Scope: {tool.requiredScope || 'none'}
                </Badge>
                <Badge variant={tool.approvalGated ? 'warning' : 'default'} size="sm">
                  {tool.approvalGated ? 'Approval Gated' : 'Direct Call'}
                </Badge>
                <Badge variant={isEnabled ? 'success' : 'default'} size="sm">
                  {isEnabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-border-subtle">
              <Tabs
                ariaLabel="Tool Inspection Subtabs"
                size="sm"
                tabs={subTabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as SubTab)}
              />
            </div>

            <TabPanel id="contract" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Execution Contract</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{tool.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border-subtle text-xs">
                  <div>
                    <span className="text-text-muted">Suite:</span>
                    <span className="ml-2 font-medium text-text">{tool.suiteId}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Required Scope:</span>
                    <span className="ml-2 font-mono text-text">{tool.requiredScope || 'none'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Human Approval Required:</span>
                    <span className="ml-2 font-medium text-text">
                      {tool.approvalGated ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Trust Class:</span>
                    {tool.trustClass ? (
                      <span className="ml-2 font-mono text-text">{tool.trustClass}</span>
                    ) : (
                      <span className="ml-2 text-text-muted">not reported by the registry</span>
                    )}
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="schema" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">Parameter Definitions</h3>

                {tool.parameters && tool.parameters.length > 0 ? (
                  <div className="border border-border-subtle rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-elevated border-b border-border-subtle text-text-muted">
                        <tr>
                          <th className="p-2.5 font-semibold">Parameter</th>
                          <th className="p-2.5 font-semibold">Type</th>
                          <th className="p-2.5 font-semibold">Required</th>
                          <th className="p-2.5 font-semibold">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {tool.parameters.map((param) => (
                          <tr key={param.name} className="hover:bg-surface-elevated/50">
                            <td className="p-2.5 font-mono font-medium text-text">{param.name}</td>
                            <td className="p-2.5 font-mono text-text-muted">
                              {param.type ?? 'any'}
                            </td>
                            <td className="p-2.5">
                              {param.required ? (
                                <Badge variant="warning" size="sm">
                                  Required
                                </Badge>
                              ) : (
                                <span className="text-text-dim">Optional</span>
                              )}
                            </td>
                            <td className="p-2.5 text-text-secondary">
                              {param.description ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">This tool requires no input parameters.</p>
                )}

                <div className="pt-4 border-t border-border-subtle">
                  <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">
                    Raw JSON Schema
                  </h4>
                  <pre className="p-4 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-text-secondary overflow-x-auto max-h-72">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="test" activeTab={activeTab}>
              <div className="p-5 rounded-xl border border-border-subtle bg-surface space-y-4">
                <h3 className="text-base font-semibold text-text">
                  Validate Schema & Dry-Run Invocation
                </h3>
                <p className="text-xs text-text-muted">
                  Test parameter contract compliance. Dry-run probes validate schema conformance
                  without executing live side effects.
                </p>

                <FormField label="JSON Input Payload">
                  <Textarea
                    value={testPayload}
                    onChange={(e) => setTestPayload(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </FormField>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={testRunning}
                    onClick={() => void handleExecuteTest()}
                  >
                    {testRunning ? <Spinner size="sm" /> : 'Run Schema Probe'}
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
                      <span className="font-semibold text-text">Validation Response:</span>
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
        )}
      </div>
    </div>
  );
}
