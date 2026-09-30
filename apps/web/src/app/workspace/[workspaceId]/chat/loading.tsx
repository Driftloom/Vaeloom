/**
 * Skeleton geometry mirrors ChatWindow's real layout exactly (h-12 header,
 * `max-w-[768px]` transcript column with `px-4 md:px-6`, border-top composer dock)
 * so the swap to the live component causes no layout shift. Anything the skeleton
 * shows that the real component does not is a skeleton that lies: the tool-chip row
 * was removed for that reason — the real empty state never renders one.
 */
export default function ChatLoading() {
  return (
    <div
      role="status"
      aria-label="Loading chat"
      className="flex h-full w-full flex-col overflow-hidden bg-background animate-pulse motion-reduce:animate-none"
    >
      <span className="sr-only">Loading the chat transcript and message composer.</span>

      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 shrink-0 rounded-full bg-surface-200" />
          <div className="space-y-1">
            <div className="h-4 w-24 rounded bg-surface-200" />
            <div className="h-3 w-16 rounded bg-surface-200" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-surface-200" />
          <div className="h-8 w-20 rounded-lg bg-surface-200" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-[768px] space-y-8 px-4 py-8 md:px-6">
          <div className="flex gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-surface-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-surface-200" />
              <div className="h-16 w-3/4 rounded-xl bg-surface-200" />
            </div>
          </div>

          <div className="flex justify-end">
            <div className="h-12 w-1/2 rounded-2xl bg-surface-200" />
          </div>

          <div className="flex gap-3">
            <div className="h-7 w-7 shrink-0 rounded-full bg-surface-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-surface-200" />
              <div className="h-24 w-5/6 rounded-xl bg-surface-200" />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border/40">
        <div className="mx-auto w-full max-w-[768px] px-4 py-3 md:px-6">
          <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-surface px-2 py-2">
            <div className="h-10 flex-1 rounded-lg bg-surface-200" />
            <div className="h-8 w-8 shrink-0 rounded-lg bg-surface-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
