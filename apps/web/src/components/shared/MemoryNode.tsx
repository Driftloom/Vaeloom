import React from 'react';

interface MemoryNodeProps {
  label: string;
  type: string;
  confidence?: number;
  source?: string;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function MemoryNode({
  label,
  type,
  confidence,
  source,
  expanded = false,
  onToggle,
  children,
  className = '',
}: MemoryNodeProps) {
  return (
    <div className={`border border-border rounded-lg bg-surface ${className}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background rounded-lg"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-text-muted" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          <span className="text-sm font-medium text-text">{label}</span>
          <span className="text-xs text-text-muted px-1.5 py-0.5 bg-surface-active rounded">
            {type}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          {confidence !== undefined && <span>{confidence}%</span>}
          {source && <span>from {source}</span>}
        </div>
      </button>
      {expanded && children && (
        <div className="px-3 pb-3 border-t border-border pt-2">{children}</div>
      )}
    </div>
  );
}
