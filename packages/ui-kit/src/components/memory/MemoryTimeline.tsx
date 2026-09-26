import React from 'react';

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
  ingested: 'border-primary bg-primary/10 text-primary',
  synthesized: 'border-accent bg-accent/10 text-accent',
  updated: 'border-warning bg-warning/15 text-warning',
  archived: 'border-border-strong bg-surface-200 text-text-muted',
};

export const MemoryTimeline: React.FC<MemoryTimelineProps> = ({ items, className = '' }) => {
  return (
    <div className={`relative pl-6 space-y-6 ${className}`.trim()}>
      {/* Vertical line */}
      <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-border-subtle" />

      {items.map((item) => {
        const aColor = actionColors[item.action] || actionColors.ingested;

        return (
          <div key={item.id} className="relative group">
            {/* Dot */}
            <div
              className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 bg-surface-100 ${aColor.split(' ')[0]}`}
            />
            <div className="text-xs">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-text">{item.title}</span>
                <span className="text-2xs uppercase font-mono px-1.5 py-0.2 rounded bg-surface-200 text-text-muted">
                  {item.action}
                </span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <span>{item.source}</span>
                <span aria-hidden="true">•</span>
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
