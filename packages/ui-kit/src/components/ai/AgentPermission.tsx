import React from 'react';
import { LockIcon } from '../../icons';

export interface AgentPermissionProps {
  scope: string;
  description?: string;
  level: 'read' | 'write' | 'execute' | 'admin';
  className?: string;
}

const levelColors = {
  read: 'bg-blue-950/30 text-blue-300 border-blue-800/30',
  write: 'bg-amber-950/30 text-amber-300 border-amber-800/30',
  execute: 'bg-purple-950/30 text-purple-300 border-purple-800/30',
  admin: 'bg-red-950/30 text-red-300 border-red-800/30',
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
      <span className="text-[10px] uppercase opacity-75">[{level}]</span>
    </div>
  );
};

AgentPermission.displayName = 'AgentPermission';
