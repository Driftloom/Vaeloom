'use client';

import React from 'react';
import { Badge, EmptyState, Switch, Tooltip } from '@vaeloom/ui-kit';
import { SuiteIcon } from './SuiteIcon';
import {
  GATE_ENFORCEMENT,
  suiteGate,
  type GateStatus,
  type ToolGateRow,
  type ToolSort,
  type ToolSuite,
} from './types';

export interface ToolSuiteAccordionProps {
  filteredSuites: ToolSuite[];
  selectedSuite: ToolSuite | null;
  gateRows: ReadonlyMap<string, ToolGateRow>;
  gateStatus: GateStatus;
  gateError: string | null;
  pendingTools: ReadonlySet<string>;
  /**
   * State of the served-definitions fetch behind the suite list. `failed`
   * means the tab knows nothing about the catalog and renders no suites — the
   * empty-catalog copy "The tool catalog is empty." is only ever truthful
   * after a successful response that genuinely holds nothing, so it is
   * reserved for that case.
   */
  definitionsStatus: GateStatus;
  definitionsError: string | null;
  sortBy: ToolSort;
  onSortChange: (sort: ToolSort) => void;
  searchQuery?: string;
  onSelectSuite: (suite: ToolSuite) => void;
  onToggleSuite: (suite: ToolSuite, enabled: boolean) => void;
}

export const ToolSuiteAccordion: React.FC<ToolSuiteAccordionProps> = ({
  filteredSuites,
  selectedSuite,
  gateRows,
  gateStatus,
  gateError,
  pendingTools,
  definitionsStatus,
  definitionsError,
  sortBy,
  onSortChange,
  searchQuery = '',
  onSelectSuite,
  onToggleSuite,
}) => {
  return (
    <section
      className="w-full lg:w-[320px] xl:w-[360px] 2xl:w-[390px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0"
      aria-labelledby="tool-suites-heading"
    >
      <div className="p-3 border-b border-border bg-surface shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2
            id="tool-suites-heading"
            className="text-xs font-semibold text-text uppercase tracking-wider font-sans shrink-0"
          >
            Tool Suites
          </h2>
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
            {filteredSuites.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="tools-sort-select" className="text-2xs font-sans text-text-muted">
            Sort
          </label>
          <select
            id="tools-sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as ToolSort)}
            className="bg-surface-elevated text-text border border-border rounded px-2 py-1 text-xs font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer"
          >
            <option value="most-used">Catalog order</option>
            <option value="alphabetical">A-Z</option>
          </select>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border bg-surface-elevated shrink-0 space-y-1.5">
        <p className="text-2xs text-text-muted leading-relaxed">{GATE_ENFORCEMENT}</p>
        {gateStatus === 'loading' && (
          <p role="status" className="text-2xs font-mono text-text-muted">
            Reading this workspace&apos;s tool rows…
          </p>
        )}
        {gateStatus === 'failed' && (
          <p role="alert" className="text-2xs font-mono text-error leading-relaxed">
            The tool rows could not be read: {gateError}. The switches are disabled because nothing
            here can tell an enabled tool from a denied one.
          </p>
        )}
        {gateStatus === 'stale' && (
          <p role="status" className="text-2xs font-mono text-warning leading-relaxed">
            A refresh of the tool rows failed: {gateError}. Showing the last known state; the
            switches still write to the server.
          </p>
        )}
        {definitionsStatus === 'failed' && (
          <p role="alert" className="text-2xs font-mono text-error leading-relaxed">
            The served tool definitions could not be loaded: {definitionsError}. Served suites are
            not shown (rendering them would mean guessing what the server holds); workspace tool
            rows below still render as the Workspace Tools suite.
          </p>
        )}
        {definitionsStatus === 'stale' && (
          <p role="status" className="text-2xs font-mono text-warning leading-relaxed">
            A refresh of the served tool definitions failed: {definitionsError}. Showing the last
            known state; the suite switches still write to the server.
          </p>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto overscroll-y-contain p-2 pb-12 space-y-1.5 min-h-0">
        {filteredSuites.length === 0 && (
          <li className="p-1">
            <EmptyState
              title={
                definitionsStatus === 'failed' ? 'No tool suites shown' : 'No tool suites match'
              }
              description={
                definitionsStatus === 'failed'
                  ? 'The served tool definitions could not be loaded, so no suites are shown. This is a fetch failure, not an empty catalog.'
                  : definitionsStatus === 'loading'
                    ? 'Loading the served tool definitions…'
                    : searchQuery.trim()
                      ? `Nothing in the workspace tool suites matches “${searchQuery.trim()}”.`
                      : 'The tool catalog is empty.'
              }
            />
          </li>
        )}

        {filteredSuites.map((suite) => {
          const isSelected = selectedSuite?.id === suite.id;
          const gate = suiteGate(suite, gateRows);
          const allDisabled = gate.disabled.length === gate.total;
          const checked = !allDisabled;
          const partial = gate.disabled.length > 0 && !allDisabled;
          const busy = suite.rows.some((row) => pendingTools.has(row.name));
          const gateTooltip = allDisabled
            ? `All ${gate.total} tools in ${suite.name} have an enabled=false capability row. execute_tool raises PermissionDeniedError before any handler runs.`
            : partial
              ? `${gate.disabled.length} of ${gate.total} tools have an enabled=false row and are denied at execution (${gate.disabled.join(', ')}). The rest have no such row, and no row means enabled.`
              : `No tool in ${suite.name} has an enabled=false row, so execute_tool runs all ${gate.total}. Turning this off writes one capability row per tool, because the gate keys on the individual tool name.`;

          return (
            <li key={suite.id}>
              <div
                className={`flex items-start gap-2 p-2 rounded-xl border transition-colors ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30 shadow-xs'
                    : 'bg-surface hover:bg-surface-hover border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSuite(suite)}
                  aria-current={isSelected ? 'true' : undefined}
                  className="flex-1 min-w-0 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-primary/20 border-primary/40 text-primary'
                          : 'bg-surface-elevated border-border text-text-muted'
                      }`}
                      aria-hidden="true"
                    >
                      <SuiteIcon suiteId={suite.id} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-semibold font-sans truncate ${
                            isSelected ? 'text-primary' : 'text-text'
                          }`}
                        >
                          {suite.name}
                        </span>
                        <span className="text-2xs font-mono px-1.5 py-0.2 rounded bg-surface-elevated text-text-secondary border border-border">
                          {suite.rows.length}
                        </span>
                        {suite.origin === 'workspace' && (
                          <Badge variant="default" size="sm">
                            workspace
                          </Badge>
                        )}
                        {allDisabled && (
                          <Badge variant="error" size="sm">
                            all {gate.total} denied
                          </Badge>
                        )}
                        {partial && (
                          <Badge variant="warning" size="sm">
                            {gate.disabled.length} of {gate.total} denied
                          </Badge>
                        )}
                      </span>
                    </span>
                  </span>
                  <span className="block text-2xs font-sans text-text-muted line-clamp-2 leading-relaxed mt-1.5">
                    {suite.description}
                  </span>
                  <span className="flex flex-wrap gap-1 mt-1.5">
                    {suite.rows.slice(0, 3).map((row) => (
                      <span
                        key={row.name}
                        className={`text-2xs font-mono px-1.5 py-0.2 rounded border truncate max-w-[130px] ${
                          gateRows.get(row.name)?.enabled === false
                            ? 'bg-error/10 text-error border-error/30 line-through'
                            : row.definition
                              ? 'bg-surface-elevated text-text-secondary border-border-subtle'
                              : 'bg-warning/10 text-warning border-warning/30'
                        }`}
                      >
                        {row.name}
                      </span>
                    ))}
                    {suite.rows.length > 3 && (
                      <span className="text-2xs font-mono text-text-muted self-center">
                        +{suite.rows.length - 3}
                      </span>
                    )}
                  </span>
                </button>

                <div className="shrink-0 pt-1 flex flex-col items-end gap-1">
                  <Tooltip content={gateTooltip} side="left">
                    <div>
                      <Switch
                        checked={checked}
                        disabled={gateStatus === 'loading' || gateStatus === 'failed' || busy}
                        onChange={(next: boolean) => void onToggleSuite(suite, next)}
                        label={
                          <span className="sr-only">
                            {partial
                              ? `Partially disabled: ${gate.disabled.length} of ${gate.total} tools in ${suite.name} are denied at execution`
                              : `Allow all ${gate.total} tools in ${suite.name} in this workspace`}
                          </span>
                        }
                      />
                    </div>
                  </Tooltip>
                  {busy && <span className="text-2xs font-mono text-text-muted">writing…</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
