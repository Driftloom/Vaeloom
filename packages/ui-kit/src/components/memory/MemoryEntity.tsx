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
  person: 'border-primary/30 text-primary bg-primary/10',
  company: 'border-success/30 text-success bg-success/15',
  skill: 'border-accent/30 text-accent bg-accent/15',
  project: 'border-warning/30 text-warning bg-warning/15',
  topic: 'border-border-strong text-text-secondary bg-surface-200',
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
      {count !== undefined && <span className="text-2xs opacity-70 font-mono">({count})</span>}
    </button>
  );
};

MemoryEntity.displayName = 'MemoryEntity';
