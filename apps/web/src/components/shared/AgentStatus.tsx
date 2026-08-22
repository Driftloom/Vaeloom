import React from 'react';

type AgentStatusType = 'healthy' | 'degraded' | 'down' | 'idle';

interface AgentStatusProps {
  name: string;
  status: AgentStatusType;
  lastActive?: string;
  taskCount?: number;
  className?: string;
}

const statusConfig: Record<AgentStatusType, { color: string; label: string; icon: string }> = {
  healthy: { color: 'text-success', label: 'Healthy', icon: 'â—' },
  degraded: { color: 'text-warning', label: 'Degraded', icon: 'â—' },
  down: { color: 'text-error', label: 'Down', icon: 'â—' },
  idle: { color: 'text-text-muted', label: 'Idle', icon: 'â—‹' },
};

export function AgentStatus({
  name,
  status,
  lastActive,
  taskCount,
  className = '',
}: AgentStatusProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border border-border bg-surface ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-lg ${config.color}`} aria-hidden="true">
          {config.icon}
        </span>
        <div>
          <p className="text-sm font-medium text-text">{name}</p>
          <p className="text-xs text-text-muted">{config.label}</p>
        </div>
      </div>
      <div className="text-right text-xs text-text-muted">
        {taskCount !== undefined && <p>{taskCount} tasks</p>}
        {lastActive && <p>{lastActive}</p>}
      </div>
    </div>
  );
}
