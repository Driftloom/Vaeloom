import React from 'react';

interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  type?: 'default' | 'success' | 'warning' | 'error';
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const typeColors: Record<string, string> = {
  default: 'bg-border',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
};

export function Timeline({ events, className = '' }: TimelineProps) {
  return (
    <div className={`relative ${className}`} role="list" aria-label="Timeline">
      <div className="absolute left-3 top-0 bottom-0 w-px bg-border" aria-hidden="true" />
      {events.map((event) => (
        <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0" role="listitem">
          <div
            className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ${typeColors[event.type ?? 'default']} shrink-0`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text">{event.title}</p>
            {event.description && (
              <p className="text-xs text-text-muted mt-0.5">{event.description}</p>
            )}
            <time className="text-xs text-text-muted">{event.timestamp}</time>
          </div>
        </div>
      ))}
    </div>
  );
}
