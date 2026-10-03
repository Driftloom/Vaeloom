'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge, IconButton, Tooltip } from '@vaeloom/ui-kit';

interface SkillMarkdownViewerProps {
  content: string;
  className?: string;
}

export const SkillMarkdownViewer: React.FC<SkillMarkdownViewerProps> = ({
  content,
  className = '',
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (code: string, id: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  if (!content || content.trim() === '') {
    return (
      <div className="p-6 text-center text-text-muted text-xs">
        The server sent no markdown documentation for this skill.
      </div>
    );
  }

  return (
    <div className={`prose-container text-text text-xs leading-relaxed space-y-4 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-text pb-2 border-b border-border mb-3 flex items-center justify-between">
              <span>{children}</span>
              <Badge variant="default" size="sm">
                SKILL.md
              </Badge>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold tracking-tight text-primary mt-4 mb-2 pb-1 border-b border-border/50 uppercase text-2xs tracking-wider">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-semibold text-text mt-3 mb-1">{children}</h3>
          ),
          p: ({ children }) => <p className="text-xs text-text-secondary mb-2">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-outside ml-4 space-y-1 mb-3 text-text-secondary text-xs">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-4 space-y-1 mb-3 text-text-secondary text-xs font-mono">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-normal">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/60 bg-surface-hover/50 pl-3 py-1.5 my-2 text-text-muted italic rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-surface border border-border text-primary font-mono text-2xs font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            const codeString = String(children).replace(/\n$/, '');
            const codeId = `code-${codeString.slice(0, 10).replace(/\s+/g, '')}`;
            return (
              <div className="relative group my-2 rounded-lg overflow-hidden border border-border bg-surface">
                <div className="flex items-center justify-between px-3 py-1 bg-surface-hover border-b border-border/50 text-2xs text-text-muted">
                  <span className="font-mono">
                    {codeClassName ? codeClassName.replace('language-', '') : 'text'}
                  </span>
                  <Tooltip content={copiedCodeId === codeId ? 'Copied!' : 'Copy snippet'}>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(codeString, codeId)}
                      className="px-2 py-0.5 rounded text-2xs font-mono text-text hover:text-primary transition-colors"
                      aria-label="Copy code block"
                    >
                      {copiedCodeId === codeId ? 'Copied' : 'Copy'}
                    </button>
                  </Tooltip>
                </div>
                <pre className="p-3 overflow-x-auto font-mono text-2xs text-text leading-relaxed">
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-border">
              <table className="w-full text-left text-2xs border-collapse divide-y divide-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/50 bg-background">{children}</tbody>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold text-text uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-3 py-2 text-text-secondary">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
