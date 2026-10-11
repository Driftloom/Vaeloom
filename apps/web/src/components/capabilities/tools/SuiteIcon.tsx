import React from 'react';

export const SUITE_ICONS: Record<string, string> = {
  'browser-automation':
    'M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
  'memory-graph': 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  'web-search': 'M21 21l-4.35-4.35',
  'agent-bus': 'M5 8v3a2 2 0 002 2h10a2 2 0 002-2V8M12 13v3',
  'code-exec':
    'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'computer-use': 'M2 3h20v14H2zM8 21h8m-4-4v4',
  'file-operations': 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  'kanban-workflow': 'M9 3v18M15 3v18M3 3h18v18H3z',
  'spotify-media': 'M8 11.5a6 6 0 018 0m-9 3a8 8 0 0110 0m-11 3a10 10 0 0112 0',
};

export function SuiteIcon({
  suiteId,
  className = 'w-4 h-4',
}: {
  suiteId: string;
  className?: string;
}) {
  const circle =
    suiteId === 'browser-automation' || suiteId === 'spotify-media' || suiteId === 'web-search';
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      {circle && <circle cx="12" cy="12" r="10" />}
      {suiteId === 'kanban-workflow' && <rect x="3" y="3" width="18" height="18" rx="2" />}
      {suiteId === 'computer-use' && <rect x="2" y="3" width="20" height="14" rx="2" />}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={SUITE_ICONS[suiteId] ?? 'M12 4v16M4 12h16'}
      />
    </svg>
  );
}
