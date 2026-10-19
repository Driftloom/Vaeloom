/**
 * Shared timeline model for the memory lineage surfaces (the detail page and
 * the corrections-tab modal).
 *
 * Both surfaces used to label whichever record they were opened for as the
 * current version and rendered only `chainBackwards` — so a superseded
 * ancestor's page showed its own card as "current" while its active successor,
 * fetched in `chainForwards`, was dropped on the floor. "Current" must come
 * from each record's own status, and the chain must render as a chronological
 * line: oldest ancestor → this version → successors.
 */

export type LineageRecord = Record<string, unknown>;

export interface LineageTimeline {
  /** Chronological order: oldest ancestor → viewed version → successors. */
  ordered: LineageRecord[];
  /** Index of the viewed record in `ordered`; -1 if it was not in the chains. */
  viewedIdx: number;
  /** False when the chain holds nothing but the viewed record itself. */
  hasOtherVersions: boolean;
}

export function buildLineageTimeline(
  chainBackwards: readonly unknown[] | null | undefined,
  chainForwards: readonly unknown[] | null | undefined,
  viewedId: string,
): LineageTimeline {
  const backwards = chainBackwards ?? [];
  const forwards = chainForwards ?? [];
  const self = backwards[0];
  const ordered = [
    ...backwards.slice(1).reverse(),
    ...(self === undefined ? [] : [self]),
    ...forwards,
  ] as LineageRecord[];
  const viewedIdx = ordered.findIndex((m) => String(m['id']) === viewedId);
  return { ordered, viewedIdx, hasOtherVersions: ordered.length > 1 };
}

export function lineageLabel(record: LineageRecord, idx: number, viewedIdx: number): string {
  if (String(record['status'] ?? '') === 'active') return 'Current Version';
  if (idx === viewedIdx) return 'This Version';
  const delta = idx - viewedIdx;
  return delta < 0 ? `v-${-delta} Ancestor` : `v+${delta} Successor`;
}
