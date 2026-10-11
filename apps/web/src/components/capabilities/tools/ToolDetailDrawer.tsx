'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, EmptyState, ErrorState, Tabs, TabPanel, Textarea } from '@vaeloom/ui-kit';
import { capabilitiesApi } from '@/lib/api-client';
import { type DetailSubTab, type ToolGateRow, type ToolRow, type ToolSuite } from './types';
import { ToolRowItem } from './ToolRowItem';

export interface ToolDetailDrawerProps {
  workspaceId: string;
  selectedSuite: ToolSuite | null;
  activeRow: ToolRow | null;
  gateRows: ReadonlyMap<string, ToolGateRow>;
  gateStatus: 'loading' | 'ready' | 'failed';
  pendingTools: ReadonlySet<string>;
  detailSubTab: DetailSubTab;
  onDetailSubTabChange: (tab: DetailSubTab) => void;
  onSelectTool: (name: string) => void;
  onSetToolEnabled: (row: ToolRow, enabled: boolean) => void;
}

export const ToolDetailDrawer: React.FC<ToolDetailDrawerProps> = ({
  workspaceId,
  selectedSuite,
  activeRow,
  gateRows,
  gateStatus,
  pendingTools,
  detailSubTab,
  onDetailSubTabChange,
  onSelectTool,
  onSetToolEnabled,
}) => {
  const activeDefinition = activeRow?.definition ?? null;

  const [testInputJson, setTestInputJson] = useState('{}');
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testExecuted, setTestExecuted] = useState<boolean | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testValidationErrors, setTestValidationErrors] = useState<string[]>([]);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDefinition) return;
    setTestInputJson(JSON.stringify(activeDefinition.samplePayload, null, 2));
  }, [activeDefinition]);

  useEffect(() => {
    setTestOutput(null);
    setTestError(null);
    setTestStatus(null);
    setTestExecuted(null);
    setTestDurationMs(null);
    setTestValidationErrors([]);
  }, [activeRow?.name]);

  const handleRunValidation = useCallback(async () => {
    if (!activeRow) return;
    let parsed: Record<string, unknown>;
    try {
      const raw = JSON.parse(testInputJson);
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('Payload must be a JSON object.');
      }
      parsed = raw as Record<string, unknown>;
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'The payload is not valid JSON.');
      setTestOutput(null);
      setTestStatus(null);
      setTestExecuted(null);
      setTestDurationMs(null);
      setTestValidationErrors([]);
      return;
    }

    setTestRunning(true);
    setTestError(null);
    try {
      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: activeRow.name,
        category: 'tools',
        inputPayload: parsed,
      });
      setTestStatus(res.status);
      setTestExecuted(res.executed);
      setTestDurationMs(res.executionDurationMs);
      setTestValidationErrors(res.validationErrors);
      setTestOutput(JSON.stringify(res.result, null, 2));
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'The request failed.');
      setTestOutput(null);
      setTestStatus(null);
      setTestExecuted(null);
      setTestDurationMs(null);
      setTestValidationErrors([]);
    } finally {
      setTestRunning(false);
    }
  }, [activeRow, testInputJson, workspaceId]);

  const detailTabs = useMemo(
    () => [
      { id: 'contract' as DetailSubTab, label: 'Tool Contract' },
      { id: 'schema' as DetailSubTab, label: 'Schema & Parameters' },
      { id: 'validate' as DetailSubTab, label: 'Parameter Validation' },
    ],
    [],
  );

  return (
    <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden">
      {selectedSuite && activeRow ? (
        <>
          <div className="p-4 sm:p-5 border-b border-border bg-surface shrink-0 font-sans shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-semibold tracking-tight text-text font-sans font-mono">
                    {activeRow.name}
                  </h3>
                  {activeRow.definition ? (
                    <Badge variant="primary" size="sm">
                      {activeRow.definition.category}
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      No server definition
                    </Badge>
                  )}
                  {selectedSuite.origin === 'workspace' && (
                    <Badge variant="default" size="sm">
                      workspace tool
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1 max-w-3xl leading-relaxed">
                  {activeRow.definition?.description ??
                    activeRow.workspaceItem?.description ??
                    'No description was returned for this tool.'}
                </p>
                <p className="text-2xs font-mono text-text-muted mt-1">
                  {activeRow.definition
                    ? 'definition from the tool catalog'
                    : 'not present in the tool catalog — the fields below come from the workspace capability row, which the server does not validate'}
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  href={`/workspace/${workspaceId}/capabilities/tools/${encodeURIComponent(activeRow.name)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface text-text font-medium text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>Open Full Page ↗</span>
                </Link>
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 border-t border-border-subtle"
              role="group"
              aria-label={`Tools in ${selectedSuite.name}`}
            >
              <span className="text-2xs font-mono uppercase tracking-wider text-text-muted shrink-0 mr-1">
                {selectedSuite.rows.length} tools
              </span>
              {selectedSuite.rows.map((row) => {
                const isActive = row.name === activeRow.name;
                return (
                  <button
                    key={row.name}
                    type="button"
                    onClick={() => onSelectTool(row.name)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
                      isActive
                        ? 'bg-action text-action-fg shadow-xs font-semibold'
                        : 'bg-surface-elevated text-text-secondary hover:text-text hover:bg-surface-hover border border-border'
                    }`}
                  >
                    {row.name}
                  </button>
                );
              })}
            </div>

            <Tabs
              tabs={detailTabs}
              activeTab={detailSubTab}
              onTabChange={(id: string) => onDetailSubTabChange(id as DetailSubTab)}
              variant="underline"
              size="sm"
              ariaLabel={`${activeRow.name} detail`}
            />
          </div>

          <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 pb-16 bg-background min-h-0 font-sans">
            <TabPanel id="contract" activeTab={detailSubTab}>
              <ToolRowItem
                activeRow={activeRow}
                gateRows={gateRows}
                gateStatus={gateStatus}
                pendingTools={pendingTools}
                onSetToolEnabled={onSetToolEnabled}
              />
            </TabPanel>

            <TabPanel id="schema" activeTab={detailSubTab}>
              {activeDefinition ? (
                <div className="space-y-4 max-w-3xl">
                  <div className="rounded-xl border border-border bg-surface overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-surface-elevated flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-text uppercase tracking-wider font-sans">
                        Input Parameters ({activeDefinition.parameters.length})
                      </h4>
                      <span className="text-2xs font-mono text-text-muted">
                        from the tool catalog
                      </span>
                    </div>
                    {activeDefinition.parameters.length === 0 ? (
                      <p className="p-6 text-center text-xs text-text-muted font-sans">
                        This tool declares no input parameters.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-sans">
                          <thead className="border-b border-border text-2xs font-mono uppercase text-text-muted bg-surface">
                            <tr>
                              <th scope="col" className="px-4 py-2">
                                Parameter
                              </th>
                              <th scope="col" className="px-4 py-2">
                                Type
                              </th>
                              <th scope="col" className="px-4 py-2">
                                Status
                              </th>
                              <th scope="col" className="px-4 py-2">
                                Default
                              </th>
                              <th scope="col" className="px-4 py-2">
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y border-border">
                            {activeDefinition.parameters.map((param) => (
                              <tr
                                key={param.name}
                                className="hover:bg-surface-hover transition-colors"
                              >
                                <td className="px-4 py-2.5 font-mono text-primary font-semibold">
                                  {param.name}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-text-secondary">
                                  {param.type}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge variant={param.required ? 'warning' : 'default'} size="sm">
                                    {param.required ? 'Required' : 'Optional'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-text-muted">
                                  {param.default !== undefined ? String(param.default) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-text-secondary leading-relaxed">
                                  {param.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-surface-elevated p-4">
                    <h4 className="text-xs font-mono font-semibold text-text mb-2">
                      Raw JSON Schema
                    </h4>
                    <pre className="p-3 rounded-lg bg-surface border border-border text-xs font-mono text-text overflow-x-auto">
                      {JSON.stringify(activeDefinition.inputSchema, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No published schema"
                  description={`${activeRow.name} is not in the tool-definition catalog, so the server publishes no input schema for it. Add it under Tools to get one.`}
                />
              )}
            </TabPanel>

            <TabPanel id="validate" activeTab={detailSubTab}>
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-border bg-surface-elevated">
                  <p className="text-xs text-text-secondary font-sans leading-relaxed">
                    This validates the payload above against the tool&apos;s declared required
                    fields. It does not run the tool — the endpoint answers with{' '}
                    <code className="font-mono">executed: false</code> and makes no network or model
                    call. Real execution is{' '}
                    <code className="font-mono">POST /api/v1/capabilities/&#123;id&#125;/test</code>{' '}
                    on an installed capability row.
                  </p>
                </div>

                <Textarea
                  label="JSON input payload"
                  rows={6}
                  value={testInputJson}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setTestInputJson(e.target.value)
                  }
                  className="font-mono text-xs"
                />

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleRunValidation()}
                    loading={testRunning}
                  >
                    Validate parameters
                  </Button>
                  {activeDefinition && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setTestInputJson(JSON.stringify(activeDefinition.samplePayload, null, 2))
                      }
                    >
                      Load catalog sample
                    </Button>
                  )}
                </div>

                {testError && (
                  <ErrorState
                    title="Validation request failed"
                    message={testError}
                    onRetry={() => void handleRunValidation()}
                    actionText="Retry validation"
                  />
                )}

                {testStatus !== null && (
                  <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-2">
                      <Badge
                        variant={
                          testStatus === 'success'
                            ? 'success'
                            : testStatus === 'error'
                              ? 'error'
                              : 'warning'
                        }
                        size="sm"
                      >
                        {testStatus}
                      </Badge>
                      <Badge variant={testExecuted ? 'success' : 'default'} size="sm">
                        {testExecuted ? 'executed: true' : 'executed: false — nothing was run'}
                      </Badge>
                      {testDurationMs !== null && (
                        <span className="text-2xs font-mono text-text-muted">
                          {testDurationMs}ms server-side
                        </span>
                      )}
                    </div>

                    {testValidationErrors.length > 0 && (
                      <ul className="space-y-1 text-xs text-error font-sans list-disc list-inside">
                        {testValidationErrors.map((err) => (
                          <li key={err}>{err}</li>
                        ))}
                      </ul>
                    )}

                    {testOutput !== null && (
                      <pre className="p-3 rounded-lg bg-surface-elevated border border-border text-xs font-mono text-text overflow-x-auto max-h-72">
                        {testOutput}
                      </pre>
                    )}
                  </div>
                )}

                {testStatus === null && !testError && !testRunning && (
                  <p className="text-xs text-text-muted font-sans leading-relaxed">
                    No validation has been run. Nothing is shown until the server responds.
                  </p>
                )}
              </div>
            </TabPanel>
          </div>

          <footer className="px-5 py-2.5 border-t border-border bg-surface flex flex-wrap items-center justify-between gap-2 text-xs font-sans text-text-muted shrink-0">
            <span className="truncate">
              Suite: <strong className="text-text font-medium">{selectedSuite.name}</strong>
            </span>
            <span className="inline-flex items-center gap-3 text-2xs font-mono">
              <span>scope: {activeRow.requiredScope ?? 'not declared'}</span>
              <span>
                gate:{' '}
                {activeRow.approvalGated === null
                  ? 'unknown'
                  : activeRow.approvalGated
                    ? 'HITL'
                    : 'auto'}
              </span>
            </span>
          </footer>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            title="No tool selected"
            description="Pick a suite and a tool to read its contract, schema and parameter validation."
          />
        </div>
      )}
    </section>
  );
};
