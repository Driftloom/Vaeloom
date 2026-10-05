import type { ReactNode } from 'react';

/**
 * Shared shell for every route under /workspace/[workspaceId]/memory.
 *
 * Previously absent, so each of the six memory routes re-declared its own
 * padding/wrap and the sub-routes had no shared landmark for assistive tech.
 */
export default function MemoryLayout({ children }: { children: ReactNode }) {
  return (
    <div data-testid="memory-layout" className="w-full min-w-0 max-w-full">
      {children}
    </div>
  );
}
