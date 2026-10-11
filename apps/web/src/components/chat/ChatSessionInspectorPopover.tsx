'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ContextWindowGauge } from './ContextWindowGauge';

export interface ChatSessionInspectorPopoverProps {
  totalTokens?: number;
  maxTokens?: number;
  modelId: string;
  durableMode: boolean;
  onDurableModeChange: (v: boolean) => void;
  onCompact?: () => void;
  isCompacting?: boolean;
  onToggleMemoryDrawer?: () => void;
  agentCount: number | null;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export function ChatSessionInspectorPopover({
  totalTokens = 0,
  maxTokens = 32768,
  modelId,
  durableMode,
  onDurableModeChange,
  onCompact,
  isCompacting = false,
  onToggleMemoryDrawer,
  agentCount,
}: ChatSessionInspectorPopoverProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const safeMax = Math.max(1, maxTokens);
  const pct = Math.min(100, Math.max(0, Math.round((totalTokens / safeMax) * 100)));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      <button
        type="button"
        aria-label="Session Controls"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
          open
            ? 'border-action bg-action/10 text-text ring-1 ring-action/30'
            : 'border-border/60 bg-surface-50 hover:bg-surface-hover text-text-muted hover:text-text'
        }`}
        title="Session controls, context window usage, and execution settings"
      >
        <span className="flex items-center gap-1 font-mono text-[11px]">
          <span className="text-action">⚡</span>
          <span className="font-medium text-text">{formatTokens(totalTokens)}</span>
          <span className="text-text-dim">/{formatTokens(safeMax)}</span>
        </span>
        <span className="text-[10px] text-text-dim">({pct}%)</span>
        <svg
          className={`w-3 h-3 text-text-dim transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Session and Context Controls"
          className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-border/80 bg-surface-100 p-4 shadow-xl backdrop-blur-md animate-zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5 mb-3">
            <div>
              <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
                Session Controls
              </h3>
              <p className="text-[11px] text-text-dim mt-0.5">
                Model: <span className="font-mono text-text">{modelId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-text-dim hover:text-text hover:bg-surface-200 transition-colors"
              aria-label="Close session controls"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Context Window Gauge */}
          <div className="space-y-2 mb-4">
            <span className="text-[11px] font-medium text-text-muted">
              Context Budget & Compaction
            </span>
            <div className="p-2 rounded-lg bg-surface-50 border border-border/40">
              <ContextWindowGauge
                totalTokens={totalTokens}
                maxTokens={safeMax}
                modelId={modelId}
                onCompact={onCompact}
                isCompacting={isCompacting}
              />
            </div>
          </div>

          {/* Operational Settings */}
          <div className="space-y-3 pt-1 border-t border-border/40">
            <label className="flex items-center justify-between cursor-pointer rounded-lg p-2 hover:bg-surface-50 transition-colors">
              <div className="pr-2">
                <div className="text-xs font-medium text-text">Durable Mode</div>
                <div className="text-[10px] text-text-dim">
                  Routes through Temporal workflow so runs survive page refreshes.
                </div>
              </div>
              <input
                type="checkbox"
                checked={durableMode}
                onChange={(e) => onDurableModeChange(e.target.checked)}
                className="h-4 w-4 rounded accent-action cursor-pointer"
                aria-label="Durable Mode"
              />
            </label>

            {onToggleMemoryDrawer && (
              <button
                type="button"
                onClick={() => {
                  onToggleMemoryDrawer();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-surface-50 hover:bg-surface-hover text-left border border-border/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>📌</span>
                  <span className="text-xs font-medium text-text">Obsidian Vault Drawer</span>
                </div>
                <span className="text-[10px] font-mono text-action">Open →</span>
              </button>
            )}

            <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-text-dim border-t border-border/30">
              <span>Active Agents</span>
              <span className="font-mono text-text">
                {agentCount === null ? 'Loading…' : `${agentCount} agents ready`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
