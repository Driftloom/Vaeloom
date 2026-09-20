import React from 'react';
import { UserIcon, BuildingIcon, BriefcaseIcon, DatabaseIcon } from '../../icons';

export interface MemoryEntityProps {
  name: string;
  type: 'person' | 'company' | 'skill' | 'project' | 'topic';
  count?: number;
  onClick?: () => void;
  className?: string;
}

const typeIconMap = {
  person: UserIcon,
  company: BuildingIcon,
  skill: BriefcaseIcon,
  project: DatabaseIcon,
  topic: DatabaseIcon,
};

const typeColors = {
  person: 'border-blue-800/30 text-blue-300 bg-blue-950/20',
  company: 'border-emerald-800/30 text-emerald-300 bg-emerald-950/20',
  skill: 'border-purple-800/30 text-purple-300 bg-purple-950/20',
  project: 'border-amber-800/30 text-amber-300 bg-amber-950/20',
  topic: 'border-zinc-700 text-zinc-300 bg-zinc-900',
};

export const MemoryEntity: React.FC<MemoryEntityProps> = ({
  name,
  type,
  count,
  onClick,
  className = '',
}) => {
  const IconComponent = typeIconMap[type] || DatabaseIcon;
  const colorStyle = typeColors[type] || typeColors.topic;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${colorStyle} ${
        onClick ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
      } ${className}`.trim()}
    >
      <IconComponent size={12} />
      <span>{name}</span>
      {count !== undefined && <span className="text-[10px] opacity-70 font-mono">({count})</span>}
    </button>
  );
};

MemoryEntity.displayName = 'MemoryEntity';
