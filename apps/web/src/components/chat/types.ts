/**
 * Chat domain types.
 *
 * Honesty rules encoded in this file (see AGENTS.md "Absolute Truth in Testing"):
 *  - `confidence` is only ever populated from a real backend number (SSE `intent`
 *    event or a response `confidence` field). Never synthesised client-side.
 *  - `ToolCall.latencyMs` is only populated from a real backend duration. When the
 *    backend does not report one the field is `undefined` and the UI omits it. A
 *    placeholder number is a lie told to the user in a monospace font.
 *  - `MessageStatus` distinguishes "the client stopped waiting" from "the run
 *    finished". Collapsing those is how you end up telling a user a workflow is
 *    "in progress" when the client simply ran out of poll attempts.
 */

export type MessageRole = 'user' | 'agent';

/**
 * `background` means: the client stopped polling but the workflow is still live
 * server-side. That is a real, distinct state and must not be rendered as
 * "complete" or "in progress".
 */
export type MessageStatus = 'streaming' | 'complete' | 'error' | 'stopped' | 'background';

export type ToolCallStatus = 'running' | 'done' | 'error';

export interface ToolCall {
  name: string;
  status: ToolCallStatus;
  kind: 'tool' | 'sub_agent';
  /** Real duration from the backend. `undefined` when not reported. Never invented. */
  latencyMs?: number;
}

export interface Citation {
  title: string;
  uri?: string;
  score?: number;
  excerpt?: string;
  pageOrSection?: string;
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'error';

export interface Proposal {
  title: string;
  detail?: string;
  requiresApproval: boolean;
  approvalId?: string;
  status: ProposalStatus;
}

export interface PlanSubtask {
  taskId?: string;
  title: string;
  agentAssigned: string;
  capabilityRequired?: string;
  dependencies?: string[];
}

export interface ExecutionPlan {
  planId?: string;
  goalSummary?: string;
  subtasks: PlanSubtask[];
  /** Backend `is_sequential` is snake_case; responses are not key-transformed by the SSE parser. */
  sequential?: boolean;
}

export type PhaseKind =
  'plan' | 'act' | 'observe' | 'reflect' | 'qa' | 'supervisor' | 'approval' | 'error';

/**
 * One entry in the visible reasoning trace. The backend emits `act`, `observe`,
 * `reflect` and `qa` events; the previous UI dropped all four and showed a static
 * "Thinking · routing + QA" string instead.
 */
export interface PhaseEvent {
  kind: PhaseKind;
  label: string;
  detail?: string;
  at: string;
  ok?: boolean;
  issues?: string[];
}

export interface Attachment {
  id: string;
  name: string;
  /** Storage path returned by `POST /documents`, when the upload succeeded. */
  path?: string;
  sizeBytes?: number;
  stored: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: string;
  status: MessageStatus;
  /** Id of the user message this agent message answers. Enables correct retry/regenerate. */
  replyTo?: string;
  agentName?: string;
  /** Backend-reported only. See file header. */
  confidence?: number;
  toolCalls?: ToolCall[];
  citations?: Citation[];
  proposals?: Proposal[];
  questions?: string[];
  actionChips?: string[];
  attachments?: Attachment[];
  plan?: ExecutionPlan;
  phases?: PhaseEvent[];
  error?: { message: string; code?: string };
  /** Client-measured round trip. Reset when falling back off a failed stream. */
  latencyMs?: number;
  highway?: string;
  s1LatencyMs?: number;
  s2LatencyMs?: number;
  /** Temporal workflow id when this turn ran durably. */
  workflowId?: string;
  edited?: boolean;
}

export interface Thread {
  id: string;
  title: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface SlashCommand {
  trigger: string;
  desc: string;
  agent: string;
  /**
   * Tailwind class from the backend `AGENT_COLOR_PALETTE`. The backend is the
   * single source of truth for agent colour; the frontend previously kept a
   * byte-for-byte duplicate of the Python dict, which is guaranteed to drift.
   */
  color?: string;
}

export interface MentionTarget {
  name: string;
  mission: string;
  color?: string;
}

export const MAX_INPUT_LENGTH = 10000;
export const MAX_THREADS = 20;
export const MAX_MESSAGES_PER_THREAD = 200;
export const NEAR_BOTTOM_PX = 120;
export const DURABLE_POLL_INTERVAL_MS = 1500;
export const DURABLE_MAX_POLLS = 40;
