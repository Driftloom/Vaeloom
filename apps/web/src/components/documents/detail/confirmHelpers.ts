import type { ScanState } from '@/lib/document-format';

export type ConfirmAction =
  | { kind: 'restore-version'; versionNumber: number }
  | { kind: 'archive-document' }
  | { kind: 'delete-document' }
  | { kind: 'undo-action'; actionId: string };

export interface ConfirmMeta {
  title: string;
  message: string;
  label: string;
  isDanger: boolean;
}

export function getConfirmMeta(action: ConfirmAction | null, fileName: string): ConfirmMeta {
  if (!action) {
    return { title: '', message: '', label: '', isDanger: false };
  }
  switch (action.kind) {
    case 'restore-version':
      return {
        title: 'Restore Previous Revision',
        message: `Restoring revision ${action.versionNumber} will create a new current revision with that content.`,
        label: 'Restore Revision',
        isDanger: false,
      };
    case 'archive-document':
      return {
        title: 'Archive Document',
        message: `Are you sure you want to archive "${fileName}"? It can be restored later.`,
        label: 'Archive',
        isDanger: false,
      };
    case 'delete-document':
      return {
        title: 'Delete Document Permanently',
        message: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
        label: 'Delete Permanently',
        isDanger: true,
      };
    case 'undo-action':
      return {
        title: 'Undo Action',
        message:
          'Are you sure you want to undo this action? It will restore the previous file path.',
        label: 'Undo',
        isDanger: false,
      };
  }
}

export const SCAN_STATE_COPY: Record<
  ScanState,
  { label: string; variant: 'success' | 'error' | 'info' | 'default' }
> = {
  clean: { label: 'Upload checks passed', variant: 'success' },
  quarantined: { label: 'Upload blocked', variant: 'error' },
  scanning: { label: 'Upload checks running', variant: 'info' },
  unknown: { label: 'No upload-check result', variant: 'default' },
};

export const SCAN_STATE_DETAIL: Record<ScanState, string> = {
  clean:
    'Passed upload checks: no EICAR test signature, known malicious magic bytes, or disallowed file extensions detected.',
  quarantined:
    'Blocked by upload checks: signature, executable header, or disallowed extension match.',
  scanning: 'Upload checks in progress.',
  unknown: 'No upload-check record found for this file.',
};
