import React from 'react';
import { ExternalLinkIcon, FileTextIcon } from '../../icons';

export interface SourceCitationProps {
  index?: number;
  sourceTitle: string;
  sourceType?: 'document' | 'slack' | 'notion' | 'github' | 'web';
  snippet?: string;
  url?: string;
  onClick?: () => void;
  className?: string;
}

export const SourceCitation: React.FC<SourceCitationProps> = ({
  index,
  sourceTitle,
  sourceType = 'document',
  snippet,
  url,
  onClick,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1 group relative ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick || (() => url && window.open(url, '_blank'))}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-[var(--color-bg-elevated,#18181c)] text-[var(--color-text-secondary,#a1a1aa)] border border-[var(--color-border-subtle,#27272a)] hover:border-[var(--color-action-primary,#3b82f6)] hover:text-[var(--color-text-primary,#f4f4f5)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
      >
        <FileTextIcon size={10} className="text-[var(--color-text-muted,#71717a)]" />
        <span>{index !== undefined ? `[${index}]` : sourceTitle}</span>
        {url && <ExternalLinkIcon size={9} className="opacity-60" />}
      </button>

      {/* Tooltip on hover */}
      {snippet && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col w-64 p-2 rounded-md bg-[var(--color-bg-elevated,#18181c)] border border-[var(--color-border-strong,#3f3f46)] shadow-xl z-30 text-[11px] text-[var(--color-text-secondary,#a1a1aa)] font-sans">
          <strong className="text-[var(--color-text-primary,#f4f4f5)] font-semibold truncate mb-1">
            {sourceTitle}
          </strong>
          <span className="line-clamp-3 italic text-[var(--color-text-muted,#71717a)]">
            "{snippet}"
          </span>
        </span>
      )}
    </span>
  );
};

SourceCitation.displayName = 'SourceCitation';
