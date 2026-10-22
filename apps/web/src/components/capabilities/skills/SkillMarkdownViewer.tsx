'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge, Tooltip } from '@vaeloom/ui-kit';

const deriveBlockId = (node: unknown, code: string): string => {
  const line = (node as { position?: { start?: { line?: number } } } | undefined)?.position?.start
    ?.line;
  if (typeof line === 'number') return `code-line-${line}`;
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i)) | 0;
  }
  return `code-${Math.abs(hash).toString(36)}`;
};

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
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(code).then(
      () => {
        setCopiedCodeId(id);
        setTimeout(() => setCopiedCodeId(null), 2000);
      },
      () => {},
    );
  };

  if (!content || content.trim() === '') {
    return (
      <div className="p-6 text-center text-text-muted text-xs">
        The server sent no markdown documentation for this skill.
      </div>
    );
  }

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="flex items-center justify-between pb-2 border-b border-border mb-3">
              <span>{children}</span>
              <Badge variant="default" size="sm">
                SKILL.md
              </Badge>
            </h1>
          ),
          code: ({ node, className: codeClassName, children, ...props }) => {
            if (!codeClassName) {
              return <code {...props}>{children}</code>;
            }
            const codeString = String(children).replace(/\n$/, '');
            const codeId = deriveBlockId(node, codeString);
            return (
              <div className="relative group my-2 rounded-card overflow-hidden border border-border bg-surface">
                <div className="flex items-center justify-between px-3 py-1 bg-surface-hover border-b border-border-subtle text-xs text-text-muted">
                  <span className="font-mono">
                    {codeClassName ? codeClassName.replace('language-', '') : 'text'}
                  </span>
                  <Tooltip content={copiedCodeId === codeId ? 'Copied!' : 'Copy snippet'}>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(codeString, codeId)}
                      className="px-2 py-0.5 rounded text-xs font-mono text-text hover:text-primary transition-colors"
                      aria-label="Copy code block"
                    >
                      {copiedCodeId === codeId ? 'Copied' : 'Copy'}
                    </button>
                  </Tooltip>
                </div>
                <pre>
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-card border border-border">{children}</div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
