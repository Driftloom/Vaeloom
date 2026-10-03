'use client';

import React from 'react';
import { Badge, ButtonGroup, Button, Select } from '@vaeloom/ui-kit';
import type { SkillSort, SkillTab } from '../SkillsView';

export type SkillCategoryFilter = 'all' | 'career' | 'agent' | 'engineering';

interface SkillFilterBarProps {
  sort: SkillSort;
  onSortChange: (sort: SkillSort) => void;
  tab: SkillTab;
  onTabChange: (tab: SkillTab) => void;
  installedCount: number;
  browseCount: number;
  categoryFilter: SkillCategoryFilter;
  onCategoryFilterChange: (cat: SkillCategoryFilter) => void;
  careerCount: number;
  agentCount: number;
  engineeringCount: number;
  totalFilteredCount: number;
  trustFilter: string;
  onTrustFilterChange: (trust: string) => void;
  onOpenTriggerSimulator: () => void;
}

const SORT_OPTIONS = [
  { value: 'most-used', label: 'Most used' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'recent', label: 'Recently used' },
];

const TRUST_OPTIONS = [
  { value: 'all', label: 'All trust levels' },
  { value: 'core_trusted', label: 'Core Trusted' },
  { value: 'community', label: 'Community' },
];

export const SkillFilterBar: React.FC<SkillFilterBarProps> = ({
  sort,
  onSortChange,
  tab,
  onTabChange,
  installedCount,
  browseCount,
  categoryFilter,
  onCategoryFilterChange,
  careerCount,
  agentCount,
  engineeringCount,
  totalFilteredCount,
  trustFilter,
  onTrustFilterChange,
  onOpenTriggerSimulator,
}) => {
  return (
    <div className="p-3 border-b border-border bg-surface shrink-0 space-y-2.5">
      {/* Top row: Tab Switcher & Sort */}
      <div className="flex items-center justify-between gap-2">
        <ButtonGroup attached>
          <Button
            size="sm"
            variant={tab === 'installed' ? 'primary' : 'ghost'}
            aria-pressed={tab === 'installed'}
            onClick={() => onTabChange('installed')}
            className="text-xs font-medium"
          >
            {`Installed (${installedCount})`}
          </Button>
          <Button
            size="sm"
            variant={tab === 'browse' ? 'primary' : 'ghost'}
            aria-pressed={tab === 'browse'}
            onClick={() => onTabChange('browse')}
            className="text-xs font-medium"
          >
            {`Browse (${browseCount})`}
          </Button>
        </ButtonGroup>

        <div className="flex items-center gap-1.5">
          <Select
            aria-label="Sort skills"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(value) => onSortChange(value as SkillSort)}
            className="text-2xs py-1"
          />
        </div>
      </div>

      {/* Category Domain Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-2xs">
        <button
          type="button"
          onClick={() => onCategoryFilterChange('all')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border ${
            categoryFilter === 'all'
              ? 'bg-primary text-background border-primary'
              : 'bg-surface-hover/60 text-text-secondary border-border/60 hover:text-text'
          }`}
        >
          All ({totalFilteredCount})
        </button>
        <button
          type="button"
          onClick={() => onCategoryFilterChange('career')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            categoryFilter === 'career'
              ? 'bg-primary text-background border-primary'
              : 'bg-surface-hover/60 text-text-secondary border-border/60 hover:text-text'
          }`}
        >
          <span>Career & ATS</span>
          <span className="opacity-80">({careerCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onCategoryFilterChange('agent')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            categoryFilter === 'agent'
              ? 'bg-primary text-background border-primary'
              : 'bg-surface-hover/60 text-text-secondary border-border/60 hover:text-text'
          }`}
        >
          <span>Agent Architecture</span>
          <span className="opacity-80">({agentCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onCategoryFilterChange('engineering')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            categoryFilter === 'engineering'
              ? 'bg-primary text-background border-primary'
              : 'bg-surface-hover/60 text-text-secondary border-border/60 hover:text-text'
          }`}
        >
          <span>Engineering Tools</span>
          <span className="opacity-80">({engineeringCount})</span>
        </button>
      </div>

      {/* Trust & Simulator row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Select
          aria-label="Filter by trust level"
          options={TRUST_OPTIONS}
          value={trustFilter}
          onChange={(val) => onTrustFilterChange(val)}
          className="text-2xs py-0.5 flex-1 max-w-[150px]"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenTriggerSimulator}
          className="text-2xs h-7 px-2.5 font-mono"
        >
          Trigger Simulator
        </Button>
      </div>
    </div>
  );
};
