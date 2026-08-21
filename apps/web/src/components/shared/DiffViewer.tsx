import React from 'react';

export interface DiffViewerProps {
  oldText: string;
  newText: string;
}

interface DiffPart {
  value: string;
  kind: 'same' | 'removed' | 'added';
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function computeDiff(oldText: string, newText: string): DiffPart[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  const longestCommonSubsequence = (a: string[], b: string[]): string[] => {
    const n = a.length;
    const m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i]![j] =
          a[i] === b[j]
            ? (dp[i + 1]?.[j + 1] ?? 0) + 1
            : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
      }
    }
    const result: string[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        result.push(a[i] as string);
        i++;
        j++;
      } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
        i++;
      } else {
        j++;
      }
    }
    return result;
  };

  const lcs = longestCommonSubsequence(oldTokens, newTokens);
  const parts: DiffPart[] = [];
  let oi = 0;
  let ni = 0;
  let li = 0;

  while (li < lcs.length) {
    const lcsToken = lcs[li] as string;
    if (oi < oldTokens.length && oldTokens[oi] !== lcsToken) {
      parts.push({ value: oldTokens[oi] as string, kind: 'removed' });
      oi++;
      continue;
    }
    if (ni < newTokens.length && newTokens[ni] !== lcsToken) {
      parts.push({ value: newTokens[ni] as string, kind: 'added' });
      ni++;
      continue;
    }
    parts.push({ value: lcsToken, kind: 'same' });
    oi++;
    ni++;
    li++;
  }
  while (oi < oldTokens.length) {
    parts.push({ value: oldTokens[oi] as string, kind: 'removed' });
    oi++;
  }
  while (ni < newTokens.length) {
    parts.push({ value: newTokens[ni] as string, kind: 'added' });
    ni++;
  }
  return parts;
}

export function DiffViewer({ oldText, newText }: DiffViewerProps) {
  const parts = computeDiff(oldText, newText);
  const removed = parts
    .filter((p) => p.kind === 'removed')
    .map((p) => p.value)
    .join('');
  const added = parts
    .filter((p) => p.kind === 'added')
    .map((p) => p.value)
    .join('');

  return (
    <div
      className="rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed"
      role="group"
      aria-label="Proposed changes"
      aria-details="diff-summary"
    >
      <p id="diff-summary" className="mb-2 text-text-muted">
        {removed ? `${removed.trim().split(/\s+/).length} word(s) removed, ` : ''}
        {added ? `${added.trim().split(/\s+/).length} word(s) added` : 'no wording changes'}
      </p>
      <p>
        {parts.map((part, idx) => {
          if (part.kind === 'removed') {
            return (
              <del
                key={idx}
                aria-label={`removed: ${part.value.trim()}`}
                className="bg-accent/20 text-accent-hover no-underline"
              >
                {part.value}
              </del>
            );
          }
          if (part.kind === 'added') {
            return (
              <ins
                key={idx}
                aria-label={`added: ${part.value.trim()}`}
                className="bg-success/20 text-success-muted no-underline"
              >
                {part.value}
              </ins>
            );
          }
          return (
            <span key={idx} className="text-text">
              {part.value}
            </span>
          );
        })}
      </p>
    </div>
  );
}
