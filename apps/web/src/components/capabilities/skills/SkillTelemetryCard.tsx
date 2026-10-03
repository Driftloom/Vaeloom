'use client';

import React from 'react';
import { Badge, Button, IconButton, Tooltip } from '@vaeloom/ui-kit';
import type { SkillRow } from '../SkillsView';
import { formatRelativeTime } from '@/lib/capabilities-data';

interface SkillTelemetryCardProps {
  row: SkillRow;
  onOpenPlayground: (row: SkillRow) => void;
  onCopyDoc: (key: string) => void;
  onEditDoc?: () => void;
  isEditing?: boolean;
}

export const SkillTelemetryCard: React.FC<SkillTelemetryCardProps> = ({
  row,
  onOpenPlayground,
  onCopyDoc,
  onEditDoc,
  isEditing,
}) => {
  const { item } = row;

  const handleDownloadDoc = () => {
    const filename = `${item.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.skill.md`;
    const blob = new Blob([item.markdownDoc || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const trustVariant =
    (item.trustClass as string) === 'core_trusted'
      ? 'success'
      : (item.trustClass as string) === 'enterprise'
        ? 'primary'
        : 'default';

  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-text tracking-tight truncate">
              {item.name}
            </h3>
            {row.bundled && (
              <Badge variant="default" size="sm">
                Bundled
              </Badge>
            )}
            {row.installed ? (
              item.enabled ? (
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Disabled
                </Badge>
              )
            ) : (
              <Badge variant="info" size="sm">
                Catalog
              </Badge>
            )}
            <Badge variant={trustVariant} size="sm">
              {item.trustClass || 'community'}
            </Badge>
            {item.version && (
              <span className="text-2xs font-mono text-text-muted bg-surface-hover px-1.5 py-0.5 rounded">
                v{item.version}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
            {item.description || 'No description provided by the skill registry.'}
          </p>
        </div>

        {/* Primary Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="primary"
            onClick={() => onOpenPlayground(row)}
            className="text-xs flex items-center gap-1.5"
            aria-label={`Open Playground for ${item.name}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Test Playground</span>
          </Button>

          <Tooltip content="Download instructions as .skill.md">
            <IconButton
              size="sm"
              onClick={handleDownloadDoc}
              aria-label={`Download ${item.name} markdown document`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </IconButton>
          </Tooltip>

          <Tooltip content="Copy markdown instructions to clipboard">
            <IconButton
              size="sm"
              onClick={() => onCopyDoc(row.key)}
              aria-label={`Copy markdown for ${item.name}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Grid of Key Telemetry Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-surface-hover/30 border border-border-subtle text-2xs">
        <div>
          <span className="text-text-muted block">Required Scope</span>
          <span
            className="font-mono text-text truncate block mt-0.5"
            title={item.requiredScope || 'None'}
          >
            {item.requiredScope || 'None'}
          </span>
        </div>
        <div>
          <span className="text-text-muted block">Autonomy Tier</span>
          <span className="text-text font-medium block mt-0.5 capitalize">
            {item.autonomy || 'Autonomous'}
          </span>
        </div>
        <div>
          <span className="text-text-muted block">Execution Count</span>
          <span className="text-text font-semibold block mt-0.5">
            Total: {item.usageCount === 0 ? '0 runs' : `${item.usageCount} runs`}
          </span>
        </div>
        <div>
          <span className="text-text-muted block">Last Invoked</span>
          <span className="text-text block mt-0.5">
            Recorded: {formatRelativeTime(item.lastUsedAt)}
          </span>
        </div>
      </div>

      {/* Triggers & Keywords */}
      <div className="flex items-center gap-2 flex-wrap text-2xs pt-0.5">
        <span className="text-text-muted font-medium">Triggers:</span>
        {item.triggers && item.triggers.length > 0 ? (
          item.triggers.map((trigger) => (
            <span
              key={trigger}
              className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono"
            >
              &ldquo;{trigger}&rdquo;
            </span>
          ))
        ) : (
          <span className="text-text-muted italic">
            Ambient (Injected on matching category / agent)
          </span>
        )}
      </div>
    </div>
  );
};
