import { connectorsApi, type ConnectorItem } from '@/lib/api-client';

// ─── Manifest helpers ────────────────────────────────────────────────────────

/** Unsubstituted `${...}` template syntax. A real value never contains it. */
export const TEMPLATE_PLACEHOLDER = /\$\{[^}]*\}/;

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
}

export interface ManifestOmission {
  key: string;
  reason: string;
}

/**
 * First `${...}` occurrence in a value tree, as a dotted path.
 *
 * Persisting one of these writes a literal placeholder into the database and then
 * into every generated manifest, where it looks like a working credential to the
 * next reader and authenticates as nothing at all.
 */
export function findPlaceholder(value: unknown, path = 'value'): string | null {
  if (typeof value === 'string') return TEMPLATE_PLACEHOLDER.test(value) ? path : null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findPlaceholder(value[index], `${path}[${index}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const hit = findPlaceholder(nested, `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

export interface BuiltManifest {
  json: string;
  omissions: ManifestOmission[];
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Build an `mcpServers` manifest from the connectors this workspace really has.
 *
 * Every value here is copied from a stored row. A server with neither a command
 * nor a URL is omitted rather than given a substitute: the previous
 * `cfg['url'] || cfg['base_url'] || 'https://api.example.com/mcp'` wrote a
 * documentation URL into a real workspace manifest, and `command: 'npx'` silently
 * launched a different program than the operator registered.
 *
 * Credentials are never exported. A token lives in the connector row, not in a
 * file meant to be shared with Claude Desktop, so the header is left out and the
 * omission is reported.
 */
export function buildMcpServersManifest(servers: ConnectorItem[]): BuiltManifest {
  const mcpServers: Record<string, unknown> = {};
  const omissions: ManifestOmission[] = [];

  for (const server of servers) {
    const cfg = (server.config ?? {}) as Record<string, unknown>;
    const key = slugify(server.name);
    if (!key) continue;

    const command = nonEmptyString(cfg['command']);
    const url = nonEmptyString(cfg['url']) ?? nonEmptyString(cfg['base_url']);
    const entry: Record<string, unknown> = {};

    if (command) {
      entry['command'] = command;
      entry['args'] = Array.isArray(cfg['args']) ? cfg['args'] : [];
    } else if (url) {
      entry['url'] = url;
    } else {
      omissions.push({
        key,
        reason: 'no command or URL is configured, so there is nothing to point a client at',
      });
      continue;
    }

    if (cfg['auth_token'] !== undefined && cfg['auth_token'] !== null && cfg['auth_token'] !== '') {
      omissions.push({
        key,
        reason: 'it holds a stored token, which is not written to a shareable manifest',
      });
    }

    mcpServers[key] = entry;
  }

  return {
    json: JSON.stringify({ mcpServers }, null, 2),
    omissions,
  };
}

export interface ApplyManifestResult {
  kind: 'validation_error' | 'write_failure' | 'success';
  title: string;
  detail: string;
  createdCount: number;
  syncFailures: string[];
}

export async function applyMcpServersManifest(
  mcpConfigText: string,
  workspaceId: string,
  installedServers: ConnectorItem[],
  addLog: (level: 'info' | 'success' | 'warn' | 'error', message: string, server?: string) => void,
): Promise<ApplyManifestResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(mcpConfigText);
  } catch (err) {
    return {
      kind: 'validation_error',
      title: 'Syntax Error in mcp.json',
      detail: err instanceof Error ? err.message : 'Invalid JSON',
      createdCount: 0,
      syncFailures: [],
    };
  }

  if (parsed === null || typeof parsed !== 'object') {
    return {
      kind: 'validation_error',
      title: 'mcp.json is not an object',
      detail: 'The top level of the file must be a JSON object with an "mcpServers" key.',
      createdCount: 0,
      syncFailures: [],
    };
  }

  const rawServers = (parsed as Record<string, unknown>)['mcpServers'];
  if (rawServers === null || typeof rawServers !== 'object' || Array.isArray(rawServers)) {
    return {
      kind: 'validation_error',
      title: 'mcp.json has no mcpServers object',
      detail: 'Expected {"mcpServers": { "<name>": { ... } }}.',
      createdCount: 0,
      syncFailures: [],
    };
  }

  const entries = Object.entries(rawServers as Record<string, unknown>);
  if (entries.length === 0) {
    return {
      kind: 'validation_error',
      title: 'Empty Configuration',
      detail: 'No servers found under "mcpServers".',
      createdCount: 0,
      syncFailures: [],
    };
  }

  interface WriteOp {
    key: string;
    config: Record<string, unknown>;
    existingId: string | null;
  }

  const ops: WriteOp[] = [];
  for (const [key, value] of entries) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return {
        kind: 'validation_error',
        title: `mcp.json entry "${key}" is not an object`,
        detail: 'Each server must be a JSON object with "command"/"args" or "url".',
        createdCount: 0,
        syncFailures: [],
      };
    }

    const def = value as Record<string, unknown>;
    const placeholder = findPlaceholder(def, key);
    if (placeholder) {
      return {
        kind: 'validation_error',
        title: 'Unresolved ${...} placeholder',
        detail: `"${placeholder}" still contains a template placeholder. Substitute the real value before applying, or remove the field.`,
        createdCount: 0,
        syncFailures: [],
      };
    }

    const command = nonEmptyString(def['command']);
    const url = nonEmptyString(def['url']);
    if (!command && !url) {
      return {
        kind: 'validation_error',
        title: `mcp.json entry "${key}" has no endpoint`,
        detail:
          'Provide "command" (stdio) or "url" (streamable HTTP). No URL was invented for you.',
        createdCount: 0,
        syncFailures: [],
      };
    }

    const config: Record<string, unknown> = { transport: command ? 'stdio' : 'http' };
    if (command) {
      config['command'] = command;
      config['args'] = Array.isArray(def['args']) ? def['args'] : [];
    } else {
      config['url'] = url;
    }
    if (def['env'] !== undefined) config['env'] = def['env'];
    if (def['headers'] !== undefined) config['headers'] = def['headers'];

    const existing = installedServers.find(
      (server) => server.id === key || slugify(server.name) === slugify(key),
    );
    ops.push({ key, config, existingId: existing?.id ?? null });
  }

  const createdIds: string[] = [];
  const results = await Promise.allSettled(
    ops.map(async (op) => {
      if (op.existingId) {
        const updated = await connectorsApi.update(op.existingId, {
          name: op.key,
          config: op.config,
        });
        return { key: op.key, id: updated?.id ?? op.existingId, created: false };
      }
      const created = await connectorsApi.create({
        name: op.key,
        type: 'mcp',
        workspace_id: workspaceId,
        config: op.config,
      });
      createdIds.push(created.id);
      return { key: op.key, id: created.id, created: true };
    }),
  );

  const writeFailures: string[] = [];
  const succeeded: Array<{ key: string; id: string }> = [];
  results.forEach((result, index) => {
    const op = ops[index];
    if (!op) return;
    if (result.status === 'fulfilled') {
      succeeded.push({ key: result.value.key, id: result.value.id });
      return;
    }
    const reason = result.reason;
    writeFailures.push(
      `${op.key}: ${reason instanceof Error ? reason.message : 'the write was rejected'}`,
    );
  });

  if (writeFailures.length > 0) {
    let rolledBack = 0;
    await Promise.allSettled(createdIds.map((id) => connectorsApi.delete(id))).then((outcomes) => {
      rolledBack = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
    });

    addLog('error', `mcp.json not applied: ${writeFailures.length} write(s) failed.`);
    return {
      kind: 'write_failure',
      title: 'mcp.json was not applied',
      detail:
        `${writeFailures.length} of ${results.length} server(s) could not be written (${writeFailures[0]})` +
        (createdIds.length > 0
          ? ` ${rolledBack} newly created row(s) were rolled back.`
          : ' Nothing was created, so nothing was rolled back.'),
      createdCount: 0,
      syncFailures: [],
    };
  }

  const syncFailures: string[] = [];
  await Promise.allSettled(
    succeeded.map(async ({ key, id }) => {
      const res = await connectorsApi.mcp.sync(id, workspaceId);
      const bridged = res?.registered?.length ?? 0;
      addLog('success', `'${key}' written and ${bridged} tool(s) bridged.`, key);
    }),
  ).then((outcomes) => {
    outcomes.forEach((outcome, index) => {
      if (outcome.status !== 'rejected') return;
      const key = succeeded[index]?.key ?? 'server';
      const reason = outcome.reason;
      syncFailures.push(
        `${key}: ${reason instanceof Error ? reason.message : 'the bridge sync was rejected'}`,
      );
    });
  });

  const createdCount = succeeded.length;
  if (syncFailures.length > 0) {
    addLog(
      'warn',
      `mcp.json written for ${createdCount} server(s); ${syncFailures.length} bridge sync(s) failed.`,
    );
    return {
      kind: 'success',
      title: 'mcp.json written, bridges incomplete',
      detail: `${createdCount} server(s) saved. ${syncFailures.length} bridge sync(s) failed: ${syncFailures[0]}`,
      createdCount,
      syncFailures,
    };
  }

  addLog('success', `mcp.json applied: ${createdCount} server(s) written and bridged.`);
  return {
    kind: 'success',
    title: 'mcp.json Applied',
    detail: `${createdCount} MCP server(s) written and bridged in this workspace.`,
    createdCount,
    syncFailures: [],
  };
}
