'use client';

import { useEffect, useState } from 'react';

/**
 * A value that settles after `delayMs` of quiet.
 *
 * WHY A HOOK AND NOT AN INLINE EFFECT
 *
 * The previous `DocumentsHub` ran TWO effects that both called `fetchDocuments`:
 * one keyed on `[searchQuery, fetchDocuments, showArchived, selectedFolderId]`
 * (the 300 ms debounce) and one keyed on `[fetchDocuments, showArchived, page,
 * selectedFolderId]` (the fetch itself). Because `fetchDocuments` had
 * `searchQuery` in its own dependency list, the act of typing changed the
 * callback identity, so BOTH effects re-ran — the debounce timer was created and
 * immediately torn down by the second effect's own trigger, and every keystroke
 * produced a request. Two effects racing to own one request is the actual bug;
 * the delay is incidental.
 *
 * This collapses the race: `searchInput` (immediate, what the field shows) and
 * `search` (settled, what the request uses) are separate values, and the single
 * fetch effect depends only on `search`.
 *
 * @param value The immediate value.
 * @param delayMs Quiet period. Defaults to 300 ms.
 * @returns `value` after it has stopped changing for `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
