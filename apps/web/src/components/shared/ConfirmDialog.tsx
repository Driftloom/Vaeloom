'use client';

/**
 * Canonical confirmation dialog (Phase 02A / F-12).
 *
 * Built on the ui-kit Modal so every confirmation inherits the audited
 * focus trap, focus restoration, Escape handling, portal rendering,
 * aria-modal and body scroll-lock. The previous hand-rolled implementation
 * had no trap, no aria-modal and a dangerous Enter-on-container confirm.
 */

import React from 'react';
import { Modal } from '@vaeloom/ui-kit';
import { Button } from '@vaeloom/ui-kit';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders the destructive error-styled action. */
  variant?: 'danger' | 'warning' | 'default';
  /** Disables the confirm action while the mutation is in flight. */
  loading?: boolean;
}

const confirmVariants = {
  danger: 'danger',
  warning: 'secondary',
  default: 'primary',
} as const;

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title} size="sm">
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-text-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariants[variant]}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
