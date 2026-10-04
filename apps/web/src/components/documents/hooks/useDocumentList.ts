'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { documentApi, type DocumentResponse } from '@/lib/api-client';

import { useDebouncedValue } from './useDebouncedValue';

/**
 * Rows per page. `GET /documents` accepts `page_size` in 1..100
 * (`api-client.ts` `DocumentListParams`), so 50 is inside the range and is half
 * of the ceiling — a deliberate choice to keep the page count low enough that
 * `Pagination`'s Previous/Next is a usable control on a workspace with tens of
 * thousands of files.
 */
export const PAGE_SIZE = 50;

/** Silence in the search field before a request goes out. */
export const SEARCH_DEBOUNCE_MS = 300;

export interface UseDocumentListResult {
  /** The rows the server returned for the current filter and page. */
  documents: DocumentResponse[];
  /**
   * Total matching rows across ALL pages, as reported by the server.
   *
   * While a search is active this is the number of rows the search endpoint
   * returned, which is a LOWER BOUND, not a workspace total:
   * `GET /documents/search` answers with a bare array and no count
   * (`DocumentSearchParams`). It is used to decide whether to offer pagination,
   * and pagination is suppressed during a search precisely because this number
   * cannot be trusted as a total.
   */
  total: number;
  /** 1-based. Always at least 1. Forced to 1 while a search is active. */
  page: number;
  /** Never less than 1. */
  totalPages: number;
  setPage: (page: number) => void;

  /** No rows have ever been rendered for this workspace: show a blocking loader. */
  loading: boolean;
  /** Rows are on screen and a newer request is in flight: keep them, say so. */
  refreshing: boolean;
  error: string | null;
  /** Re-run the current request verbatim. */
  retry: () => void;
  /** Re-run the current request; alias kept for mutation callbacks that reload. */
  refresh: () => void;

  /** What the search field shows. Changes immediately. */
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  includeArchived: boolean;
  toggleArchived: () => void;
  selectedFolderId: string | null;
  /** `null` clears the folder filter. */
  selectFolder: (folderId: string | null) => void;

  /**
   * True when a search filled exactly one page, which means the endpoint may
   * have truncated and there may be more matches than are visible.
   */
  searchTruncated: boolean;

  selectedIds: ReadonlySet<string>;
  selectionCount: number;
  /** Sum of the selected rows' known sizes, or `null` when none of them has one. */
  selectedBytes: number | null;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  toggleSelectOne: (id: string) => void;
  toggleSelectAllVisible: () => void;
  clearSelection: () => void;

  /** Optimistically show a just-uploaded row before the reload lands. */
  prependDocument: (doc: DocumentResponse) => void;
  /** Drop a row that no longer exists, so the table does not offer actions on it. */
  dropDocuments: (ids: string[]) => void;
}

/**
 * Documents, the filters that narrow them, pagination and row selection.
 *
 * WHAT MOVED HERE AND WHY
 *
 * Four separate concerns used to share one `useState` block and one
 * `useCallback`, which is what produced the two headline defects:
 *
 *  - The folder filter was applied to the FIRST PAGE client-side
 *    (`docs.filter(d => d.folderId === folderId)`) while `total` came from the
 *    unfiltered server count, so a folder rendered as empty and the pagination
 *    count disagreed with the rows. `folder_id` is now a query parameter, which
 *    is the whole reason the server exposes it.
 *
 *  - `setPage` was declared and never called, so `page` was permanently 1 and
 *    `total` was write-only. `Pagination` needs both, so both are now derived
 *    from one source and `setPage` is reachable from the UI.
 *
 * Selection is here rather than in the table because a selection outlives the
 * rows that produced it: the bulk bar, the table's checkboxes and the mutation
 * callbacks all need the same `Set`, and splitting it across a prop chain made
 * three copies that could disagree.
 *
 * @param workspaceId The workspace to query. `''` disables every request.
 */
export function useDocumentList(workspaceId: string): UseDocumentListResult {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  const search = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);

  /**
   * Monotonic request id. Without it, a slow page-1 request that resolves after
   * a fast page-2 request overwrites the newer rows, and `setLoading(false)`
   * from the stale response clears the busy state while a request is still in
   * flight. Both were possible before because two effects could issue requests
   * concurrently.
   */
  const requestId = useRef(0);
  /** Whether any row has been committed for this workspace yet. */
  const hasRows = useRef(false);

  const runFetch = useCallback(async () => {
    if (!workspaceId) {
      // No workspace: this is not an error and not a result. Leave the list
      // empty and stop claiming we are loading.
      setDocuments([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const id = (requestId.current += 1);
    if (hasRows.current) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (search) {
        const results = await documentApi.search(workspaceId, search, selectedFolderId, {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        });
        if (id !== requestId.current) return;
        const rows = Array.isArray(results) ? results : [];
        setDocuments(rows);
        setTotal(rows.length);
      } else {
        const response = await documentApi.list({
          workspace_id: workspaceId,
          // Server-side folder filter. `null` is omitted from the query string by
          // `encodeParams`, which is the same as the route's `None` default.
          folder_id: selectedFolderId,
          include_archived: includeArchived,
          page,
          page_size: PAGE_SIZE,
        });
        if (id !== requestId.current) return;
        const rows = Array.isArray(response?.documents) ? response.documents : [];
        setDocuments(rows);
        setTotal(typeof response?.total === 'number' ? response.total : rows.length);
      }
      hasRows.current = true;
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [workspaceId, search, selectedFolderId, includeArchived, page]);

  useEffect(() => {
    // Switching workspaces invalidates the page, the selection and the "has rows"
    // memory. Done as an effect (not inside `selectFolder`) so it also fires when
    // the workspace id arrives from the router after the first render.
    //
    // Declared BEFORE the fetch effect on purpose: effects run in declaration
    // order, so clearing `hasRows` first is what makes a workspace switch show
    // the blocking loader rather than one tick of "Refreshing…" over the previous
    // workspace's rows.
    setPageState(1);
    setSelectedIds(new Set<string>());
    hasRows.current = false;
  }, [workspaceId]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  /**
   * A page count from the search endpoint's result length would be a guess, so
   * it is 1 while a search is active.
   */
  const totalPages = search ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Clamp a page that the newest result set has made out of range. Guarded on
  // `page > 1` because `totalPages` is floored at 1, so this cannot ping-pong.
  useEffect(() => {
    if (page > totalPages) setPageState(totalPages);
  }, [page, totalPages]);

  const setPage = useCallback((next: number) => {
    setPageState(Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1);
  }, []);

  /**
   * Filter and page changes both reset to page 1 and drop the selection.
   *
   * Dropping the selection is not cosmetic: a selection survives a filter
   * change, so "Delete Selected" would act on rows the user can no longer see
   * — and on rows from a different page than the one being displayed.
   */
  const resetPaging = useCallback(() => {
    setPageState(1);
    setSelectedIds(new Set<string>());
  }, []);

  const onSearchInputChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      resetPaging();
    },
    [resetPaging],
  );

  const toggleArchived = useCallback(() => {
    setIncludeArchived((prev) => !prev);
    resetPaging();
  }, [resetPaging]);

  const selectFolder = useCallback(
    (folderId: string | null) => {
      setSelectedFolderId(folderId);
      resetPaging();
    },
    [resetPaging],
  );

  const visibleIds = useMemo(() => documents.map((doc) => doc.id), [documents]);

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds(allVisibleSelected ? new Set<string>() : new Set(visibleIds));
  }, [allVisibleSelected, visibleIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set<string>()), []);

  /**
   * Sum of the selected rows' recorded sizes, or `null` when not one selected row
   * has a size. `null` rather than `0` on purpose: the bulk bar omits the figure
   * instead of rendering "0 B" for "we do not know".
   */
  const selectedBytes = useMemo(() => {
    let sum = 0;
    let known = 0;
    for (const doc of documents) {
      if (!selectedIds.has(doc.id)) continue;
      const raw = doc.metadata?.size ?? doc.metadata?.['size_bytes'];
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(n) && n > 0) {
        sum += n;
        known += 1;
      }
    }
    return known > 0 ? sum : null;
  }, [documents, selectedIds]);

  const prependDocument = useCallback((doc: DocumentResponse) => {
    setDocuments((prev) => [doc, ...prev.filter((row) => row.id !== doc.id)]);
  }, []);

  const dropDocuments = useCallback((ids: string[]) => {
    const doomed = new Set(ids);
    setDocuments((prev) => prev.filter((row) => !doomed.has(row.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of doomed) next.delete(id);
      return next;
    });
  }, []);

  return {
    documents,
    total,
    page,
    totalPages,
    setPage,
    loading,
    refreshing,
    error,
    retry: () => void runFetch(),
    refresh: () => void runFetch(),
    searchInput,
    onSearchInputChange,
    includeArchived,
    toggleArchived,
    selectedFolderId,
    selectFolder,
    searchTruncated: Boolean(search) && documents.length === PAGE_SIZE,
    selectedIds,
    selectionCount: selectedIds.size,
    selectedBytes,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectOne,
    toggleSelectAllVisible,
    clearSelection,
    prependDocument,
    dropDocuments,
  };
}
