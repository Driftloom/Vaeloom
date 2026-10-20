import type { CapabilityItem, CapabilityAutonomy } from '@/lib/capabilities-data';
import {
  capabilityConfigMarkdownDoc,
  capabilityConfigTags,
  type SkillListItem,
} from '@/lib/api-client';
import type { SkillRow } from './SkillCard';

export const VALID_SOURCES = new Set<CapabilityItem['source']>([
  'built-in',
  'learned',
  'custom',
  'mcp',
  'community',
]);

export function toSource(raw: string | null | undefined): CapabilityItem['source'] {
  return typeof raw === 'string' && VALID_SOURCES.has(raw as CapabilityItem['source'])
    ? (raw as CapabilityItem['source'])
    : 'custom';
}

export const VALID_AUTONOMY = new Set<string>(['suggest', 'autonomous', 'approval_required']);

export const VALID_TRUST_CLASSES = new Set<string>([
  'core_trusted',
  'first_party',
  'community',
  'mcp.read',
  'mcp.workspace.write',
  'mcp.external.write',
  'untrusted',
]);

export function toAutonomy(raw: string | null | undefined): CapabilityAutonomy | undefined {
  return typeof raw === 'string' && VALID_AUTONOMY.has(raw)
    ? (raw as CapabilityAutonomy)
    : undefined;
}

export function readTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '');
}

export function isNotFound(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 404;
}

export function isConflict(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 409;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function isSeedSkill(item: CapabilityItem): boolean {
  return item.source === 'built-in' || item.source === 'learned';
}

export function isSkill(item: CapabilityItem): boolean {
  return item.category === 'skills';
}

export function mapSkillRow(server: SkillListItem): SkillRow {
  const installed = server.installed === true;
  const config = server.config as Record<string, unknown> | undefined;
  const slug = server.slug ?? (typeof server.name === 'string' ? server.name : null);
  const parameters = config?.['parameters'];

  const item: CapabilityItem = {
    id: server.id ?? `catalog:${slug ?? server.name}`,
    name: server.name,
    category: 'skills',
    tags: readTags(server.tags).length
      ? readTags(server.tags)
      : capabilityConfigTags(server.config),
    description: server.description ?? '',
    enabled: installed ? server.enabled : false,
    source: toSource(server.type),
    usageCount: typeof server.usageCount === 'number' ? server.usageCount : 0,
    lastUsedAt: server.lastUsedAt ?? null,
    markdownDoc: server.markdownDoc ?? capabilityConfigMarkdownDoc(server.config) ?? '',
    triggers: Array.isArray(server.triggers) ? server.triggers : [],
    inputSchema:
      parameters && typeof parameters === 'object' && !Array.isArray(parameters)
        ? (parameters as Record<string, unknown>)
        : undefined,
  };

  if (server.requiredScope) item.requiredScope = server.requiredScope;
  if (server.trustClass && VALID_TRUST_CLASSES.has(server.trustClass)) {
    item.trustClass = server.trustClass as CapabilityItem['trustClass'];
  }
  const autonomy = toAutonomy(server.autonomy);
  if (autonomy) item.autonomy = autonomy;
  if (server.version) item.version = server.version;
  if (server.author) item.author = server.author;

  return {
    key: installed ? (server.id as string) : `catalog:${slug ?? server.name}`,
    item,
    installed,
    bundled: server.bundled === true,
    slug,
    serverBacked: installed && typeof server.id === 'string',
  };
}

export function mergeSkillRows(
  localRows: CapabilityItem[],
  serverRows: SkillListItem[],
): SkillRow[] {
  const byId = new Map<string, CapabilityItem>();
  const byName = new Map<string, CapabilityItem>();
  for (const row of localRows) {
    byId.set(row.id, row);
    byName.set(row.name, row);
  }

  const consumed = new Set<string>();
  const merged: SkillRow[] = serverRows.map((server) => {
    const local = (server.id !== null ? byId.get(server.id) : undefined) ?? byName.get(server.name);
    if (local) consumed.add(local.id);

    const row = mapSkillRow(server);
    if (!local) return row;

    const item = row.item;
    const localTriggers = local.triggers ?? [];
    if (item.markdownDoc === '' && local.markdownDoc) item.markdownDoc = local.markdownDoc;
    if (item.inputSchema === undefined && local.inputSchema) item.inputSchema = local.inputSchema;
    if ((item.triggers?.length ?? 0) === 0 && localTriggers.length > 0) {
      item.triggers = localTriggers;
    }
    row.item = item;
    return row;
  });

  for (const local of localRows) {
    if (consumed.has(local.id)) continue;
    merged.push({
      key: local.id,
      item: local,
      installed: false,
      bundled: isSeedSkill(local),
      slug: local.id.startsWith('skill-') ? local.id.slice('skill-'.length) : null,
      serverBacked: false,
    });
  }

  return merged;
}
