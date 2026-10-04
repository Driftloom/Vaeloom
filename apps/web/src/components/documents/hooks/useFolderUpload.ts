'use client';

import { useCallback, useRef } from 'react';

import { documentApi } from '@/lib/api-client';

import type { Notify } from './useDocumentActions';

export interface UseFolderUploadParams {
  workspaceId: string;
  /** The folder an uploaded tree is nested under. `null` for the workspace root. */
  selectedFolderId: string | null;
  notify: Notify;
  onFoldersChanged: () => void;
  onDocumentsChanged: () => void;
}

export interface UseFolderUploadResult {
  /** Attach to the hidden `<input webkitdirectory>`. */
  inputRef: React.RefObject<HTMLInputElement>;
  /** Opens the directory picker. */
  open: () => void;
  /** Attach to that input's `onChange`. */
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Directory upload: recreate the chosen folder tree, then upload into it.
 *
 * WHY THIS IS ITS OWN HOOK
 *
 * It was 80 lines of the hub and the only handler with a three-level nested
 * closure inside it (`getOrCreatePath` walked the path segments while the outer
 * loop walked the files). None of that is hub state.
 *
 * The nested lookup is the interesting part: `createFolder` fails with a 400 when
 * the folder already exists, so a second upload of the same tree would otherwise
 * create a duplicate hierarchy. The failure is caught and re-resolved by listing
 * the target's children and matching the name case-insensitively, which is what
 * makes the operation idempotent.
 *
 * Per-file failures are counted, not thrown: one rejected file must not abandon
 * the rest of the directory, and the toast reports exactly how many landed.
 *
 * @param notify Toast callback; the count and tone depend on the outcome.
 */
export function useFolderUpload({
  workspaceId,
  selectedFolderId,
  notify,
  onFoldersChanged,
  onDocumentsChanged,
}: UseFolderUploadParams): UseFolderUploadResult {
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => inputRef.current?.click(), []);

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = Array.from(event.target.files ?? []);
      // Reset the input FIRST. Leaving the value in place means re-picking the
      // same directory fires no `change` event at all, so the second upload is
      // silently a no-op.
      if (inputRef.current) inputRef.current.value = '';
      if (fileList.length === 0 || !workspaceId) return;

      /** Accumulated path -> created folder id, so sibling files reuse it. */
      const createdPaths = new Map<string, string>();

      const resolveFolder = async (segments: string[]): Promise<string | null> => {
        let parent = selectedFolderId;
        let accumulated = parent ? `${parent}:` : '';
        for (const segment of segments) {
          const name = segment.trim();
          if (!name) continue;
          accumulated += `/${name}`;
          const known = createdPaths.get(accumulated);
          if (known) {
            parent = known;
            continue;
          }
          try {
            parent = (await documentApi.createFolder(workspaceId, name, parent)).id;
          } catch {
            // Already exists (409/400) — adopt it rather than duplicating.
            const siblings = await documentApi.listFolders(workspaceId, parent ?? undefined);
            parent =
              siblings.find((folder) => folder.name.toLowerCase() === name.toLowerCase())?.id ??
              parent;
          }
          if (parent) createdPaths.set(accumulated, parent);
        }
        return parent;
      };

      let uploaded = 0;
      for (const file of fileList) {
        // `webkitRelativePath` is the file's path relative to the picked
        // directory; the final segment is the file itself.
        const relative = file.webkitRelativePath || file.name;
        const segments = relative.split('/');
        segments.pop();
        try {
          const target = segments.length > 0 ? await resolveFolder(segments) : selectedFolderId;
          await documentApi.upload(file, workspaceId, target);
          uploaded += 1;
        } catch {
          // Counted, not thrown: see the note above.
        }
      }

      notify({
        tone: uploaded === fileList.length ? 'success' : 'warning',
        title: 'Folder Upload Complete',
        detail: `Uploaded ${uploaded} of ${fileList.length} file(s).`,
      });
      onFoldersChanged();
      onDocumentsChanged();
    },
    [workspaceId, selectedFolderId, notify, onFoldersChanged, onDocumentsChanged],
  );

  return { inputRef, open, handleChange };
}
