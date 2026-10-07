'use client';

import React, { useState } from 'react';
import type { ParallelAgentOutput } from './types';
import { ChatMarkdown } from './ChatMarkdown';
import { SPECIALIST_AGENTS } from './ChatAgentSquadSelector';

export interface ParallelAgentStreamCardProps {
  parallelOutputs: Record<string, ParallelAgentOutput>;
  synthesisText?: string;
  isStreaming?: boolean;
  onSelectAgent?: (agentName: string) => void;
}

const AGENT_COLORS: Record<string, string> = {
  resume: '#3B82F6',
  ats: '#10B981',
  job_search: '#8B5CF6',
  career: '#F59E0B',
  application: '#EC4899',
};

function getAgentMeta(agentName: string) {
  const normalized = agentName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const matched = SPECIALIST_AGENTS.find((a) => a.id === normalized || normalized.includes(a.id));
  return {
    displayName: matched?.name ?? agentName.replace(/_/g, ' '),
    role: matched?.role ?? 'Specialist Agent',
    color: matched?.color ?? AGENT_COLORS[normalized] ?? '#6B7280',
  };
}

export function ParallelAgentStreamCard({
  parallelOutputs,
  synthesisText,
  isStreaming = false,
  onSelectAgent,
}: ParallelAgentStreamCardProps): JSX.Element | null {
  const agentEntries = Object.entries(parallelOutputs || {});
  const [mobileActiveAgent, setMobileActiveAgent] = useState<string>(agentEntries[0]?.[0] ?? '');

  if (agentEntries.length === 0) return null;

  return (
    <div
      className="my-3 rounded-xl border border-border/80 bg-surface-50/80 p-3.5 space-y-3 shadow-sm"
      data-testid="parallel-agent-stream-container"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-action animate-ping motion-reduce:animate-none" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text">
            Parallel Multi-Agent Stream
          </h2>
          <span className="rounded-full bg-surface-200 border border-border/60 px-2 py-0.2 text-[10px] font-mono text-text-muted">
            {agentEntries.length} Specialists
          </span>
        </div>
        {isStreaming && (
          <span className="text-[11px] font-mono text-action animate-pulse">
            Synchronizing live outputs...
          </span>
        )}
      </div>

      {/* Mobile Tab Switcher */}
      {agentEntries.length > 1 && (
        <div className="flex gap-1 md:hidden overflow-x-auto pb-1">
          {agentEntries.map(([agentName, output]) => {
            const meta = getAgentMeta(agentName);
            const isActive = (mobileActiveAgent || agentEntries[0]?.[0]) === agentName;
            return (
              <button
                key={agentName}
                type="button"
                onClick={() => setMobileActiveAgent(agentName)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors shrink-0 ${
                  isActive
                    ? 'border-action bg-surface-200 text-text'
                    : 'border-border/40 bg-surface-100 text-text-muted'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span>{meta.displayName}</span>
                {output.status === 'streaming' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Specialist Stream Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agentEntries.map(([agentName, output]) => {
          const meta = getAgentMeta(agentName);
          const isMobileVisible = (mobileActiveAgent || agentEntries[0]?.[0]) === agentName;

          return (
            <div
              key={agentName}
              className={`flex flex-col rounded-lg border border-border/60 bg-surface-100/90 p-3 shadow-xs transition-all ${
                isMobileVisible ? 'flex' : 'hidden md:flex'
              }`}
              data-testid={`parallel-stream-card-${agentName}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 border-b border-border/30 pb-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden="true"
                    />
                    <h3 className="text-xs font-semibold text-text truncate">{meta.displayName}</h3>
                  </div>
                  <p className="text-[10px] font-mono text-text-dim mt-0.5">{meta.role}</p>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {output.status === 'streaming' && (
                    <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-mono text-warning border border-warning/30">
                      <svg
                        className="animate-spin h-2.5 w-2.5 text-warning"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      {output.phase ?? 'Streaming'}
                    </span>
                  )}
                  {output.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-mono text-success border border-success/30">
                      ✓ Done
                    </span>
                  )}
                  {output.status === 'error' && (
                    <span className="inline-flex items-center gap-1 rounded bg-error/15 px-1.5 py-0.5 text-[10px] font-mono text-error border border-error/30">
                      ⚠ Error
                    </span>
                  )}
                </div>
              </div>

              {/* Card Token Content */}
              <div className="flex-1 overflow-y-auto max-h-48 min-h-[90px] text-xs text-text-muted leading-relaxed font-sans pr-1">
                {output.tokens ? (
                  <ChatMarkdown>{output.tokens}</ChatMarkdown>
                ) : output.summary ? (
                  <p className="text-text italic">{output.summary}</p>
                ) : (
                  <p className="text-text-dim italic text-[11px] animate-pulse">
                    Specialist analyzing prompt context...
                  </p>
                )}
              </div>

              {/* Specialist Action Footer */}
              {onSelectAgent && (
                <div className="pt-2 mt-2 border-t border-border/30 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectAgent(agentName)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-action bg-action/10 hover:bg-action/20 border border-action/30 transition-colors cursor-pointer"
                    title={`Focus next message on @${agentName}`}
                    aria-label={`Continue with @${agentName}`}
                  >
                    💬 Continue with @{agentName}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Executive Synthesis Card */}
      {synthesisText && (
        <div
          className="mt-3 rounded-lg border border-action/40 bg-action/5 p-3.5 space-y-2"
          data-testid="parallel-synthesis-card"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs">⚡</span>
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Executive Synthesis & Cross-Agent Consensus
            </h3>
          </div>
          <div className="text-xs text-text leading-relaxed">
            <ChatMarkdown>{synthesisText}</ChatMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
