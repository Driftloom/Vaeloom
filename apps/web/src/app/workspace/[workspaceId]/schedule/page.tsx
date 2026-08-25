'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@vaeloom/ui-kit';
import { eventApi, approvalApi } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import type { Event } from '@vaeloom/shared-types';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dd.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays}d`;
  return d.toLocaleDateString();
}

function getSourceBadge(e: Event): { label: string; cls: string } {
  const src = (e.source ?? '').toLowerCase();
  const payloadSrc = String((e.payload as Record<string, unknown>)?.['source'] ?? '').toLowerCase();
  const combined = `${src} ${payloadSrc}`;
  if (combined.includes('gmail'))
    return { label: 'Gmail', cls: 'bg-error/10 text-error border-error/30' };
  if (combined.includes('agent') || (e.payload as Record<string, unknown>)?.['proposed'])
    return { label: 'Agent', cls: 'bg-violet-500/10 text-violet-700 border-violet-500/20' };
  return { label: 'You', cls: 'bg-success/10 text-success border-success/30' };
}

function isProposed(e: Event): boolean {
  const p = e.payload as Record<string, unknown>;
  return Boolean(
    p?.['proposed'] ||
    p?.['requiresApproval'] ||
    p?.['approvalId'] ||
    p?.['approval_id'] ||
    (e.status === 'published' &&
      String(e.priority).toLowerCase() === 'high' &&
      String(e.type).includes('proposed')),
  );
}

function getApprovalId(e: Event): string | undefined {
  const p = e.payload as Record<string, unknown>;
  return (
    (p?.['approvalId'] as string) ??
    (p?.['approval_id'] as string) ??
    (p?.['approval_id'] as string)
  );
}

function getEventDate(e: Event): string | null {
  const p = e.payload as Record<string, unknown>;
  const deadline = p?.['deadline'] as string | undefined;
  if (deadline && !isNaN(Date.parse(deadline))) return deadline;
  return e.createdAt;
}

export default function SchedulePage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Event | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createCategory, setCreateCategory] = useState('user');
  const [createPriority, setCreatePriority] = useState('normal');
  const [busyApprove, setBusyApprove] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [reminders, setReminders] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('vaeloom-reminders') ?? '{}');
    } catch {
      return {};
    }
  });

  const toggleReminder = (eventId: string) => {
    setReminders((prev) => {
      const next = { ...prev, [eventId]: !prev[eventId] };
      localStorage.setItem('vaeloom-reminders', JSON.stringify(next));
      return next;
    });
  };

  const fetchEvents = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await eventApi.list({ workspace_id: workspaceId });
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterSource !== 'all') {
        const b = getSourceBadge(e).label.toLowerCase();
        if (b !== filterSource) return false;
      }
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = String(
          (e.payload as Record<string, unknown>)?.['title'] ?? e.type,
        ).toLowerCase();
        if (!title.includes(q) && !e.type.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [events, filterSource, filterCategory, search]);

  const conflicts = useMemo(() => {
    const conflictMap = new Set<string>();
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const a = filtered[i];
        const b = filtered[j];
        if (!a || !b) continue;
        const aDate = new Date(getEventDate(a) ?? a.createdAt).toDateString();
        const bDate = new Date(getEventDate(b) ?? b.createdAt).toDateString();
        if (aDate === bDate) {
          conflictMap.add(a.id);
          conflictMap.add(b.id);
        }
      }
    }
    return conflictMap;
  }, [filtered]);

  // F-07 state completeness: inline validation + submit loading for create.
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<{ title?: string; date?: string }>({});

  const handleCreate = useCallback(async () => {
    const errs: typeof createErrors = {};
    if (!createTitle.trim()) errs.title = 'Title is required';
    if (!createDate) errs.date = 'Date is required';
    setCreateErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        title: createTitle.trim(),
        deadline: new Date(createDate).toISOString(),
        workspaceId,
      };
      await eventApi.publish({
        type: createTitle.trim().toLowerCase().replace(/\s+/g, '_'),
        source: 'user',
        category: createCategory as Event['category'],
        payload,
        priority: createPriority as Event['priority'],
        workspace_id: workspaceId,
      });
      toast({ tone: 'success', title: 'Event created', detail: createTitle.trim() });
      setShowCreate(false);
      setCreateTitle('');
      setCreateDate('');
      setCreateErrors({});
      await fetchEvents();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Create failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setCreating(false);
    }
  }, [createTitle, createDate, createCategory, createPriority, workspaceId, fetchEvents, toast]);

  const handleApprove = useCallback(
    async (e: Event, decision: 'approve' | 'reject') => {
      const approvalId = getApprovalId(e);
      // F-03: without a real approval record there is nothing to approve —
      // the previous local-only status flip diverged UI state from the
      // backend. The action is refused with an explanation instead.
      if (!approvalId) {
        toast({
          tone: 'info',
          title: 'No approval record',
          detail:
            'This proposed event has no approval record yet. Ask the agent to create one (e.g. via chat) to enable a real approval decision.',
        });
        return;
      }
      setBusyApprove(e.id);
      try {
        if (decision === 'approve') await approvalApi.approve(approvalId);
        else await approvalApi.reject(approvalId);
        toast({
          tone: 'success',
          title: decision === 'approve' ? 'Approved' : 'Rejected',
          detail: String((e.payload as Record<string, unknown>)?.['title'] ?? e.type),
        });
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === e.id
              ? {
                  ...ev,
                  status:
                    decision === 'approve'
                      ? ('completed' as Event['status'])
                      : ('failed' as Event['status']),
                }
              : ev,
          ),
        );
      } catch (err) {
        toast({
          tone: 'error',
          title: decision === 'approve' ? 'Approve failed' : 'Reject failed',
          detail: err instanceof Error ? err.message : 'Please try again.',
        });
      } finally {
        setBusyApprove(null);
      }
    },
    [toast],
  );

  // Calendar helpers
  const calDays = useMemo(() => {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ date: Date | null; events: Event[] }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ date: null, events: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const dayEvents = filtered.filter((e) => {
        const ed = getEventDate(e);
        if (!ed) return false;
        const dd = new Date(ed);
        return dd.getFullYear() === y && dd.getMonth() === m && dd.getDate() === d;
      });
      cells.push({ date, events: dayEvents });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, events: [] });
    return cells;
  }, [calMonth, filtered]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Schedule</h1>
          <p className="text-text-muted">Calendar, deadlines and proposed events.</p>
        </header>
        <LoadingSpinner text="Loading schedule..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Schedule</h1>
          <p className="text-text-muted">Calendar, deadlines and proposed events.</p>
        </header>
        <ErrorState title="Failed to load schedule" message={error} onRetry={fetchEvents} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-1">Schedule</h1>
          <p className="text-text-muted text-sm">
            Workspace-scoped · calendar + list · Gmail vs agent vs you · proposed events need
            approval
          </p>
          <p className="text-xs text-text-dim font-mono">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-action px-4 py-2 text-sm text-action-fg"
        >
          New event
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-full border border-border p-1">
          <button
            onClick={() => setView('list')}
            className={`rounded-full px-3 py-1 text-xs ${view === 'list' ? 'bg-action text-action-fg' : 'text-text-muted'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`rounded-full px-3 py-1 text-xs ${view === 'calendar' ? 'bg-action text-action-fg' : 'text-text-muted'}`}
          >
            Calendar
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or type…"
          aria-label="Search events by title or type"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary w-48"
        />
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          aria-label="Filter events by source"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="all">All sources</option>
          <option value="you">You</option>
          <option value="gmail">Gmail</option>
          <option value="agent">Agent</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="Filter events by category"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm"
        >
          <option value="all">All categories</option>
          <option value="user">user</option>
          <option value="agent">agent</option>
          <option value="memory">memory</option>
          <option value="integration">integration</option>
          <option value="system">system</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No events match"
          description="Adjust filters, create an event, or sync Gmail to extract deadlines."
        />
      ) : view === 'calendar' ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-text">
              {calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                }
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                Prev
              </button>
              <button
                onClick={() => setCalMonth(new Date())}
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                Today
              </button>
              <button
                onClick={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                }
                className="rounded-full border border-border px-3 py-1 text-xs"
              >
                Next
              </button>
            </div>
          </div>
          {/* F-24: the 7-column month grid is intentionally wider than small
              viewports — it scrolls inside this controlled container instead
              of overflowing the page. The list view is the default on mobile. */}
          <div className="overflow-x-auto -mx-2 px-2 pb-1">
            <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-border bg-border min-w-[640px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="bg-surface-hover p-2 text-center font-mono text-xs uppercase text-text-dim"
                >
                  {d}
                </div>
              ))}
              {calDays.map((cell, i) => (
                <div
                  key={i}
                  className={`min-h-[84px] bg-surface p-1 ${!cell.date ? 'bg-surface-hover/50' : ''} ${cell.date && cell.events.some((e) => conflicts.has(e.id)) ? 'bg-warning/10' : ''}`}
                >
                  {cell.date && (
                    <>
                      <p className="text-xs font-mono text-text-dim">{cell.date.getDate()}</p>
                      <div className="mt-1 space-y-1">
                        {cell.events.slice(0, 3).map((e) => {
                          const title = String(
                            (e.payload as Record<string, unknown>)?.['title'] ?? e.type,
                          );
                          const badge = getSourceBadge(e);
                          const proposed = isProposed(e);
                          return (
                            <button
                              key={e.id}
                              onClick={() => setSelected(e)}
                              className={`w-full truncate rounded px-1 py-0.5 text-left text-xs border ${proposed ? 'border-warning/30 bg-warning/10 text-warning' : 'border-border bg-background text-text'} ${badge.label === 'Gmail' ? 'border-l-2 border-l-red-500' : ''} ${conflicts.has(e.id) ? 'ring-1 ring-amber-500/30' : ''}`}
                            >
                              {title.slice(0, 16)}
                              {conflicts.has(e.id) && ' âš '}
                              {Boolean(
                                (e.payload as Record<string, unknown>)?.['recurrence'] ||
                                (e.payload as Record<string, unknown>)?.['rrule'],
                              ) && ' 🔍”'}
                            </button>
                          );
                        })}
                        {cell.events.length > 3 && (
                          <p className="text-[10px] text-text-dim">
                            +{cell.events.length - 3} more
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="space-y-3">
            {filtered.map((event) => {
              const title = String(
                (event.payload as Record<string, unknown>)?.['title'] ?? event.type,
              );
              const desc = String(
                (event.payload as Record<string, unknown>)?.['description'] ?? '',
              );
              const deadline = (event.payload as Record<string, unknown>)?.['deadline'] as
                string | undefined;
              const badge = getSourceBadge(event);
              const proposed = isProposed(event);
              const urgency = deadline ? formatDeadline(deadline) : null;
              return (
                <div
                  key={event.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 ${proposed ? 'border-warning/30 bg-warning/10' : 'border-border bg-background'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-mono ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-mono text-text-muted">
                      {event.category}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${event.status === 'completed' ? 'border-success/30 text-success bg-success/10' : event.status === 'failed' ? 'border-error/30 text-error bg-error/10' : 'border-border text-text-muted bg-surface'}`}
                    >
                      {event.status.toUpperCase()}
                    </span>
                    {event.priority && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${event.priority === 'critical' ? 'border-error/30 text-error bg-error/10' : event.priority === 'high' ? 'border-warning/30 text-warning bg-warning/10' : 'border-border text-text-dim bg-surface'}`}
                      >
                        {event.priority}
                      </span>
                    )}
                    {conflicts.has(event.id) && (
                      <span className="rounded-full bg-warning/10 border border-warning/30 px-2 py-0.5 text-xs text-warning">
                        âš  Conflict
                      </span>
                    )}
                    {Boolean(
                      (event.payload as Record<string, unknown>)?.['recurrence'] ||
                      (event.payload as Record<string, unknown>)?.['rrule'],
                    ) && (
                      <span
                        className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs text-info"
                        title="Recurring event"
                      >
                        🔍”
                      </span>
                    )}
                    {urgency && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-mono ${urgency === 'Overdue' ? 'bg-error text-white' : urgency === 'Today' ? 'bg-warning text-white' : 'bg-surface-hover text-text-muted border border-border'}`}
                      >
                        {urgency}
                      </span>
                    )}
                    <span className="ml-auto text-xs font-mono text-text-dim">
                      {formatRelative(event.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-text truncate">{title}</h3>
                      {desc && <p className="text-sm text-text-muted line-clamp-2">{desc}</p>}
                      {deadline && (
                        <p className="text-xs text-text-dim mt-1">
                          Deadline: {new Date(deadline).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelected(event)}
                      className="shrink-0 rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-hover"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => toggleReminder(event.id)}
                      aria-label="Toggle reminder"
                      className={`shrink-0 rounded-full border px-2 py-1 text-xs hover:bg-surface-hover ${reminders[event.id] ? 'border-warning/30 text-warning' : 'border-border text-text-muted'}`}
                    >
                      {reminders[event.id] ? '🔍””' : '🔍”•'}
                    </button>
                  </div>
                  {proposed && (
                    <div className="flex gap-2">
                      <button
                        disabled={busyApprove === event.id}
                        onClick={() => handleApprove(event, 'approve')}
                        className="flex-1 rounded-full bg-action text-action-fg text-xs py-1.5 disabled:opacity-40 hover:bg-action-hover"
                      >
                        {busyApprove === event.id ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        disabled={busyApprove === event.id}
                        onClick={() => handleApprove(event, 'reject')}
                        className="flex-1 rounded-full border border-border text-xs py-1.5 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? String((selected.payload as Record<string, unknown>)?.['title'] ?? selected.type)
            : 'Event'
        }
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${getSourceBadge(selected).cls}`}
              >
                {getSourceBadge(selected).label}
              </span>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-mono">
                {selected.category} · {selected.type}
              </span>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs">
                {selected.status}
              </span>
            </div>
            <div className="rounded bg-surface-hover border border-border p-3 font-mono text-xs overflow-auto">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-text-dim">
              <div>Created: {new Date(selected.createdAt).toLocaleString()}</div>
              <div>Priority: {selected.priority}</div>
              <div>Source: {selected.source}</div>
              <div>Tenant: {selected.tenantId.slice(0, 8)}</div>
            </div>
            {isProposed(selected) && (
              <div className="flex gap-2 pt-2">
                <button
                  disabled={busyApprove === selected.id}
                  onClick={() => handleApprove(selected, 'approve')}
                  className="flex-1 rounded-full bg-success text-white text-xs py-2 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  disabled={busyApprove === selected.id}
                  onClick={() => handleApprove(selected, 'reject')}
                  className="flex-1 rounded-full border border-border text-xs py-2 disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New event">
        <div className="space-y-3">
          <label className="block text-sm" htmlFor="ev-title">
            Title
            <input
              id="ev-title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              aria-invalid={createErrors.title ? true : undefined}
              aria-describedby={createErrors.title ? 'ev-title-error' : undefined}
              className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${createErrors.title ? 'border-error' : 'border-border'}`}
              placeholder="Interview with Acme"
            />
            {createErrors.title && (
              <span id="ev-title-error" role="alert" className="mt-1 block text-xs text-error">
                {createErrors.title}
              </span>
            )}
          </label>
          <label className="block text-sm" htmlFor="ev-date">
            Date & time
            <input
              id="ev-date"
              type="datetime-local"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              aria-invalid={createErrors.date ? true : undefined}
              aria-describedby={createErrors.date ? 'ev-date-error' : undefined}
              className={`mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${createErrors.date ? 'border-error' : 'border-border'}`}
            />
            {createErrors.date && (
              <span id="ev-date-error" role="alert" className="mt-1 block text-xs text-error">
                {createErrors.date}
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Category
              <select
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="user">user</option>
                <option value="agent">agent</option>
                <option value="memory">memory</option>
                <option value="integration">integration</option>
                <option value="system">system</option>
              </select>
            </label>
            <label className="block text-sm">
              Priority
              <select
                value={createPriority}
                onChange={(e) => setCreatePriority(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-full border border-border px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="rounded-full bg-action px-4 py-1.5 text-sm text-action-fg disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <p className="text-xs text-text-dim mt-3">
        Workspace filter is server-side (`GET /events?workspace_id=` + RLS `workspace_id` index) —
        migrated 2026-08-21; Gmail-extracted events are read via Gmail connector, agent-proposed
        events via the scheduler/gmail agents.
      </p>
    </div>
  );
}
