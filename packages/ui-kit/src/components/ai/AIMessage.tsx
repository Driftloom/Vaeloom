import React from 'react';

import { CpuIcon, UserIcon } from '../../icons';
import { Badge } from '../Badge';

import { ConfidenceIndicator } from './ConfidenceIndicator';
import { SourceCitation } from './SourceCitation';

export interface AIMessageProps {
  role: 'user' | 'agent' | 'system';
  content?: React.ReactNode;
  /** Alias for `content`; without it JSX children were silently discarded. */
  children?: React.ReactNode;
  agentName?: string;
  confidence?: number;
  citations?: Array<{ title: string; uri?: string; score?: number }>;
  timestamp?: string;
  latencyMs?: number;
  streaming?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function AIMessage({
  role,
  content,
  children,
  agentName = 'Vaeloom Agent',
  confidence,
  citations,
  timestamp,
  latencyMs,
  streaming = false,
  actions,
  className = '',
}: AIMessageProps) {
  const isAgent = role === 'agent';
  const body = content ?? children;

  return (
    <div
      className={`flex items-start gap-3 py-3 px-2 rounded-lg transition-colors ${
        isAgent ? 'bg-surface-50/50' : ''
      } ${className}`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
          isAgent
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'bg-surface-200 text-text-secondary border border-border'
        }`}
        aria-hidden="true"
      >
        {isAgent ? <CpuIcon size={14} /> : <UserIcon size={14} />}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text">{isAgent ? agentName : 'You'}</span>
            {isAgent && (
              <Badge variant="primary" size="sm" className="text-2xs py-0">
                AI
              </Badge>
            )}
            {timestamp && <span className="text-2xs text-text-dim">{timestamp}</span>}
          </div>

          <div className="flex items-center gap-2">
            {latencyMs !== undefined && (
              <span className="font-mono text-2xs text-text-dim">{latencyMs}ms</span>
            )}
            {confidence !== undefined && (
              <div className="flex items-center gap-1">
                <ConfidenceIndicator score={confidence} />
              </div>
            )}
          </div>
        </div>

        <div className="text-sm text-text leading-relaxed break-words">
          {body}
          {streaming && (
            <span
              className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>

        {citations && citations.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <span className="text-2xs font-mono uppercase tracking-wider text-text-dim block mb-1.5">
              Sources & Provenance
            </span>
            <div className="flex flex-wrap gap-2">
              {citations.map((c, i) => (
                <SourceCitation key={i} sourceTitle={c.title} url={c.uri} index={i + 1} />
              ))}
            </div>
          </div>
        )}

        {actions && <div className="pt-1 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
