'use client';

import React from 'react';
import { Badge, Switch } from '@vaeloom/ui-kit';
import { activeGateState, type ToolGateRow, type ToolRow } from './types';

export interface ToolRowItemProps {
  activeRow: ToolRow;
  gateRows: ReadonlyMap<string, ToolGateRow>;
  gateStatus: 'loading' | 'ready' | 'failed';
  pendingTools: ReadonlySet<string>;
  onSetToolEnabled: (row: ToolRow, enabled: boolean) => void;
}

export const Fact: React.FC<{
  term: string;
  value: string | null;
  emptyText: string;
}> = ({ term, value, emptyText }) => {
  return (
    <div className="p-3.5 rounded-xl border border-border bg-surface space-y-1">
      <dt className="text-2xs font-mono uppercase tracking-wider text-text-muted">{term}</dt>
      <dd className="text-sm font-mono text-text break-words">
        {value ?? <span className="text-text-muted font-sans text-xs">{emptyText}</span>}
      </dd>
    </div>
  );
};

export const ToolRowItem: React.FC<ToolRowItemProps> = ({
  activeRow,
  gateRows,
  gateStatus,
  pendingTools,
  onSetToolEnabled,
}) => {
  const gateState = activeGateState(activeRow, gateRows);
  const isPending = pendingTools.has(activeRow.name);

  return (
    <div className="space-y-4 max-w-3xl">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Fact
          term="Required scope"
          value={activeRow.requiredScope}
          emptyText="not declared anywhere for this tool"
        />
        <Fact
          term="Trust class"
          value={activeRow.definition?.trustClass ?? activeRow.workspaceItem?.trustClass ?? null}
          emptyText="not declared for this tool"
        />
        <Fact
          term="Approval gate"
          value={
            activeRow.approvalGated === null ? null : activeRow.approvalGated ? 'HITL' : 'Auto'
          }
          emptyText="unknown — no server definition for this tool"
        />
        <Fact term="Execution gate" value={gateState.label} emptyText="" />
      </dl>

      <div className="p-4 rounded-xl border border-border bg-surface space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Allow {activeRow.name} in this workspace
          </h4>
          <div className="flex items-center gap-2">
            <Badge variant={gateState.denied ? 'error' : 'success'} size="sm">
              {gateState.denied ? 'denied at execution' : 'runs at execution'}
            </Badge>
            <Switch
              checked={!gateState.denied}
              disabled={gateStatus !== 'ready' || isPending}
              onChange={(next: boolean) => void onSetToolEnabled(activeRow, next)}
              label={<span className="sr-only">{`Allow ${activeRow.name} in this workspace`}</span>}
            />
          </div>
        </div>
        <p className="text-2xs text-text-muted leading-relaxed">{gateState.detail}</p>
        {isPending && (
          <p role="status" className="text-2xs font-mono text-text-muted">
            Writing the capability row…
          </p>
        )}
      </div>

      {activeRow.workspaceItem?.markdownDoc && (
        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Workspace capability document
          </h4>
          <div className="bg-surface-elevated border border-border rounded-xl p-4 overflow-x-auto font-mono text-xs text-text leading-relaxed">
            <pre className="whitespace-pre-wrap">{activeRow.workspaceItem.markdownDoc}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
