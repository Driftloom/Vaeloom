'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Hoisted so the component map identity is stable across renders. Declared
// inside the component it would be a fresh object on every keystroke of a
// streaming message, remounting every node react-markdown owns.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  // Markdown h1/h2/h3 are demoted to h3/h3/h4. Agent prose lives INSIDE a page
  // whose own heading is <h1>Chat</h1>; rendering an <h1> from a message body
  // forks the document outline so a screen reader's heading list reports two
  // top-level headings and the message one looks like the start of the app.
  h1: ({ children }) => (
    <h3 className="text-base font-semibold text-text mt-3 mb-1.5">{children}</h3>
  ),
  h2: ({ children }) => <h3 className="text-sm font-semibold text-text mt-2.5 mb-1">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-medium text-text mt-2 mb-1">{children}</h4>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 text-text-muted italic">
      {children}
    </blockquote>
  ),
  // react-markdown v9 removed the `inline` prop; the previous renderer read it
  // through an `any` cast, which silenced the type error but left `inline`
  // permanently undefined. Every inline code span therefore took the block
  // branch and rendered as a full <pre> box. A fenced block is the only case
  // that carries a `language-` class, so that is what we test.
  code: ({ className, children }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (!isBlock) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-surface-200 text-text font-mono text-xs">
          {children}
        </code>
      );
    }
    return (
      <pre className="p-3 my-2 rounded-lg bg-surface border border-border overflow-x-auto text-xs font-mono text-text">
        <code className={className}>{children}</code>
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded border border-border">
      <table className="min-w-full divide-y divide-border text-xs">
        {/* Without a caption a screen reader announces an unlabelled grid and
            the user has no way to tell which of several tables is which. */}
        <caption className="sr-only">Table in the agent response</caption>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 bg-surface-50 font-semibold text-left text-text-secondary">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-1.5 border-t border-border-subtle">{children}</td>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline break-all"
    >
      {children}
    </a>
  ),
};

export function ChatMarkdown({ children }: { children: string }): JSX.Element {
  return (
    <div className="text-sm leading-relaxed text-text pr-2 break-words space-y-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
