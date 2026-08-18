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
  healthy: { color: 'text-green-400', label: 'Healthy', icon: '●' },
  degraded: { color: 'text-yellow-400', label: 'Degraded', icon: '●' },
  down: { color: 'text-red-400', label: 'Down', icon: '●' },
  idle: { color: 'text-text-muted', label: 'Idle', icon: '○' },
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
