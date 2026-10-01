/**
 * `transformKeys` is the whole app's snake_case -> camelCase contract, applied to
 * every response body and to nothing else. That asymmetry is what made its
 * blind spot a data-corruption bug rather than a naming inconsistency: a request
 * body is `JSON.stringify`-ed verbatim, so a value mangled on the way in goes
 * back out under its mangled name and the server stores a different contract
 * than the one it was given.
 *
 * These tests pin the split that fixes it -- API fields are transformed, opaque
 * data subtrees are not -- so a later "simplification" that walks the whole body
 * uniformly fails here rather than in a tool's argument parser.
 */

import { OPAQUE_DATA_KEYS, transformKeys } from '@/lib/api';

/** A realistic workspace tool schema: property names chosen by the author. */
const RESUME_SCHEMA = {
  type: 'object',
  properties: {
    resume_text: { type: 'string', description: 'The raw resume body' },
    max_results: { type: 'integer', minimum: 1 },
  },
  required: ['resume_text'],
} as const;

describe('transformKeys', () => {
  it('camelCases API fields at every depth, arrays included', () => {
    const transformed = transformKeys({
      workspace_id: 'ws-1',
      last_used_at: null,
      rows: [{ created_at: '2026-09-20T00:00:00Z', nested: { trust_class: 'core_trusted' } }],
    });

    expect(transformed).toEqual({
      workspaceId: 'ws-1',
      lastUsedAt: null,
      rows: [{ createdAt: '2026-09-20T00:00:00Z', nested: { trustClass: 'core_trusted' } }],
    });
  });

  it('preserves JSON Schema property names under config.parameters', () => {
    const transformed = transformKeys<{ workspaceId: string; config: { parameters: unknown } }>({
      workspace_id: 'ws-1',
      config: { parameters: RESUME_SCHEMA, markdown_doc: '# Tool', required_scope: 'tool.x' },
    });

    // The API fields around the schema are still transformed.
    expect(transformed.workspaceId).toBe('ws-1');
    expect(transformed.config.parameters).toEqual(RESUME_SCHEMA);

    const properties = (transformed.config.parameters as { properties: Record<string, unknown> })
      .properties;
    expect(Object.keys(properties)).toEqual(['resume_text', 'max_results']);
    expect(properties['resume_text']).toEqual({
      type: 'string',
      description: 'The raw resume body',
    });
    expect(properties['max_results']).toEqual({ type: 'integer', minimum: 1 });
  });

  it('round-trips a capability row through a response without mangling the schema', () => {
    // What the server sends.
    const wire = {
      id: 'cap-1',
      workspace_id: 'ws-1',
      name: 'resume-search',
      config: {
        parameters: RESUME_SCHEMA,
        returns: { type: 'object', properties: { match_score: { type: 'number' } } },
        markdown_doc: '# Resume search',
        required_scope: 'tool.resume-search',
        autonomy: 'autonomous',
      },
    };

    const transformed = transformKeys<{
      id: string;
      workspaceId: string;
      config: { parameters: Record<string, unknown>; returns: Record<string, unknown> };
    }>(wire);

    // Re-serialising for a PATCH body is what a caller does, and it must produce
    // the same schema the server sent. Byte-identical is the contract.
    expect(JSON.stringify(transformed.config.parameters)).toBe(JSON.stringify(RESUME_SCHEMA));
    expect(JSON.stringify(transformed.config.returns)).toBe(JSON.stringify(wire.config.returns));

    // And the API-level fields are still usable by their camelCase names.
    expect(transformed.workspaceId).toBe('ws-1');
  });

  it('preserves an MCP tool input_schema served straight from the MCP server', () => {
    const transformed = transformKeys<{
      inputSchema: Record<string, unknown>;
      readOnlyHint: boolean;
    }>({
      name: 'search_public_ats_jobs',
      input_schema: {
        type: 'object',
        properties: {
          board_url: { type: 'string' },
          posted_within_days: { type: 'integer' },
        },
      },
      read_only_hint: true,
    });

    expect(Object.keys((transformed.inputSchema as { properties: object }).properties)).toEqual([
      'board_url',
      'posted_within_days',
    ]);
    expect(transformed.readOnlyHint).toBe(true);
  });

  it('is idempotent on an opaque subtree, so a second pass cannot re-enter it', () => {
    const once = transformKeys({ config: { parameters: RESUME_SCHEMA } });
    const twice = transformKeys(once);

    expect(twice).toEqual(once);
    expect(
      Object.keys(
        (twice as { config: { parameters: { properties: object } } }).config.parameters.properties,
      ),
    ).toEqual(['resume_text', 'max_results']);
  });

  it('still transforms a sibling of an opaque subtree at the same level', () => {
    const transformed = transformKeys<{
      config: { parameters: unknown; usage_count: number; last_used_at: string | null };
    }>({
      config: {
        parameters: RESUME_SCHEMA,
        usage_count: 4,
        last_used_at: '2026-09-20T00:00:00Z',
      },
    });

    expect(transformed.config.usage_count).toBeUndefined();
    expect((transformed.config as Record<string, unknown>)['usageCount']).toBe(4);
    expect((transformed.config as Record<string, unknown>)['lastUsedAt']).toBe(
      '2026-09-20T00:00:00Z',
    );
    expect(transformed.config.parameters).toEqual(RESUME_SCHEMA);
  });

  it('passes primitives, null and undefined through untouched', () => {
    expect(transformKeys(null)).toBeNull();
    expect(transformKeys(undefined)).toBeUndefined();
    expect(transformKeys('already_camel')).toBe('already_camel');
    expect(transformKeys(7)).toBe(7);
    expect(transformKeys(true)).toBe(true);
  });

  it('lets a caller opt out of the opaque-key list when it needs a whole-body walk', () => {
    // The escape hatch exists so the rule is not the only option available.
    const transformed = transformKeys<{ config: { parameters: { properties: object } } }>(
      { config: { parameters: RESUME_SCHEMA } },
      new Set<string>(),
    );

    expect(
      Object.keys((transformed.config.parameters as { properties: object }).properties),
    ).toEqual(['resumeText', 'maxResults']);
  });

  it('names exactly the schema fields the backend reads back', () => {
    // A change here is a behaviour change for every endpoint, so it is asserted
    // rather than implied: these are `config.parameters` / `config.returns` on a
    // capability row and `input_schema` / `output_schema` on a tool definition.
    expect([...OPAQUE_DATA_KEYS].sort()).toEqual([
      'inputSchema',
      'input_schema',
      'outputSchema',
      'output_schema',
      'parameters',
      'returns',
    ]);
  });
});
