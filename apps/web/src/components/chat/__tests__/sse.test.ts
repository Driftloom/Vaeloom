import { applyStreamEvent, emptyAccumulator, shouldFallBackToBuffered } from '../sse';
import type { StreamAccumulator, StreamEventData } from '../sse';
import type { PhaseEvent } from '../types';

/**
 * The SSE reducer is the single place the backend's 14-event vocabulary is turned
 * into something a user sees. Every test below is about one of three things:
 *
 *  1. Honesty — a number on screen is a number the backend reported. No defaults,
 *     no placeholders. A fabricated duration in a monospace font reads as measured
 *     telemetry, and a fabricated "98% confidence" badge reads as a model verdict.
 *  2. Coverage — the backend emits 14 event types; the previous UI handled 9 and
 *     substituted a hardcoded "Thinking · routing + QA" string for the other 5.
 *  3. Purity / replay — resume replays events from the start of a run, so folding
 *     the same event twice must be idempotent, and folding must never mutate the
 *     caller's accumulator.
 */

/** `noUncheckedIndexedAccess` is on: index access needs an explicit failure, not `!`. */
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) {
    throw new Error(`expected an element at index ${index}, got ${items.length} item(s)`);
  }
  return value;
}

function fold(...steps: Array<[string, StreamEventData]>): StreamAccumulator {
  return steps.reduce<StreamAccumulator>(
    (acc, [event, data]) => applyStreamEvent(acc, event, data),
    emptyAccumulator(),
  );
}

function clone(acc: StreamAccumulator): StreamAccumulator {
  return JSON.parse(JSON.stringify(acc)) as StreamAccumulator;
}

describe('sse reducer', () => {
  describe('emptyAccumulator', () => {
    it('starts with no output and no terminal outcome, and asserts nothing about telemetry', () => {
      const acc = emptyAccumulator();

      expect(acc.text).toBe('');
      expect(acc.toolCalls).toEqual([]);
      expect(acc.proposals).toEqual([]);
      expect(acc.phases).toEqual([]);
      expect(acc.sawToken).toBe(false);
      expect(acc.sawAny).toBe(false);
      expect(acc.terminal).toBeNull();

      // An absent field, not a zero or a default. `0` would render as a real
      // measurement and `0.98` used to render as a model verdict.
      expect(acc.confidence).toBeUndefined();
      expect(acc).not.toHaveProperty('confidence');
      expect(acc.latencyMs).toBeUndefined();
    });
  });

  describe('tool durations', () => {
    it('leaves latencyMs absent when tool_result reports no duration, instead of inventing one', () => {
      // The old code hardcoded 240ms for every tool and 350ms for every sub-agent,
      // so a user comparing two runs was comparing two constants.
      const acc = fold(
        ['tool_start', { tool: 'browse_job_page' }],
        ['tool_result', { tool: 'browse_job_page', status: 'success' }],
      );

      const call = at(acc.toolCalls, 0);
      expect(call.name).toBe('browse_job_page');
      expect(call.status).toBe('done');
      expect(call.latencyMs).toBeUndefined();
      expect(call).not.toHaveProperty('latencyMs');
    });

    it('uses the exact latency_ms the backend reported', () => {
      const acc = fold(
        ['tool_start', { tool: 'scrape_company_insights' }],
        ['tool_result', { tool: 'scrape_company_insights', status: 'success', latency_ms: 1284 }],
      );

      expect(at(acc.toolCalls, 0).latencyMs).toBe(1284);
    });

    it('accepts the camelCase latencyMs spelling, which the backend also emits', () => {
      const acc = fold(
        ['tool_start', { tool: 'calculate_semantic_ats_score' }],
        ['tool_result', { tool: 'calculate_semantic_ats_score', status: 'success', latencyMs: 96 }],
      );

      expect(at(acc.toolCalls, 0).latencyMs).toBe(96);
    });

    it('accepts the duration_ms spelling rather than dropping the measurement', () => {
      const acc = fold(
        ['tool_start', { tool: 'verify_application_link' }],
        ['tool_result', { tool: 'verify_application_link', status: 'success', duration_ms: 7 }],
      );

      expect(at(acc.toolCalls, 0).latencyMs).toBe(7);
    });

    it('prefers latency_ms when a payload carries more than one spelling', () => {
      const acc = fold(
        ['tool_start', { tool: 'search_jobs' }],
        [
          'tool_result',
          { tool: 'search_jobs', status: 'success', latency_ms: 11, duration_ms: 99 },
        ],
      );

      expect(at(acc.toolCalls, 0).latencyMs).toBe(11);
    });

    it('ignores a non-numeric duration rather than coercing it', () => {
      const acc = fold(
        ['tool_start', { tool: 'search_jobs' }],
        ['tool_result', { tool: 'search_jobs', status: 'success', latency_ms: 'fast' }],
      );

      expect(at(acc.toolCalls, 0).latencyMs).toBeUndefined();
    });
  });

  describe('intent confidence', () => {
    it('leaves confidence absent when the intent event carries none', () => {
      // The old placeholder wrote 0.98 into the optimistic message and the UI
      // rendered a green "98% Verified Intent Confidence" badge before any model ran.
      const acc = fold(['intent', { agent: 'resume', request_id: 'req-1' }]);

      expect(acc.agentName).toBe('resume');
      expect(acc.confidence).toBeUndefined();
      expect(acc).not.toHaveProperty('confidence');
    });

    it('adopts a reported confidence verbatim, including below 1', () => {
      const acc = fold(['intent', { agent: 'ats', confidence: 0.42 }]);

      expect(acc.confidence).toBe(0.42);
    });

    it('ignores a confidence that is not a finite number', () => {
      const acc = fold(['intent', { agent: 'ats', confidence: '0.98' }]);

      expect(acc.confidence).toBeUndefined();
    });
  });

  describe('tool and sub-agent bookkeeping', () => {
    it('does not create a second entry for a duplicated tool_start', () => {
      const acc = fold(
        ['tool_start', { tool: 'search_jobs' }],
        ['tool_start', { tool: 'search_jobs' }],
        ['tool_start', { tool: 'search_jobs' }],
      );

      expect(acc.toolCalls).toEqual([{ name: 'search_jobs', status: 'running', kind: 'tool' }]);
    });

    it('pairs sub_agent_spawned with sub_agent_completed as one running → done row', () => {
      const acc = fold(
        ['sub_agent_spawned', { child_agent: 'ats' }],
        ['sub_agent_completed', { child_agent: 'ats', status: 'success', latency_ms: 812 }],
      );

      expect(acc.toolCalls).toHaveLength(1);
      expect(at(acc.toolCalls, 0)).toEqual({
        name: '@ats',
        status: 'done',
        kind: 'sub_agent',
        latencyMs: 812,
      });
      expect(acc.phases.map((p) => p.kind)).toEqual(['supervisor']);
      expect(at(acc.phases, 0).label).toBe('Delegated to @ats');
    });

    it('records a failed sub-agent as error rather than done', () => {
      const acc = fold(
        ['sub_agent_spawned', { child_agent: 'ats' }],
        ['sub_agent_completed', { child_agent: 'ats', status: 'failed' }],
      );

      expect(at(acc.toolCalls, 0).status).toBe('error');
      expect(at(acc.toolCalls, 0).latencyMs).toBeUndefined();
    });

    it('does not duplicate a sub-agent that is spawned twice while still running', () => {
      const acc = fold(
        ['sub_agent_spawned', { child_agent: 'ats' }],
        ['sub_agent_spawned', { child_agent: 'ats' }],
      );

      expect(acc.toolCalls).toHaveLength(1);
      // The trace is deduped by (kind, label), so the delegation line appears once.
      expect(acc.phases).toHaveLength(1);
    });

    it('maps every tool_result status alias onto the three client statuses', () => {
      const success = fold(
        ['tool_start', { tool: 'a' }],
        ['tool_result', { tool: 'a', status: 'completed' }],
      );
      const failure = fold(
        ['tool_start', { tool: 'b' }],
        ['tool_result', { tool: 'b', status: 'failure' }],
      );
      const unknown = fold(
        ['tool_start', { tool: 'c' }],
        ['tool_result', { tool: 'c', status: 'something_new' }],
      );

      expect(at(success.toolCalls, 0).status).toBe('done');
      expect(at(failure.toolCalls, 0).status).toBe('error');
      expect(at(unknown.toolCalls, 0).status).toBe('running');
    });
  });

  describe('the event vocabulary', () => {
    it('renders an act event as an act phase with the action and summary', () => {
      const acc = fold(['act', { result: { action: 'search_jobs', summary: 'found 3 roles' } }]);

      expect(acc.phases).toHaveLength(1);
      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'act',
        label: 'Act · search_jobs',
        detail: 'found 3 roles',
      });
    });

    it('renders an observe event as an observe phase carrying the observation', () => {
      const acc = fold(['observe', { observation: 'resume has 2 pages' }]);

      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'observe',
        label: 'Observe',
        detail: 'resume has 2 pages',
      });
    });

    it('marks a satisfied reflect event ok, and keeps the reason as detail', () => {
      const acc = fold(['reflect', { is_satisfied: true, reason: 'goal already met' }]);

      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'reflect',
        label: 'Reflect · satisfied',
        detail: 'goal already met',
        ok: true,
      });
    });

    it('marks an unsatisfied reflect event not-ok, so a retry loop is visible', () => {
      const acc = fold(['reflect', { is_satisfied: false, reason: 'metrics missing' }]);

      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'reflect',
        label: 'Reflect · retrying',
        detail: 'metrics missing',
        ok: false,
      });
    });

    it('marks an approved qa gate ok', () => {
      const acc = fold(['qa', { decision: 'approved' }]);

      expect(at(acc.phases, 0)).toMatchObject({ kind: 'qa', label: 'QA gate · passed', ok: true });
    });

    it('preserves the qa rejection issues, which is the only reason to show the gate', () => {
      const acc = fold([
        'qa',
        { decision: 'rejected', issues: ['unsupported claim', 'missing citation'] },
      ]);

      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'qa',
        label: 'QA gate · rejected',
        ok: false,
        issues: ['unsupported claim', 'missing citation'],
      });
    });

    it('surfaces approval_required as a pending proposal plus an approval phase', () => {
      const acc = fold([
        'approval_required',
        {
          title: 'Send the tailored resume to the recruiter',
          approval_id: 'ap-42',
          requires_approval: true,
          detail: 'draft is ready',
        },
      ]);

      expect(acc.proposals).toHaveLength(1);
      expect(at(acc.proposals, 0)).toEqual({
        title: 'Send the tailored resume to the recruiter',
        detail: 'draft is ready',
        requiresApproval: true,
        approvalId: 'ap-42',
        status: 'pending',
      });
      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'approval',
        label: 'Approval required · Send the tailored resume to the recruiter',
        ok: false,
      });
    });

    it('marks an approval proposal with no approval id as expired, not actionable', () => {
      const acc = fold(['approval_required', { title: 'Delete 12 memories' }]);

      expect(at(acc.proposals, 0)).toMatchObject({
        status: 'expired',
        requiresApproval: false,
        approvalId: undefined,
      });
    });

    it('renders all five supervisor events as trace phases', () => {
      const acc = fold(
        ['supervisor_start', { message: 'Decomposing the goal' }],
        ['supervisor_layer_start', { layer: 2 }],
        ['supervisor_parallel', { agents: ['a', 'b', 'c'] }],
        ['supervisor_agent_done', { agent: 'ats' }],
        ['supervisor_error', { message: 'layer 2 failed', fallback: 'retrying locally' }],
      );

      expect(acc.phases.map((p) => [p.kind, p.label])).toEqual([
        ['supervisor', 'Decomposing the goal'],
        ['supervisor', 'Supervisor layer 2'],
        ['supervisor', 'Running 3 agents in parallel'],
        ['supervisor', '@ats finished'],
        ['error', 'layer 2 failed'],
      ]);
      expect(at(acc.phases, 3).ok).toBe(true);
      expect(at(acc.phases, 4)).toMatchObject({ detail: 'retrying locally', ok: false });
    });

    it('reads a parallel count from `count` when no agent array is sent', () => {
      const acc = fold(['supervisor_parallel', { count: 4 }]);

      expect(at(acc.phases, 0).label).toBe('Running 4 agents in parallel');
    });

    it('turns an error event into a terminal error carrying the backend message', () => {
      const acc = fold(['error', { result: 'Model provider unavailable' }]);

      expect(acc.terminal).toBe('error');
      expect(acc.terminalMessage).toBe('Model provider unavailable');
      expect(acc.text).toBe('Model provider unavailable');
      expect(at(acc.phases, 0)).toMatchObject({ kind: 'error', ok: false });
    });

    it('does not overwrite already-streamed text with an error message', () => {
      const acc = fold(
        ['token', { token: 'Partial answer' }],
        ['error', { result: 'stream reset' }],
      );

      expect(acc.text).toBe('Partial answer');
      expect(acc.terminal).toBe('error');
      expect(acc.terminalMessage).toBe('stream reset');
    });

    it('turns ask_clarification into a clarification terminal with the questions', () => {
      const acc = fold([
        'ask_clarification',
        { questions: ['Which resume?', 'Which role?'], action_chips: ['Tailor', 'Rewrite'] },
      ]);

      expect(acc.terminal).toBe('clarification');
      expect(acc.text).toBe('Which resume?\n\nWhich role?');
      expect(acc.terminalMessage).toBe('Which resume?\n\nWhich role?');
      expect(acc.questions).toEqual(['Which resume?', 'Which role?']);
      expect(acc.actionChips).toEqual(['Tailor', 'Rewrite']);
    });

    it('keeps the clarification terminal when the backend follows with done', () => {
      // routers/agents.py always emits `ask_clarification` then `done`. An earlier
      // reducer relabelled the turn 'done' in the else branch, which erased the one
      // piece of information the user needed: the agent asked them something.
      const acc = fold(
        ['ask_clarification', { questions: ['Which resume?'] }],
        ['done', { result: 'some summary' }],
      );

      expect(acc.terminal).toBe('clarification');
      expect(acc.terminalMessage).toBe('Which resume?');
    });

    it('marks out_of_scope as its own terminal, also surviving a following done', () => {
      const acc = fold(
        ['out_of_scope', { message: 'I only handle job applications.' }],
        ['done', { result: 'summary that must not relabel the outcome' }],
      );

      expect(acc.terminal).toBe('out_of_scope');
      expect(acc.terminalMessage).toBe('I only handle job applications.');
    });

    it('adopts the done summary as text only when nothing was streamed', () => {
      const acc = fold(['done', { result: 'Here is the summary.' }]);

      expect(acc.text).toBe('Here is the summary.');
      expect(acc.terminal).toBe('done');
    });

    it('does not let a done summary clobber the partially streamed answer', () => {
      // The duplicate summary replacing a partial answer is the real bug: the user
      // watches a response build up and then sees it swap for a different one.
      const acc = fold(
        ['token', { token: 'I found ' }],
        ['token', { token: 'three roles.' }],
        ['done', { result: 'I found three roles that match your profile.' }],
      );

      expect(acc.text).toBe('I found three roles.');
    });

    it('treats a done with status failed as a terminal error', () => {
      const acc = fold(['done', { status: 'failed', result: 'tool budget exhausted' }]);

      expect(acc.terminal).toBe('error');
      expect(acc.terminalMessage).toBe('tool budget exhausted');
    });

    it('reports a failed done with no message instead of leaving it blank', () => {
      const acc = fold(['done', { status: 'failed' }]);

      expect(acc.terminal).toBe('error');
      expect(acc.terminalMessage).toBe('The run did not complete.');
    });

    it('treats a cancelled done as an error rather than a clean finish', () => {
      const acc = fold(['done', { status: 'cancelled' }]);

      expect(acc.terminal).toBe('error');
    });

    it('lifts citations, action chips and proposals out of the done payload', () => {
      const acc = fold([
        'done',
        {
          action_chips: ['Tailor it', 'Find more'],
          result: {
            summary: 'done',
            proposals: [{ title: 'Apply now', approval_id: 'ap-9' }],
            details: {
              citations: [
                {
                  document_title: 'Resume v3',
                  uri: 's3://resume.pdf',
                  score: 0.82,
                  page_or_section: 'p2',
                },
              ],
            },
          },
        },
      ]);

      expect(acc.actionChips).toEqual(['Tailor it', 'Find more']);
      expect(acc.citations).toEqual([
        {
          title: 'Resume v3',
          uri: 's3://resume.pdf',
          score: 0.82,
          excerpt: undefined,
          pageOrSection: 'p2',
        },
      ]);
      expect(at(acc.proposals, 0)).toMatchObject({
        title: 'Apply now',
        approvalId: 'ap-9',
        status: 'pending',
      });
    });

    it('ignores an event type it does not model but still records that it arrived', () => {
      const acc = fold(['some_future_event', { anything: 1 }]);

      expect(acc.sawAny).toBe(true);
      expect(acc.phases).toEqual([]);
      expect(acc.text).toBe('');
    });
  });

  describe('accumulator flags', () => {
    it.each([
      ['intent', { agent: 'ats' } as StreamEventData],
      ['plan', { subtasks: [{ title: 't', agent_assigned: 'ats' }] } as StreamEventData],
      ['tool_start', { tool: 'search_jobs' } as StreamEventData],
      ['tool_result', { tool: 'search_jobs', status: 'success' } as StreamEventData],
      ['act', { result: { action: 'search_jobs' } } as StreamEventData],
      ['observe', { observation: 'ok' } as StreamEventData],
      ['qa', { decision: 'approved' } as StreamEventData],
    ])('does not count a %s event as streamed output', (event, data) => {
      // The old single `streamedAny` flag flipped on the FIRST event of any kind, so
      // a stream that died right after `intent` skipped the buffered retry and
      // surfaced a raw network error instead of a working answer.
      const acc = applyStreamEvent(emptyAccumulator(), event, data);

      expect(acc.sawToken).toBe(false);
      expect(acc.sawAny).toBe(true);
    });

    it('counts a non-whitespace token as streamed output', () => {
      const acc = fold(['token', { token: 'Hello' }]);

      expect(acc.sawToken).toBe(true);
      expect(acc.text).toBe('Hello');
    });

    it('does not count a whitespace-only token delta as output', () => {
      // A whitespace delta is not output. Counting it suppressed the working
      // buffered retry and left the user on "No response — try rephrasing".
      const acc = fold(['token', { token: ' \n\t ' }]);

      expect(acc.sawToken).toBe(false);
      expect(acc.text).toBe('');
      expect(shouldFallBackToBuffered(acc)).toBe(true);
    });

    it('sets sawAny for an event that contributes nothing at all', () => {
      const acc = fold(['token', { token: '' }]);

      expect(acc.sawAny).toBe(true);
      expect(acc.sawToken).toBe(false);
    });

    it('appends consecutive token deltas in order', () => {
      const acc = fold(
        ['token', { token: 'one ' }],
        ['token', { token: 'two ' }],
        ['token', { token: 'three' }],
      );

      expect(acc.text).toBe('one two three');
      expect(acc.sawToken).toBe(true);
    });
  });

  describe('shouldFallBackToBuffered', () => {
    it('is true for a stream that produced nothing at all', () => {
      expect(shouldFallBackToBuffered(emptyAccumulator())).toBe(true);
    });

    it('is still true after only non-token events, so a dead stream retries', () => {
      const acc = fold(['intent', { agent: 'ats' }], ['tool_start', { tool: 'search_jobs' }]);

      expect(shouldFallBackToBuffered(acc)).toBe(true);
    });

    it('is false once a real token arrived', () => {
      const acc = fold(['token', { token: 'partial' }]);

      expect(shouldFallBackToBuffered(acc)).toBe(false);
    });

    it('is false when a clarification or scope refusal already supplied the text', () => {
      const clarification = fold(['ask_clarification', { questions: ['Which one?'] }]);
      const outOfScope = fold(['out_of_scope', { message: 'out of scope' }]);

      expect(shouldFallBackToBuffered(clarification)).toBe(false);
      expect(shouldFallBackToBuffered(outOfScope)).toBe(false);
    });
  });

  describe('purity and replay', () => {
    it('does not mutate the accumulator it was given', () => {
      const before = fold(
        ['intent', { agent: 'ats', confidence: 0.7 }],
        ['tool_start', { tool: 'search_jobs' }],
        ['act', { result: { action: 'search_jobs' } }],
      );
      const snapshot = clone(before);
      const phasesBefore = before.phases;
      const toolCallsBefore = before.toolCalls;

      const after = applyStreamEvent(before, 'token', { token: 'answer' });
      applyStreamEvent(before, 'tool_result', { tool: 'search_jobs', status: 'success' });
      applyStreamEvent(before, 'qa', { decision: 'rejected', issues: ['nope'] });

      expect(before).toEqual(snapshot);
      expect(before.phases).toBe(phasesBefore);
      expect(before.toolCalls).toBe(toolCallsBefore);
      expect(after.text).toBe('answer');
      expect(after).not.toBe(before);
    });

    it('does not duplicate the proposal when the same approval_required is replayed', () => {
      const event: [string, StreamEventData] = [
        'approval_required',
        { title: 'Send resume', approval_id: 'ap-42', requires_approval: true },
      ];

      const acc = applyStreamEvent(applyStreamEvent(emptyAccumulator(), ...event), ...event);

      expect(acc.proposals).toHaveLength(1);
      expect(at(acc.proposals, 0).approvalId).toBe('ap-42');
    });

    it('does not duplicate the approval trace row when the same event is replayed', () => {
      // Resume replays from the start of a run. An append-only trace would double
      // every row the second time a turn was rendered.
      const event: [string, StreamEventData] = [
        'approval_required',
        { title: 'Send resume', approval_id: 'ap-42' },
      ];

      const acc = applyStreamEvent(applyStreamEvent(emptyAccumulator(), ...event), ...event);

      expect(acc.phases).toHaveLength(1);
      expect(at(acc.phases, 0).kind).toBe('approval');
    });

    it('does not duplicate the qa trace row when the same event is replayed', () => {
      const event: [string, StreamEventData] = [
        'qa',
        { decision: 'rejected', issues: ['unsupported claim'] },
      ];

      const acc = applyStreamEvent(applyStreamEvent(emptyAccumulator(), ...event), ...event);

      expect(acc.phases).toHaveLength(1);
      expect(at(acc.phases, 0)).toMatchObject({
        kind: 'qa',
        ok: false,
        issues: ['unsupported claim'],
      });
    });

    it('keeps distinct trace rows when two approvals have different titles', () => {
      const acc = fold(
        ['approval_required', { title: 'Send resume', approval_id: 'ap-1' }],
        ['approval_required', { title: 'Apply to job', approval_id: 'ap-2' }],
      );

      expect(acc.proposals).toHaveLength(2);
      expect(acc.phases).toHaveLength(2);
    });

    it('replaces rather than duplicates a proposal when the replay carries a newer status', () => {
      const acc = fold(
        [
          'approval_required',
          { title: 'Send resume', approval_id: 'ap-1', requires_approval: true },
        ],
        [
          'approval_required',
          { title: 'Send resume', approval_id: 'ap-1', detail: 'still pending' },
        ],
      );

      expect(acc.proposals).toHaveLength(1);
      expect(at(acc.proposals, 0).detail).toBe('still pending');
    });
  });

  describe('plan parsing', () => {
    it('parses a plan whose payload is the plan itself', () => {
      const acc = fold([
        'plan',
        {
          plan_id: 'plan-1',
          goal_summary: 'Tailor the resume to the JD',
          is_sequential: true,
          subtasks: [
            {
              task_id: 't1',
              title: 'Rewrite the summary',
              agent_assigned: 'resume',
              capability_required: 'document.edit',
              dependencies: [],
            },
            {
              title: 'Score against the ATS',
              agentAssigned: 'ats',
              dependencies: ['t1'],
            },
          ],
        },
      ]);

      expect(acc.plan).toEqual({
        planId: 'plan-1',
        goalSummary: 'Tailor the resume to the JD',
        sequential: true,
        subtasks: [
          {
            taskId: 't1',
            title: 'Rewrite the summary',
            agentAssigned: 'resume',
            capabilityRequired: 'document.edit',
            dependencies: undefined,
          },
          {
            taskId: undefined,
            title: 'Score against the ATS',
            agentAssigned: 'ats',
            capabilityRequired: undefined,
            dependencies: ['t1'],
          },
        ],
      });
    });

    it('parses a plan wrapped as {iteration, plan}, which the orchestrator also emits', () => {
      const acc = fold([
        'plan',
        {
          iteration: 2,
          plan: {
            plan_id: 'plan-2',
            subtasks: [{ title: 'Only task', agent_assigned: 'memory' }],
          },
        },
      ]);

      expect(acc.plan).toEqual({
        planId: 'plan-2',
        goalSummary: undefined,
        sequential: false,
        subtasks: [
          {
            taskId: undefined,
            title: 'Only task',
            agentAssigned: 'memory',
            capabilityRequired: undefined,
            dependencies: undefined,
          },
        ],
      });
    });

    it('defaults agentAssigned to "unassigned" rather than leaving a blank column', () => {
      const acc = fold(['plan', { subtasks: [{ title: 'Step one' }] }]);

      expect(at(acc.plan?.subtasks ?? [], 0).agentAssigned).toBe('unassigned');
    });

    it.each([
      ['an empty subtasks array', { subtasks: [] }],
      ['a subtasks value that is not an array', { subtasks: 'one, two' }],
      ['subtasks with no title on any entry', { subtasks: [{ agent_assigned: 'ats' }, { id: 7 }] }],
      ['no subtasks key at all', { plan_id: 'plan-3' }],
      ['a plan value that is not an object', { plan: 'rewrite everything' }],
    ])('leaves plan undefined for %s', (_label, data) => {
      // An unparseable plan must not become a half-populated one; the UI renders
      // nothing rather than a plan with zero steps.
      const acc = applyStreamEvent(emptyAccumulator(), 'plan', data);

      expect(acc.plan).toBeUndefined();
      expect(acc).not.toHaveProperty('plan');
    });

    it('keeps a previously parsed plan when a later iteration fails to parse', () => {
      const acc = fold(
        ['plan', { subtasks: [{ title: 'First plan' }] }],
        ['plan', { subtasks: [] }],
      );

      expect(acc.plan).toMatchObject({
        subtasks: [expect.objectContaining({ title: 'First plan' })],
      });
    });
  });

  describe('phase timestamps', () => {
    it('stamps every phase with an ISO timestamp so the trace is orderable', () => {
      const acc = fold(
        ['act', { result: { action: 'a' } }],
        ['observe', { observation: 'b' }],
      ) satisfies StreamAccumulator;

      const labels: Array<PhaseEvent['at']> = acc.phases.map((p) => p.at);
      expect(labels).toHaveLength(2);
      for (const at of labels) {
        expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      }
      expect(Number.isNaN(Date.parse(at(acc.phases, 0).at))).toBe(false);
    });
  });
});
