'use client';

import React, { useCallback, useMemo, useState } from 'react';

// --- Selection Hook ---
export function useBatchSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds],
  );

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  return {
    selectedIds,
    selectedItems,
    isAllSelected,
    count: selectedIds.size,
    toggle,
    selectAll,
    clearSelection,
  };
}

// --- Batch Action Bar ---
interface BatchActionBarProps {
  count: number;
  onDelete?: () => void;
  onUpdate?: () => void;
  onClear: () => void;
  actions?: { label: string; onClick: () => void; variant?: 'primary' | 'danger' }[];
}

export function BatchActionBar({
  count,
  onDelete,
  onUpdate,
  onClear,
  actions,
}: BatchActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface border border-border rounded-lg shadow-xl px-5 py-3">
      <span className="text-sm text-text font-mono">{count} selected</span>
      <div className="h-5 w-px bg-border" />
      {onDelete && (
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-xs font-mono bg-red-900/30 text-red-400 border border-red-800/50 rounded-md hover:bg-red-900/50 transition-colors"
        >
          Delete
        </button>
      )}
      {onUpdate && (
        <button
          onClick={onUpdate}
          className="px-3 py-1.5 text-xs font-mono bg-primary/20 text-primary border border-primary/30 rounded-md hover:bg-primary/30 transition-colors"
        >
          Update
        </button>
      )}
      {actions?.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
            a.variant === 'danger'
              ? 'bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50'
              : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
          }`}
        >
          {a.label}
        </button>
      ))}
      <div className="h-5 w-px bg-border" />
      <button
        onClick={onClear}
        className="px-3 py-1.5 text-xs font-mono text-text-muted hover:text-text transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

// --- Confirm Dialog ---
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-display font-semibold text-text mb-2">{title}</h3>
        <p className="text-sm text-text-muted mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-mono text-text-muted hover:text-text border border-border rounded-md transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-mono text-white rounded-md transition-colors ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary hover:bg-action-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Batch Action Hooks ---
export function useBatchDelete(apiDelete: (ids: string[]) => Promise<void>) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const confirm = useCallback((ids: string[]) => {
    setPendingIds(ids);
    setConfirmOpen(true);
  }, []);

  const execute = useCallback(async () => {
    try {
      await apiDelete(pendingIds);
    } finally {
      setConfirmOpen(false);
      setPendingIds([]);
    }
  }, [apiDelete, pendingIds]);

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        open={confirmOpen}
        title="Delete items"
        message={`Are you sure you want to delete ${pendingIds.length} item(s)? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={execute}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingIds([]);
        }}
      />
    ),
  };
}

export function useBatchUpdate(
  apiUpdate: (ids: string[], updates: Record<string, unknown>) => Promise<void>,
) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const confirm = useCallback((ids: string[]) => {
    setPendingIds(ids);
    setConfirmOpen(true);
  }, []);

  const execute = useCallback(async () => {
    try {
      await apiUpdate(pendingIds, {});
    } finally {
      setConfirmOpen(false);
      setPendingIds([]);
    }
  }, [apiUpdate, pendingIds]);

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        open={confirmOpen}
        title="Update items"
        message={`Are you sure you want to update ${pendingIds.length} item(s)?`}
        confirmLabel="Update"
        variant="default"
        onConfirm={execute}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingIds([]);
        }}
      />
    ),
  };
}
