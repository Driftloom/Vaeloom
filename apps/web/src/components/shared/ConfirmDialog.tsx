'use client';

import React from 'react';
import { ConfirmationDialog, ConfirmationDialogProps } from '@vaeloom/ui-kit';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return <ConfirmationDialog {...props} />;
}
