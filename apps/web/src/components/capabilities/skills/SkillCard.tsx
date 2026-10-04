'use client';

import React from 'react';
import { Badge, Button, Spinner, StatusDot, Switch } from '@vaeloom/ui-kit';
import type { CapabilityItem } from '@/lib/capabilities-data';

export interface SkillRow {
  key: string;
  item: CapabilityItem;
  installed: boolean;
  bundled: boolean;
  slug: string | null;
  serverBacked: boolean;
}

export type SkillSaveOutcome = 'server' | 'local' | 'failed';

export interface SkillCardProps {
  row: SkillRow;
  isSelected: boolean;
  isPending: boolean;
  onSelect: (key: string) => void;
  onToggleEnabled: (key: string, next: boolean) => void;
  onInstall: (key: string) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

export const SkillCard: React.FC<SkillCardProps> = ({
  row,
  isSelected,
  isPending,
  onSelect,
  onToggleEnabled,
  onInstall,
  buttonRef,
}) => {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        isSelected
          ? 'bg-primary/10 border-l-2 border-primary text-primary'
          : 'hover:bg-surface-hover border-l-2 border-transparent'
      }`}
    >
      <button
        type="button"
        ref={buttonRef}
        aria-current={isSelected ? 'true' : undefined}
        aria-label={row.item.name}
        onClick={() => onSelect(row.key)}
        className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface py-1"
      >
        <span className="flex items-center gap-1.5">
          {!row.installed && <StatusDot status="idle" size="sm" label="Not installed" />}
          <span className="text-xs font-medium truncate text-text">{row.item.name}</span>
        </span>
        <span className="mt-1 flex items-center gap-1 flex-wrap">
          {row.installed && !row.item.enabled && (
            <Badge variant="warning" size="sm">
              Disabled
            </Badge>
          )}
          {row.bundled && (
            <Badge variant="default" size="sm">
              Bundled
            </Badge>
          )}
          {!row.serverBacked && (
            <Badge variant="info" size="sm">
              Local only
            </Badge>
          )}
          {row.item.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              {tag}
            </Badge>
          ))}
          {row.item.tags.length === 0 && <span className="text-2xs text-text-muted">No tags</span>}
        </span>
      </button>

      {row.installed ? (
        <Switch
          checked={row.item.enabled}
          onChange={(next: boolean) => onToggleEnabled(row.key, next)}
          label={<span className="sr-only">{`Enable ${row.item.name}`}</span>}
          disabled={isPending}
        />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => onInstall(row.key)}
        >
          {isPending ? <Spinner size="sm" /> : 'Install'}
        </Button>
      )}
    </div>
  );
};
