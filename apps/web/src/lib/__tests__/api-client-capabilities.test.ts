/**
 * The capability and connector client types are the only place the web app
 * describes what the backend actually returns. A type that is wider than the
 * wire compiles fine and hands the caller a value it cannot observe; a type that
 * is narrower is a lie the caller believes until it ships.
 *
 * Each `Status:` below is checked by `tsc`, not by Jest: assigning it is the
 * assertion, so a status the backend can emit and the union cannot name is a
 * build failure rather than a runtime surprise.
 */

import { transformKeys } from '@/lib/api';
import type {
  McpToolCallResult,
  TestCapabilityByIdResponse,
  TestCapabilityStatus,
} from '@/lib/api-client';

/**
 * Every `status` `POST /capabilities/{id}/test` can return, read off the handler:
 * the `tool` branch (`not_registered`, `error`, `success`), the `mcp` branch
 * forwarding `probe_mcp_endpoint` (`skipped`, `connected`, `timeout`, `error`),
 * and the validation-only branch for every other category (`success`).
 */
const TEST_STATUSES = {
  toolRegistered: 'success',
  toolUnregistered: 'not_registered',
  toolFailed: 'error',
  mcpConnected: 'connected',
  mcpNothingConfigured: 'skipped',
  mcpTimedOut: 'timeout',
  mcpFailed: 'error',
} satisfies Record<string, TestCapabilityStatus>;

/**
 * `warning` belonged to `POST /agents/capabilities/test`, which validates and
 * never dispatches. This endpoint never emits it, so it must not be nameable.
 */
type ForbiddenStatus = Extract<TestCapabilityStatus, 'warning'>;
const _warningIsNotAStatus: ForbiddenStatus extends never ? true : never = true;
void _warningIsNotAStatus;

describe('capabilities client contract', () => {
  it('names every status the test handler can return', () => {
    expect(Object.values(TEST_STATUSES).sort()).toEqual([
      'connected',
      'error',
      'error',
      'not_registered',
      'skipped',
      'success',
      'timeout',
    ]);
  });

  it('keeps `executed` as the only signal that anything actually ran', () => {
    // `connected` and `success` are both real results; only one of them ran a
    // tool. The handler sets `executed` from the probe status, so the field is
    // what a caller has to branch on, not the status vocabulary.
    const ran: TestCapabilityByIdResponse = {
      status: 'connected',
      latencyMs: 12.5,
      output: { toolsCount: 3 },
      error: null,
      executed: true,
    };
    const validatedOnly: TestCapabilityByIdResponse = {
      status: 'skipped',
      latencyMs: 0.2,
      output: { detail: 'No MCP endpoint configured; nothing was contacted.' },
      error: null,
      executed: false,
    };

    expect(ran.executed).toBe(true);
    expect(validatedOnly.executed).toBe(false);
  });

  it('delivers an MCP tool call in the camelCase shape the client type declares', () => {
    // What `mcp_client_service.call_tool` returns, then the response transform.
    // The envelope fields are API fields and are camelCased; `structured` is not
    // on OPAQUE_DATA_KEYS, so its own keys are transformed too -- asserted here so
    // the limitation is visible rather than discovered in a rendered payload.
    const result: McpToolCallResult = transformKeys({
      tool: 'search_public_ats_jobs',
      text: '{"hits": 3}',
      is_error: false,
      structured: { hit_count: 3 },
    });

    expect(result).toEqual({
      tool: 'search_public_ats_jobs',
      text: '{"hits": 3}',
      isError: false,
      structured: { hitCount: 3 },
    });
    expect(result.structuredTruncated).toBeUndefined();
  });

  it('surfaces the truncation flag so a half document is not parsed as a whole one', () => {
    // The service caps `structuredContent` and, when it has to truncate, keeps it
    // as a string with the flag set -- a different type under the same key.
    const result: McpToolCallResult = transformKeys({
      tool: 'query_sql',
      text: '…',
      is_error: false,
      structured: '{"rows":[{"id":1',
      structured_truncated: true,
    });

    expect(result.isError).toBe(false);
    expect(result.structuredTruncated).toBe(true);
    expect(typeof result.structured).toBe('string');
  });

  it('reports a tool-level MCP error as a 200 with isError, not as a transport failure', () => {
    const result: McpToolCallResult = transformKeys({
      tool: 'write_row',
      text: 'permission denied',
      is_error: true,
    });

    expect(result.isError).toBe(true);
  });
});
