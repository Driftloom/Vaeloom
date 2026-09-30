import { notFound } from 'next/navigation';

/**
 * Workspace 404.
 *
 * `notFound()` hands off to `app/workspace/[workspaceId]/not-found.tsx`, which
 * owns the heading for this route. Rendering markup here as well would put two
 * page-level headings on the page once the boundary resolved, so this stays a
 * bare delegation and the boundary's single heading is the one that renders.
 *
 * That boundary still hand-rolls its heading (`text-6xl font-display font-bold
 * text-primary`) and should move to the canonical PageHeader for the same reason
 * every other workspace page did. It is not part of this migration's file list,
 * so it is reported rather than edited.
 */
export default function WorkspaceCatchAll() {
  notFound();
}
