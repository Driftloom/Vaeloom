import React from 'react';

interface CitationProps {
  source: string;
  text?: string;
  url?: string;
  date?: string;
  className?: string;
}

export function Citation({ source, text, url, date, className = '' }: CitationProps) {
  const content = (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
      <span className="text-primary" aria-hidden="true">
        [
      </span>
      <span className="font-medium">{source}</span>
      {date && <span>({date})</span>}
      <span className="text-primary" aria-hidden="true">
        ]
      </span>
    </span>
  );

  return (
    <span className={`inline-block ${className}`}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background rounded"
        >
          {content}
        </a>
      ) : (
        content
      )}
      {text && <span className="ml-1 text-xs text-text-muted italic">&quot;{text}&quot;</span>}
    </span>
  );
}
