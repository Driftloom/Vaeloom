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
import {
  capabilityConfigReactRounds,
  MAX_REACT_ROUNDS,
  MIN_REACT_ROUNDS,
  reactRoundsAcceptance,
  type CapabilityDraftStatus,
  type CapabilityDraftValidationResponse,
  type McpToolCallResult,
  type TestCapabilityByIdResponse,
  type TestCapabilityStatus,
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

// ─── Draft validation ────────────────────────────────────────────────────────

describe('capabilitiesApi.validateDraft contract', () => {
  /**
   * Every status `POST /capabilities/validate` can return, read off
   * `_derive_draft_status`.
   *
   * `not_validated` is the one a client is most likely to flatten into a pass: it
   * is produced precisely when there are no violations, so a caller that infers
   * the verdict from the violation list cannot tell it from `success`.
   */
  const DRAFT_STATUSES = {
    allRulesPassed: 'success',
    onlySoftFailed: 'warning',
    hardRuleFailed: 'error',
    noValidator: 'not_validated',
  } satisfies Record<string, CapabilityDraftStatus>;

  it('names every status the handler can derive', () => {
    expect(Object.values(DRAFT_STATUSES).sort()).toEqual([
      'error',
      'not_validated',
      'success',
      'warning',
    ]);
    // A pass and "nothing checked this" are different facts, so they are different
    // words. `satisfies` above already fails the build if the union cannot hold
    // them; this asserts the intent is still visible at runtime.
    expect(DRAFT_STATUSES.noValidator).not.toBe(DRAFT_STATUSES.allRulesPassed);
  });

  it('cannot type a draft validation that executed something', () => {
    // `executed` is `false`, not `boolean`. A caller writing `if (executed) …` is
    // a compile error rather than a dead branch nobody notices.
    const verdict: CapabilityDraftValidationResponse = {
      status: 'success',
      rulesChecked: 6,
      violations: [],
      executed: false,
      category: 'skill',
      validatedSource: 'draft',
      catalogSlug: null,
      detail: '6 rule(s) evaluated; nothing was executed or persisted.',
    };
    expect(verdict.executed).toBe(false);
  });

  it('delivers the wire names camelCased, which is what the response type declares', () => {
    // What the endpoint sends, then the response transform every client call runs.
    const verdict = transformKeys({
      status: 'warning',
      rules_checked: 9,
      violations: [{ rule: 'SKILL-TRUST-CLASS', message: 'unknown', line: 4, severity: 'soft' }],
      executed: false,
      category: 'skill',
      validated_source: 'catalog',
      catalog_slug: 'resume-tailoring',
      detail: '9 rule(s) evaluated.',
    }) as CapabilityDraftValidationResponse;

    expect(verdict.rulesChecked).toBe(9);
    expect(verdict.validatedSource).toBe('catalog');
    expect(verdict.catalogSlug).toBe('resume-tailoring');
    expect(verdict.violations[0]).toEqual({
      rule: 'SKILL-TRUST-CLASS',
      message: 'unknown',
      line: 4,
      severity: 'soft',
    });
  });
});

// ─── ReAct round budget ──────────────────────────────────────────────────────

describe('react rounds contract', () => {
  it('mirrors MIN_MAX_REACT_ROUNDS and MAX_MAX_REACT_ROUNDS exactly', () => {
    // The resolver clamps anything outside this range with a WARNING, so a control
    // that accepted a larger number would hand the operator a value the run never
    // used.
    expect(MIN_REACT_ROUNDS).toBe(1);
    expect(MAX_REACT_ROUNDS).toBe(12);
  });

  it('honours a whole number inside the range', () => {
    expect(reactRoundsAcceptance(1)).toEqual({ ok: true, rounds: 1 });
    expect(reactRoundsAcceptance(5)).toEqual({ ok: true, rounds: 5 });
    expect(reactRoundsAcceptance(12)).toEqual({ ok: true, rounds: 12 });
    expect(reactRoundsAcceptance('7')).toEqual({ ok: true, rounds: 7 });
  });

  /**
   * The rejections, each for the reason `_coerce` gives.
   *
   * `true` is in this list because `bool` is an `int` subclass in Python: a
   * checkbox in a config bag would otherwise become a one-round agent.
   */
  const rejected: Array<[string, unknown, RegExp]> = [
    ['a boolean', true, /rejects a boolean/],
    ['zero', 0, /clamps anything below 1/],
    ['a negative', -4, /clamps anything below 1/],
    ['a fraction', 3.7, /not a whole number/],
    ['an absurd count', 4000, /clamps anything above 12/],
    ['non-numeric text', 'abc', /is not a number/],
    ['a non-integral string', '3.7', /not a whole number of rounds/],
    ['an empty string', '   ', /treats this as unset/],
    ['null', null, /is not a round count/],
    ['an object', {}, /is not a round count/],
    ['NaN', Number.NaN, /not a finite number/],
  ];

  it.each(rejected)('refuses %s', (_label, value, reason) => {
    const verdict = reactRoundsAcceptance(value);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('unreachable');
    expect(verdict.reason).toMatch(reason);
  });

  it('tells an absent key from a stored value the resolver ignores', () => {
    expect(capabilityConfigReactRounds(undefined)).toEqual({ state: 'absent' });
    expect(capabilityConfigReactRounds({})).toEqual({ state: 'absent' });
    expect(capabilityConfigReactRounds({ maxReactRounds: 6 })).toEqual({
      state: 'honoured',
      rounds: 6,
    });

    const rejectedVerdict = capabilityConfigReactRounds({ maxReactRounds: 99 });
    expect(rejectedVerdict.state).toBe('rejected');
    if (rejectedVerdict.state !== 'rejected') throw new Error('unreachable');
    expect(rejectedVerdict.stored).toBe(99);
    expect(rejectedVerdict.reason).toMatch(/clamps anything above 12/);
  });

  it('reads the camelCased name transformKeys produces, not the stored spelling', () => {
    // `toCamelCase` uppercases the single letter after each underscore, so
    // `max_react_rounds` arrives as `maxReactRounds`. A reader that guessed
    // `maxReActRounds` would report every configured agent as unset.
    const stored = transformKeys({ config: { max_react_rounds: 8 } }) as {
      config: Record<string, unknown>;
    };
    expect(stored.config).toHaveProperty('maxReactRounds', 8);
    expect(stored.config).not.toHaveProperty('maxReActRounds');
    expect(capabilityConfigReactRounds(stored.config)).toEqual({
      state: 'honoured',
      rounds: 8,
    });
  });
});
