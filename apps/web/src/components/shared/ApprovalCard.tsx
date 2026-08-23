'use client';

import React, { useCallback, useState } from 'react';
import { DiffViewer } from './DiffViewer';
import { ProvenanceBadge, type ProvenanceItem } from './ProvenanceBadge';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ExpiryTimer } from './ExpiryTimer';

export interface ApprovalCardProps {
  id: string;
  agentName: string;
  actionType: string;
  description: string | React.ReactNode;
  diff?: { oldText: string; newText: string };
  risk?: string;
  scopes?: string[];
  provenance?: ProvenanceItem[];
  confidence?: number;
  expiresAt?: string;
  t3Warning?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function ApprovalCard({
  id,
  agentName,
  actionType,
  description,
  diff,
  risk,
  scopes = [],
  provenance = [],
  confidence,
  expiresAt,
  t3Warning = false,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const [expired, setExpired] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false,
  );
  const disabled = expired;

  const approve = useCallback(() => onApprove(id), [id, onApprove]);
  const reject = useCallback(() => onReject(id), [id, onReject]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }
      if (disabled) return;
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        approve();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        reject();
      }
    },
    [approve, reject, disabled],
  );

  return (
    <div
      className="card mb-4 border-primary/30 bg-primary/5 flex flex-col gap-3"
      role="region"
      aria-label={`${agentName} ${actionType} approval`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-primary text-xl" aria-hidden="true">
            ðŸ’¡
          </span>
          <span className="text-xs uppercase tracking-wider text-primary font-mono">
            {agentName} suggests
          </span>
        </div>
        <div className="flex items-center gap-2">
          {expiresAt && <ExpiryTimer expiresAt={expiresAt} onExpire={() => setExpired(true)} />}
          <span className="font-mono text-[11px] text-text-muted">{actionType}</span>
        </div>
      </div>

      {/* Trust UX: proposed !== executed — always label the state explicitly. */}
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary">
          Proposed — not yet executed
        </span>
        {expiresAt && (
          <span className="text-[10px] text-text-muted font-mono">decide before expiry</span>
        )}
      </div>

      <div className="text-text">{description}</div>

      {diff && <DiffViewer oldText={diff.oldText} newText={diff.newText} />}

      {provenance.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="sr-only">Sources:</span>
          {provenance.map((p, idx) => (
            <ProvenanceBadge key={`${p.label}-${idx}`} label={p.label} confidence={p.confidence} />
          ))}
        </div>
      )}

      {typeof confidence === 'number' && (
        <ConfidenceMeter value={confidence} label="Match confidence" />
      )}

      {risk && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-muted">
          <span className="font-medium">Risk:</span> {risk}
        </p>
      )}

      {scopes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-text-muted">Scopes:</span>
          {scopes.map((s) => (
            <span
              key={s}
              className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {t3Warning && (
        <p
          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent-hover"
          role="alert"
        >
          This action sends an email (consent scope: gmail.send). You approved email sending in
          Settings.
        </p>
      )}

      <p className="text-[11px] text-text-muted leading-relaxed">
        {t3Warning
          ? 'This action sends an email and cannot be undone once executed.'
          : 'If this changes a document, you can undo it later from History.'}
      </p>

      {expired ? (
        <p className="text-xs text-text-muted">Expired. No action was taken.</p>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <button className="btn-primary flex-1" onClick={approve}>
            Approve <kbd className="ml-1 opacity-70">A</kbd>
          </button>
          <button className="btn-secondary flex-1" onClick={reject}>
            Reject <kbd className="ml-1 opacity-70">R</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
