import React from 'react';

import { ExternalLinkIcon, FileTextIcon } from '../../icons';
import { MIN_TOUCH_TARGET } from '../layout/touchTarget';

export interface SourceCitationProps {
  index?: number;
  sourceTitle: string;
  sourceType?: 'document' | 'slack' | 'notion' | 'github' | 'web';
  snippet?: string;
  url?: string;
  onClick?: () => void;
  className?: string;
}

const sourceTypeLabel: Record<NonNullable<SourceCitationProps['sourceType']>, string> = {
  document: 'Document',
  slack: 'Slack message',
  notion: 'Notion page',
  github: 'GitHub resource',
  web: 'Web page',
};

export const SourceCitation: React.FC<SourceCitationProps> = ({
  index,
  sourceTitle,
  sourceType = 'document',
  snippet,
  url,
  onClick,
  className = '',
}) => {
  const TypeIcon = sourceType === 'web' ? ExternalLinkIcon : FileTextIcon;
  const snippetId = `source-citation-snippet-${index ?? sourceTitle}`;

  return (
    <span className={`inline-flex items-center gap-1 group relative ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick || (() => url && window.open(url, '_blank', 'noopener,noreferrer'))}
        aria-describedby={snippet ? snippetId : undefined}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-surface-200 text-text-secondary border border-border-subtle hover:border-primary hover:text-text transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${MIN_TOUCH_TARGET}`}
      >
        <TypeIcon size={10} className="text-text-muted" />
        <span>
          {index !== undefined ? `[${index}]` : sourceTitle}
          <span className="sr-only">{` — ${sourceTypeLabel[sourceType]}`}</span>
        </span>
        {url && <ExternalLinkIcon size={9} className="opacity-60" />}
      </button>

      {/* The panel is CSS-hidden, so it stays in the DOM and can back
          aria-describedby; group-focus-within keeps it reachable by keyboard. */}
      {snippet && (
        <span
          id={snippetId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex group-focus-within:flex flex-col w-64 p-2 rounded-md bg-surface-200 border border-border-strong shadow-xl z-30 text-xs text-text-secondary font-sans"
        >
          <strong className="text-text font-semibold truncate mb-1">{sourceTitle}</strong>
          <span className="line-clamp-3 italic text-text-muted">&ldquo;{snippet}&rdquo;</span>
        </span>
      )}
    </span>
  );
};

SourceCitation.displayName = 'SourceCitation';
