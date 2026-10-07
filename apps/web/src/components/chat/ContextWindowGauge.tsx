'use client';

import React from 'react';

export interface ContextWindowGaugeProps {
  totalTokens: number;
  maxTokens: number;
  modelId: string;
  onCompact?: () => void;
  isCompacting?: boolean;
}

const ZapIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const ScissorsIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
);

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}

export function ContextWindowGauge({
  totalTokens,
  maxTokens,
  modelId,
  onCompact,
  isCompacting = false,
}: ContextWindowGaugeProps) {
  const safeMax = Math.max(1, maxTokens);
  const pct = Math.min(100, Math.max(0, Math.round((totalTokens / safeMax) * 100)));

  // Color thresholds: <60% green, 60-75% amber, >75% red pulse
  let colorClass = 'bg-emerald-500';
  let textClass = 'text-emerald-400';
  let badgeBorder = 'border-emerald-500/30';
  let badgeBg = 'bg-emerald-950/20';

  if (pct >= 75) {
    colorClass = 'bg-rose-500 animate-pulse';
    textClass = 'text-rose-400';
    badgeBorder = 'border-rose-500/40';
    badgeBg = 'bg-rose-950/30';
  } else if (pct >= 60) {
    colorClass = 'bg-amber-500';
    textClass = 'text-amber-400';
    badgeBorder = 'border-amber-500/30';
    badgeBg = 'bg-amber-950/20';
  }

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${badgeBorder} ${badgeBg}`}
      title={`Context Budget: ${totalTokens.toLocaleString()} / ${safeMax.toLocaleString()} tokens used (${pct}%) on ${modelId}`}
    >
      <div className="flex items-center gap-1.5">
        <ZapIcon className={`w-3.5 h-3.5 ${textClass}`} />
        <span className="font-mono text-zinc-300 font-medium">
          {formatTokens(totalTokens)}
          <span className="text-zinc-500">/{formatTokens(safeMax)}</span>
        </span>
      </div>

      {/* Progress Track */}
      <div
        className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden relative"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Context Window Usage"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>

      <span className={`font-mono text-[11px] font-semibold ${textClass}`}>{pct}%</span>

      {/* Compaction trigger if available and thread is growing */}
      {onCompact && (
        <button
          type="button"
          onClick={onCompact}
          disabled={isCompacting}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors border ${
            pct >= 60
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200 border-zinc-700/50'
          }`}
          title="Compact older conversation turns into episodic memory"
          aria-label="Compact conversation history"
        >
          <ScissorsIcon className="w-3 h-3" />
          <span>{isCompacting ? 'Compacting…' : 'Compact'}</span>
        </button>
      )}
    </div>
  );
}
