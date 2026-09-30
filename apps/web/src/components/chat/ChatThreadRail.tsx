'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Thread } from './types';

/**
 * Conversation list for the chat route.
 *
 * Doubles as a static rail on ≥md and a modal drawer below it. The drawer is
 * `open`-controlled by the page, which owns the hamburger — a rail that owned its
 * own open state shipped `useState(true)` and covered the whole chat on first
 * paint at 375px.
 */

export interface ChatThreadRailProps {
  threads: Thread[];
  activeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClear: (id: string) => void;
  agentCount: number | null;
  commandsAvailable: number | null;
}

const DESKTOP_MEDIA = '(min-width: 768px)';
/** Documented hook the page renders on the hamburger; see ChatHeader. */
const DRAWER_TRIGGER_SELECTOR = '[data-chat-drawer-trigger]';
const RELATIVE_TICK_MS = 60_000;

const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/**
 * The previous helper returned the literal string "now" forever, so a thread from
 * last Tuesday was indistinguishable from one written a second ago. `Math.max`
 * pins a backwards clock jump (NTP correction, user-edited system time, a
 * `updatedAt` in the future) to "now" instead of rendering "in -4 minutes".
 */
function formatRelative(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const elapsedMs = Math.max(0, now - then);
  if (elapsedMs < RELATIVE_TICK_MS) return 'now';
  for (const [unit, seconds] of RELATIVE_UNITS) {
    const unitMs = seconds * 1000;
    if (elapsedMs >= unitMs) {
      return relativeFormatter.format(-Math.floor(elapsedMs / unitMs), unit);
    }
  }
  return 'now';
}

type PendingAction = 'clear' | 'delete';

function messageCountLabel(count: number): string {
  return count === 1 ? '1 message' : `${count} messages`;
}

export function ChatThreadRail({
  threads,
  activeId,
  open,
  onOpenChange,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClear,
  agentCount,
  commandsAvailable,
}: ChatThreadRailProps): JSX.Element {
  const railRef = useRef<HTMLElement | null>(null);
  const openRowRef = useRef<HTMLDivElement | null>(null);

  const [isDesktop, setIsDesktop] = useState(true);
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [pending, setPending] = useState<{ id: string; action: PendingAction } | null>(null);
  // Null until the first effect tick: reading the clock during render would make
  // the server and client disagree on every label and trip hydration.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const query_ = window.matchMedia(DESKTOP_MEDIA);
    const sync = (): void => setIsDesktop(query_.matches);
    sync();
    query_.addEventListener('change', sync);
    return () => query_.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (menuId === null) return;
    const onPointerDown = (e: MouseEvent): void => {
      const target = e.target;
      if (target instanceof Node && openRowRef.current && !openRowRef.current.contains(target)) {
        setMenuId(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuId]);

  const closeDrawer = (): void => {
    onOpenChange(false);
    document.querySelector<HTMLElement>(DRAWER_TRIGGER_SELECTOR)?.focus();
  };

  // Focus must move into the drawer on open, or a screen-reader/keyboard user is
  // left tabbing through the page behind an overlay they cannot perceive.
  useEffect(() => {
    if (!open || isDesktop) return;
    const focusTarget =
      railRef.current?.querySelector<HTMLElement>('[data-rail-autofocus]') ?? railRef.current;
    focusTarget?.focus();
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrawer();
        return;
      }
      if (e.key !== 'Tab' || isDesktop) return;
      const rail = railRef.current;
      if (!rail) return;
      const stops = Array.from(rail.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (node) => node.getClientRects().length > 0,
      );
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !rail.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // closeDrawer is stable per render only through its two props; both are
    // listed so the listener never captures a stale parent callback.
  }, [open, isDesktop, onOpenChange]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(needle));
  }, [threads, query]);

  const startRename = (thread: Thread): void => {
    setRenameId(thread.id);
    setDraftTitle(thread.title);
    setPending(null);
  };

  const commitRename = (): void => {
    if (renameId === null) return;
    const next = draftTitle.trim();
    if (next.length > 0 && next !== threads.find((t) => t.id === renameId)?.title) {
      onRename(renameId, next);
    }
    setRenameId(null);
  };

  const cancelRename = (): void => setRenameId(null);

  const runPending = (): void => {
    if (pending === null) return;
    if (pending.action === 'delete') onDelete(pending.id);
    else onClear(pending.id);
    setPending(null);
    setMenuId(null);
  };

  const handleSelect = (id: string): void => {
    onSelect(id);
    if (open && !isDesktop) onOpenChange(false);
  };

  const handleNew = (): void => {
    onNew();
    if (open && !isDesktop) onOpenChange(false);
  };

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
        />
      )}

      <aside
        id="chat-thread-rail"
        ref={railRef}
        aria-label="Conversations"
        className={`${open ? 'flex' : 'hidden md:flex'} w-[260px] shrink-0 flex-col border-r border-border/40 bg-background max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-[82%] max-md:shadow-xl`}
      >
        <div className="flex h-12 items-center justify-between border-b border-border/40 px-4">
          <span className="font-mono text-xs tracking-widest text-text-dim">THREADS</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNew}
              className="rounded-md px-1.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none"
            >
              ＋ New
            </button>
            {open && (
              <button
                type="button"
                data-rail-autofocus=""
                onClick={closeDrawer}
                aria-label="Close conversation list"
                className="-mr-1.5 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none md:hidden"
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  ✕
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="border-b border-border/40 px-3 py-2">
          <p className="text-2xs text-text-dim">
            {agentCount === null ? 'Loading agents…' : `${agentCount} agents available`}
          </p>
        </div>

        {threads.length > 0 && (
          <div className="border-b border-border/40 px-3 py-2">
            <input
              type="search"
              aria-label="Search conversations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-lg border border-border/50 bg-surface-50 px-2.5 py-1.5 text-xs text-text transition-colors placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
          {threads.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-sm text-text-dim">No conversations yet</p>
              <button
                type="button"
                onClick={handleNew}
                className="mt-3 rounded-full border border-border/50 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover motion-reduce:transition-none"
              >
                New conversation
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-dim">No conversations match</p>
          ) : (
            <ul className="space-y-1">
              {visible.map((t) => {
                const isActive = t.id === activeId;
                const menuOpen = menuId === t.id;
                const menuIdDom = `chat-thread-actions-${t.id}`;
                const stamp = now === null ? '' : formatRelative(t.updatedAt || t.createdAt, now);
                return (
                  <li key={t.id} className="relative">
                    <div
                      ref={menuOpen ? openRowRef : undefined}
                      className="flex items-stretch gap-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(t.id)}
                        aria-current={isActive ? 'true' : undefined}
                        className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-left ${
                          isActive
                            ? 'border-border/50 bg-surface'
                            : 'border-transparent hover:bg-surface-hover'
                        }`}
                      >
                        <span className="block truncate text-sm text-text">{t.title}</span>
                        <span className="mt-0.5 block truncate text-2xs text-text-dim">
                          {stamp.length > 0 ? `${stamp} · ` : ''}
                          {messageCountLabel(t.messages.length)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPending(null);
                          setMenuId(menuOpen ? null : t.id);
                        }}
                        aria-label={`Actions for ${t.title}`}
                        aria-expanded={menuOpen}
                        aria-controls={menuIdDom}
                        className="w-7 shrink-0 rounded-lg text-text-dim transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none"
                      >
                        <span aria-hidden="true" className="text-sm leading-none">
                          ⋯
                        </span>
                      </button>
                    </div>

                    {menuOpen && (
                      <div
                        id={menuIdDom}
                        className="absolute right-0 top-full z-10 mt-1 w-52 rounded-xl border border-border/50 bg-surface-elevated p-1 shadow-card"
                      >
                        {renameId === t.id ? (
                          <div className="p-1">
                            <input
                              type="text"
                              aria-label={`Rename ${t.title}`}
                              value={draftTitle}
                              autoFocus
                              onChange={(e) => setDraftTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitRename();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelRename();
                                }
                              }}
                              className="w-full rounded-lg border border-border/50 bg-surface-50 px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                            />
                            <div className="mt-2 flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={cancelRename}
                                className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={commitRename}
                                className="rounded-md bg-action px-2 py-1 text-xs text-action-fg transition-colors hover:bg-action-hover motion-reduce:transition-none"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : pending !== null && pending.id === t.id ? (
                          <div className="p-1">
                            <p className="text-xs text-text-secondary">
                              {pending.action === 'delete'
                                ? `Delete “${t.title}” and its ${messageCountLabel(
                                    t.messages.length,
                                  )}? This cannot be undone.`
                                : `Remove all ${messageCountLabel(
                                    t.messages.length,
                                  )} from “${t.title}”? The conversation is kept.`}
                            </p>
                            <div className="mt-2 flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setPending(null)}
                                className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                aria-label={
                                  pending.action === 'delete' ? 'Confirm delete' : 'Confirm clear'
                                }
                                onClick={runPending}
                                className="rounded-md bg-error px-2 py-1 text-xs text-error-fg transition-colors hover:bg-error/90 motion-reduce:transition-none"
                              >
                                {pending.action === 'delete' ? 'Yes, delete' : 'Yes, clear'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => startRename(t)}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-text transition-colors hover:bg-surface-hover motion-reduce:transition-none"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => setPending({ id: t.id, action: 'clear' })}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-text transition-colors hover:bg-surface-hover motion-reduce:transition-none"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              onClick={() => setPending({ id: t.id, action: 'delete' })}
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-error transition-colors hover:bg-error/10 motion-reduce:transition-none"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border/40 p-3">
          <p className="text-2xs text-text-dim">
            {commandsAvailable === null
              ? 'Loading commands…'
              : `${commandsAvailable} commands available`}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-text-dim">
            BYOK → <span className="font-mono text-text">Settings → API Keys</span>
          </p>
        </div>
      </aside>
    </>
  );
}
