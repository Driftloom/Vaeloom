import React from 'react';
import { LockIcon } from '../../icons';

export interface AgentPermissionProps {
  scope: string;
  description?: string;
  level: 'read' | 'write' | 'execute' | 'admin';
  className?: string;
}

const levelColors = {
  read: 'bg-info/15 text-info border-info/30',
  write: 'bg-warning/15 text-warning border-warning/30',
  execute: 'bg-accent/15 text-accent border-accent/30',
  admin: 'bg-error/15 text-error border-error/30',
};

export const AgentPermission: React.FC<AgentPermissionProps> = ({
  scope,
  description,
  level,
  className = '',
}) => {
  const lColor = levelColors[level] || levelColors.read;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-mono ${lColor} ${className}`.trim()}
      title={description}
    >
      <LockIcon size={12} />
      <span className="font-semibold">{scope}</span>
      <span className="text-2xs uppercase opacity-75">[{level}]</span>
    </div>
  );
};

AgentPermission.displayName = 'AgentPermission';
