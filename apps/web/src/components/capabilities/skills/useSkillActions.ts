'use client';

import { useCallback, useState } from 'react';
import { capabilitiesApi } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import type { SkillRow, SkillSaveOutcome } from './SkillCard';
import { errorMessage, isConflict, isNotFound } from './skill-row-helpers';

export interface UseSkillActionsOptions {
  /**
   * Resolve the row for a key at call time. A stored row can go stale while
   * SWR revalidates, so callers read it through this instead of passing one.
   */
  resolveRow: (key: string) => SkillRow | undefined;
  /** Revalidate the skills list after a write. */
  mutateSkills: () => unknown;
  /** Runs after a successful delete so the caller can clear selection or navigate. */
  onDeleted?: () => void;
}

export interface SkillActions {
  /** Key of the skill with an in-flight toggle or install, if any. */
  pendingKey: string | null;
  toggleEnabled: (key: string, next: boolean) => Promise<void>;
  install: (key: string) => Promise<void>;
  saveDoc: (key: string, doc: string) => Promise<SkillSaveOutcome>;
  deleteSkill: (key: string) => Promise<void>;
  copyDoc: (key: string) => void;
}

/**
 * The write actions shared by the skills workbench pane and the skill subpage.
 *
 * The two surfaces previously carried near-duplicate handlers that had drifted
 * (the subpage skipped pending state and swallowed the 409/404 delete answers),
 * so these bodies are the workbench's canonical versions.
 */
export function useSkillActions({
  resolveRow,
  mutateSkills,
  onDeleted,
}: UseSkillActionsOptions): SkillActions {
  const { toast } = useToast();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const toggleEnabled = useCallback(
    async (key: string, next: boolean) => {
      const row = resolveRow(key);
      if (!row) return;
      const name = row.item.name;

      if (!row.serverBacked || row.item.id === null) {
        toast({
          tone: 'warning',
          title: `Cannot ${next ? 'enable' : 'disable'} ${name}`,
          detail:
            'This skill has no workspace capability row, so nothing was written to the server.',
        });
        return;
      }

      setPendingKey(key);
      try {
        await capabilitiesApi.update(row.item.id, { enabled: next });
        void mutateSkills();
        toast({
          tone: next ? 'success' : 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${name}`,
          detail: 'Saved to the workspace capability row.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not ${next ? 'enable' : 'disable'} ${name}`,
          detail: errorMessage(err, 'The workspace was not changed.'),
        });
      } finally {
        setPendingKey(null);
      }
    },
    [resolveRow, mutateSkills, toast],
  );

  const install = useCallback(
    async (key: string) => {
      const row = resolveRow(key);
      if (!row || row.installed) return;

      setPendingKey(key);
      try {
        const created = await capabilitiesApi.create({
          name: row.item.name,
          // `skills` is a UI-only plural; the backend VALID_CATEGORIES entry
          // is the singular `skill`.
          category: 'skill',
          description: row.item.description,
          version: row.item.version ?? '1.0.0',
          author: row.item.author ?? 'Catalog',
          type: row.item.source,
          // `markdown_doc` is the key the runtime reads (`skill_injection.py`
          // build_skill_directive) and the only one `GET /capabilities` returns.
          // Writing `doc` here leaves the skill inert: it is never injected.
          config: {
            markdown_doc: row.item.markdownDoc,
            tags: row.item.tags,
            autonomy: row.item.autonomy,
            ...(row.item.requiredScope ? { required_scope: row.item.requiredScope } : {}),
          },
        });
        void mutateSkills();
        toast({
          tone: 'success',
          title: `Installed ${row.item.name}`,
          detail: `Registered in this workspace as ${created.id}.`,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not install ${row.item.name}`,
          detail: errorMessage(err, 'The workspace was not changed.'),
        });
      } finally {
        setPendingKey(null);
      }
    },
    [resolveRow, mutateSkills, toast],
  );

  const saveDoc = useCallback(
    async (key: string, doc: string): Promise<SkillSaveOutcome> => {
      const row = resolveRow(key);
      if (!row) return 'failed';

      if (!row.serverBacked || row.item.id === null) {
        toast({
          tone: 'error',
          title: `Could not save instructions for ${row.item.name}`,
          detail:
            'This skill has no workspace capability row, so it was not persisted to the workspace.',
        });
        return 'failed';
      }

      try {
        await capabilitiesApi.update(row.item.id, { config: { markdown_doc: doc } });
        void mutateSkills();
        toast({
          tone: 'success',
          title: `Saved instructions for ${row.item.name}`,
          detail: 'Written to the workspace capability row.',
        });
        return 'server';
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not save ${row.item.name}`,
          detail: errorMessage(err, 'The workspace was not changed.'),
        });
        return 'failed';
      }
    },
    [resolveRow, mutateSkills, toast],
  );

  const deleteSkill = useCallback(
    async (key: string) => {
      const row = resolveRow(key);
      if (!row || row.item.id === null) {
        toast({
          tone: 'info',
          title: 'Removed from this browser',
          detail: 'The skill had no workspace capability row to delete.',
        });
        return;
      }

      try {
        await capabilitiesApi.delete(row.item.id);
      } catch (err) {
        if (isConflict(err)) {
          toast({
            tone: 'error',
            title: 'Bundled skills cannot be deleted',
            detail:
              'The server answers 409 for any capability that is not custom. Disable it instead if you want it out of an agent run.',
          });
          return;
        }
        if (!isNotFound(err)) {
          toast({
            tone: 'error',
            title: 'Delete failed',
            detail: errorMessage(err, 'The capability was not deleted.'),
          });
          return;
        }
      }

      onDeleted?.();
      void mutateSkills();
      toast({
        tone: 'info',
        title: 'Skill deleted',
        detail: 'Removed from this workspace.',
      });
    },
    [resolveRow, mutateSkills, onDeleted, toast],
  );

  const copyDoc = useCallback(
    (key: string) => {
      const row = resolveRow(key);
      if (!row) return;
      const text = row.item.markdownDoc;
      if (!text) {
        toast({
          tone: 'warning',
          title: `Nothing to copy for ${row.item.name}`,
          detail: 'The server sent no markdown for this skill.',
        });
        return;
      }
      const clipboard = navigator.clipboard;
      if (!clipboard?.writeText) {
        toast({
          tone: 'error',
          title: 'Clipboard unavailable',
          detail: 'This browser blocked clipboard access.',
        });
        return;
      }
      clipboard
        .writeText(text)
        .then(() =>
          toast({
            tone: 'info',
            title: `Copied instructions for ${row.item.name}`,
          }),
        )
        .catch(() =>
          toast({
            tone: 'error',
            title: 'Copy failed',
            detail: 'The browser refused clipboard access.',
          }),
        );
    },
    [resolveRow, toast],
  );

  return { pendingKey, toggleEnabled, install, saveDoc, deleteSkill, copyDoc };
}
