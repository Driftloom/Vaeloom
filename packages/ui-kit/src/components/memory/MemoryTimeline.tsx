import React from 'react';
import { BrainIcon, ClockIcon } from '../../icons';

export interface MemoryTimelineItem {
  id: string;
  action: 'ingested' | 'synthesized' | 'updated' | 'archived';
  title: string;
  source: string;
  timestamp: string;
}

export interface MemoryTimelineProps {
  items: MemoryTimelineItem[];
  className?: string;
}

const actionColors = {
  ingested: 'border-blue-500 bg-blue-950 text-blue-300',
  synthesized: 'border-purple-500 bg-purple-950 text-purple-300',
  updated: 'border-amber-500 bg-amber-950 text-amber-300',
  archived: 'border-zinc-500 bg-zinc-950 text-zinc-400',
};

export const MemoryTimeline: React.FC<MemoryTimelineProps> = ({ items, className = '' }) => {
  return (
    <div className={`relative pl-6 space-y-6 ${className}`.trim()}>
      {/* Vertical line */}
      <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-[var(--color-border-subtle,#27272a)]" />

      {items.map((item) => {
        const aColor = actionColors[item.action] || actionColors.ingested;

        return (
          <div key={item.id} className="relative group">
            {/* Dot */}
            <div
              className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 bg-[var(--color-bg-canvas,#08080a)] ${aColor.split(' ')[0]}`}
            />
            <div className="text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[var(--color-text-primary,#f4f4f5)]">
                  {item.title}
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[var(--color-bg-elevated,#18181c)] text-[var(--color-text-muted,#71717a)]">
                  {item.action}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-muted,#71717a)]">
                <span>{item.source}</span>
                <span>•</span>
                <span className="tabular-nums">{item.timestamp}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

MemoryTimeline.displayName = 'MemoryTimeline';
