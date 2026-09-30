'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMarkdown } from './ChatMarkdown';
import type { Attachment, ChatMessage, ExecutionPlan, PhaseEvent, ProposalStatus } from './types';

export interface ChatMessageItemProps {
  message: ChatMessage;
  /** Tailwind `bg-*` class for the avatar dot. Supplied by the caller because the
   *  backend `AGENT_COLOR_PALETTE` is the source of truth for agent colour. */
  agentColor: string;
  onCopy: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  onEdit: (messageId: string, text: string) => void;
  onDelete: (messageId: string) => void;
  onDecide: (messageId: string, index: number, decision: 'approve' | 'reject') => void;
  onSend: (text: string) => void;
}

const COPY_FEEDBACK_MS = 1500;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `resume_agent` -> `resume agent`. The old renderer replaced only the first
 *  underscore, so every name after the first kept its snake_case. */
function agentLabel(name?: string): string {
  return (name || 'assistant').replace(/_/g, ' ');
}

function isProposalResolved(status: ProposalStatus): boolean {
  return status === 'approved' || status === 'rejected' || status === 'expired';
}

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  return (
    <li className="text-2xs border border-border/50 rounded-full px-3 py-1 bg-surface-50">
      <span className="font-mono text-text">{attachment.name}</span>
      {attachment.sizeBytes !== undefined && (
        <span className="text-text-dim"> · {fmtBytes(attachment.sizeBytes)}</span>
      )}
      {attachment.stored ? (
        <span className="text-success"> · stored</span>
      ) : (
        <span className="text-error"> · not stored</span>
      )}
      {attachment.stored && attachment.path && (
        <span className="text-text-dim font-mono"> {attachment.path}</span>
      )}
      {attachment.error && <span className="text-error"> — {attachment.error}</span>}
    </li>
  );
}

function PhaseRow({ phase }: { phase: PhaseEvent }) {
  return (
    <li>
      <div className="flex items-center gap-2">
        {phase.ok === false && (
          <span className="text-error">
            <span aria-hidden="true">✕</span>
            <span className="sr-only">reported a problem</span>
          </span>
        )}
        <span className="text-text-dim uppercase tracking-wider">{phase.kind}</span>
        <span className="text-text">{phase.label}</span>
        <time dateTime={phase.at} className="ml-auto text-text-dim">
          {fmtTime(phase.at)}
        </time>
      </div>
      {phase.detail && <p className="text-text-muted mt-0.5">{phase.detail}</p>}
      {phase.issues && phase.issues.length > 0 && (
        <ul className="list-disc pl-4 mt-0.5 text-warning">
          {phase.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PlanBlock({ plan }: { plan: ExecutionPlan }) {
  const { planId, goalSummary, subtasks, sequential } = plan;
  return (
    <details className="mt-3 text-xs bg-surface/50 border border-border/50 rounded-lg p-3">
      <summary className="font-mono text-text-muted cursor-pointer hover:text-text select-none flex items-center justify-between gap-2">
        <span className="font-medium text-text">
          Execution Plan ({subtasks.length} subtask{subtasks.length === 1 ? '' : 's'}
          {/* `sequential` is optional. Absent means the backend did not say, so
              the label stays silent rather than asserting "parallel". */}
          {sequential === undefined ? '' : sequential ? ' · sequential' : ' · parallel'})
        </span>
        <span className="text-2xs text-text-dim font-mono">{planId || 'DAG'}</span>
      </summary>
      <div className="mt-2 space-y-1.5 pl-2 border-l border-border/40 font-mono text-2xs">
        {goalSummary && <div className="text-text-dim italic mb-1.5">Goal: {goalSummary}</div>}
        {subtasks.map((st, i) => (
          <div key={st.taskId || `${st.title}-${i}`} className="flex items-center gap-2 flex-wrap">
            <span className="text-text-dim">{i + 1}.</span>
            <span className="font-medium text-text">{st.title}</span>
            <span className="text-primary text-2xs px-1.5 py-0.5 rounded bg-surface border border-border/50">
              @{st.agentAssigned}
            </span>
            {st.dependencies && st.dependencies.length > 0 && (
              <span className="text-text-dim">wait: {st.dependencies.join(', ')}</span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

export function ChatMessageItem({
  message,
  agentColor,
  onCopy,
  onRetry,
  onEdit,
  onDelete,
  onDecide,
  onSend,
}: ChatMessageItemProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Index of the proposal awaiting its second click. Approving runs a
   *  destructive action server-side, so one stray click must not fire it. */
  const [confirmingApprove, setConfirmingApprove] = useState<number | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = useCallback(() => {
    onCopy(message.id);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  }, [message.id, onCopy]);

  const startEdit = useCallback(() => {
    setDraft(message.text);
    setEditing(true);
  }, [message.text]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft(message.text);
  }, [message.text]);

  const saveEdit = useCallback(() => {
    const next = draft.trim();
    if (!next) return;
    onEdit(message.id, next);
    setEditing(false);
  }, [draft, message.id, onEdit]);

  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const confidence = message.confidence;

  return (
    <article className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div aria-hidden="true" className={`w-7 h-7 rounded-full ${agentColor} shrink-0 mt-1`} />
      )}
      <div
        className={
          isUser
            ? 'max-w-[75%] bg-surface-elevated text-text border border-border-subtle rounded-xl px-4 py-3 shadow-card'
            : 'flex-1 min-w-0'
        }
      >
        {isUser ? (
          <div className="flex items-center justify-end gap-2 mb-1.5">
            {message.edited && (
              <span className="text-2xs text-text-dim" title="This message was edited">
                edited
              </span>
            )}
            <time dateTime={message.timestamp} className="text-2xs text-text-dim">
              {fmtTime(message.timestamp)}
            </time>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-medium text-text capitalize">
              {agentLabel(message.agentName)}
            </span>
            <time dateTime={message.timestamp} className="text-2xs text-text-dim">
              {fmtTime(message.timestamp)}
            </time>
            {confidence !== undefined && (
              <span
                /* The router reports this number; nothing verifies it, so the
                   badge says so and is coloured by the value rather than always
                   green — a 12% score in success green is a false reassurance. */
                className={`text-2xs font-mono px-1.5 py-0.5 rounded border ${
                  confidence >= 0.9
                    ? 'border-success/20 text-success'
                    : confidence >= 0.6
                      ? 'border-warning/20 text-warning'
                      : 'border-error/20 text-error'
                }`}
                title="Intent confidence reported by the router"
              >
                {Math.round(confidence * 100)}%
              </span>
            )}
            {message.highway && (
              <span
                className="inline-flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                title="Execution Highway Routing"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none" />
                {message.highway === 'A' || message.highway.includes('highway_a')
                  ? 'Highway A (Express)'
                  : message.highway.includes('fused')
                    ? '80/20 Cognitive Fusion'
                    : 'Highway B (Deliberative)'}
              </span>
            )}
            {message.s1LatencyMs !== undefined && (
              <span
                className="inline-flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20"
                title="System 1 Jev Deterministic Latency"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                S1 Jev: {message.s1LatencyMs}ms
              </span>
            )}
            {message.s2LatencyMs !== undefined && (
              <span
                className="inline-flex items-center gap-1 text-2xs font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                title="System 2 Generative Model Latency"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                S2 Gen: {message.s2LatencyMs}ms
              </span>
            )}
            {message.latencyMs !== undefined && (
              <span className="ml-auto text-2xs font-mono text-text-dim" title="Round trip time">
                {message.latencyMs}ms
              </span>
            )}
          </div>
        )}

        {editing ? (
          <div className="space-y-2">
            <label htmlFor={`edit-${message.id}`} className="sr-only">
              Edit your message
            </label>
            <textarea
              id={`edit-${message.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-surface-100 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={!draft.trim()}
                className="rounded-full bg-action text-action-fg px-3 py-1 text-2xs font-medium hover:bg-action-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-border px-3 py-1 text-2xs text-text-muted hover:bg-surface-hover hover:text-text"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-text">
            {message.text}
          </div>
        ) : (
          <div className="relative">
            <ChatMarkdown>{message.text}</ChatMarkdown>
            {message.status === 'streaming' && (
              <>
                {/* A bare styled span announces nothing. The caret carries the
                    state visually and the sr-only sibling carries it in words. */}
                <span
                  aria-hidden="true"
                  className="inline-block w-2 h-4 ml-1 bg-text-dim align-middle animate-pulse motion-reduce:animate-none"
                />
                <span className="sr-only">Assistant is responding</span>
              </>
            )}
          </div>
        )}

        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="mt-3">
            <ul className="flex flex-wrap gap-1.5">
              {message.attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} />
              ))}
            </ul>
            <p className="text-2xs text-text-dim mt-1.5">
              The agent received the stored reference. File contents are not shown here.
            </p>
          </div>
        )}

        {!isUser && message.phases && message.phases.length > 0 && (
          <details className="mt-3 rounded-lg border border-border/50 bg-surface/50 p-3 font-mono text-2xs">
            <summary className="cursor-pointer select-none text-text-muted hover:text-text">
              Reasoning trace ({message.phases.length} step
              {message.phases.length === 1 ? '' : 's'})
            </summary>
            <ol className="mt-2 space-y-1.5 pl-2 border-l border-border/40">
              {message.phases.map((p, i) => (
                <PhaseRow key={`${p.kind}-${p.at}-${i}`} phase={p} />
              ))}
            </ol>
          </details>
        )}

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <ul className="mt-3 border-l-2 border-dashed border-border/60 pl-3 space-y-1">
            {message.toolCalls.map((t, i) => (
              <li key={`${t.name}-${i}`} className="flex items-center gap-2 text-xs font-mono">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    t.status === 'done'
                      ? 'bg-success'
                      : t.status === 'error'
                        ? 'bg-error'
                        : 'bg-warning'
                  }`}
                />
                <span className="text-text">
                  {t.name}
                  <span className="text-text-dim">
                    {/* No duration reported means no duration shown. The old
                        renderer printed a hardcoded 240ms/350ms here, which reads
                        as a measurement and is not one. */}
                    {t.status}
                    {t.latencyMs !== undefined ? ` · ${t.latencyMs}ms` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {!isUser && message.plan && message.plan.subtasks.length > 0 && (
          <PlanBlock plan={message.plan} />
        )}

        {!isUser && message.citations && message.citations.length > 0 && (
          <ul className="mt-3 flex gap-2 overflow-x-auto">
            {message.citations.map((c, i) => {
              const meta = [c.pageOrSection, c.excerpt].filter(Boolean).join(' — ');
              const inner = (
                <>
                  <span>{c.title}</span>
                  {meta && <span className="text-text-dim"> · {meta}</span>}
                </>
              );
              return (
                <li key={`${c.title}-${i}`} className="shrink-0">
                  {c.uri ? (
                    <a
                      href={c.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs border border-border/50 rounded-full px-3 py-1 hover:bg-surface-hover"
                    >
                      {inner}
                    </a>
                  ) : (
                    /* No uri: render plain text. `href="#"` produced a link that
                        looks actionable, jumps to the top of the page, and goes
                        nowhere. */
                    <span className="inline-block text-xs border border-border/50 rounded-full px-3 py-1 text-text-muted">
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!isUser && message.proposals && message.proposals.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.proposals.map((p, i) => {
              const resolved = isProposalResolved(p.status);
              return (
                <div
                  key={p.title + i}
                  className="rounded-xl border border-warning/20 bg-warning/10 p-3"
                >
                  <p className="text-sm font-medium text-text">{p.title}</p>
                  {p.detail && <p className="text-xs text-text-muted mt-1">{p.detail}</p>}
                  {p.status === 'error' && (
                    <p className="text-xs text-error mt-1.5">
                      {message.error?.message ||
                        'Action failed. Pending approvals live in Notifications.'}
                    </p>
                  )}
                  {p.status === 'expired' && (
                    <p className="text-xs text-text-dim mt-1.5">Expired</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    {p.status === 'approved' ? (
                      <span className="flex-1 text-center rounded-full text-xs py-1.5 bg-success/20 text-success border border-success/30">
                        Approved
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={resolved}
                        onClick={() => {
                          if (confirmingApprove === i) {
                            onDecide(message.id, i, 'approve');
                            setConfirmingApprove(null);
                          } else {
                            setConfirmingApprove(i);
                          }
                        }}
                        className={`flex-1 rounded-full text-xs py-1.5 disabled:opacity-40 disabled:cursor-default ${
                          confirmingApprove === i
                            ? 'bg-error text-error-fg font-semibold'
                            : 'bg-action text-action-fg hover:bg-action-hover'
                        }`}
                      >
                        {confirmingApprove === i ? 'Confirm approve' : 'Approve'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={resolved}
                      onClick={() => onDecide(message.id, i, 'reject')}
                      className={`flex-1 rounded-full text-xs py-1.5 disabled:opacity-40 disabled:cursor-default ${
                        p.status === 'rejected'
                          ? 'bg-error/20 text-error border border-error/30'
                          : 'border border-border text-text hover:bg-surface-hover'
                      }`}
                    >
                      {p.status === 'rejected' ? 'Rejected' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isUser && message.questions && message.questions.length > 0 && (
          /* Rendered as chips only. The old renderer also appended the questions
             to the message prose, so every question appeared twice. */
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {message.questions.map((q, i) => (
              <li key={q + i}>
                <button
                  type="button"
                  onClick={() => onSend(q)}
                  className="rounded-full border border-border/50 px-3 py-1 text-xs text-text hover:bg-surface-hover"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!isUser && message.actionChips && message.actionChips.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-border-subtle/50">
            {message.actionChips.map((chip, i) => (
              <li key={chip + i}>
                <button
                  type="button"
                  onClick={() => onSend(chip)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-surface-elevated hover:bg-surface-hover text-text border border-border transition-all cursor-pointer shadow-sm hover:border-primary/50 hover:text-primary active:scale-95"
                >
                  {chip}
                </button>
              </li>
            ))}
          </ul>
        )}

        {message.status === 'stopped' && <p className="text-2xs text-text-dim mt-2">Stopped.</p>}

        {message.status === 'background' && (
          <p className="text-2xs text-warning mt-2">
            Still running on the server. This client stopped waiting for updates, so newer output is
            not shown here.
          </p>
        )}

        {isError && (
          <p className="text-xs text-error mt-2 break-words">
            {message.error?.message || 'This message failed without a reason.'}
            {message.error?.code ? ` (${message.error.code})` : ''}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-2xs flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-text-dim hover:text-text"
          >
            {copied ? (
              <>
                <span className="text-success" aria-hidden="true">
                  ✓
                </span>
                <span role="status">Copied</span>
              </>
            ) : (
              'Copy'
            )}
          </button>

          {/* An errored message already has the Retry affordance, so Regenerate
              is suppressed there rather than rendering two identical buttons. */}
          {!isUser && !isError && (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="text-text-dim hover:text-text"
            >
              Regenerate
            </button>
          )}

          {isError && (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="text-primary hover:underline"
            >
              Retry
            </button>
          )}

          {isUser && !editing && (
            <button type="button" onClick={startEdit} className="text-text-dim hover:text-text">
              Edit
            </button>
          )}

          {confirmingDelete ? (
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onDelete(message.id);
                  setConfirmingDelete(false);
                }}
                className="rounded-full bg-error text-error-fg px-2 py-0.5 font-medium hover:opacity-90"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-text-dim hover:text-text"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-text-dim hover:text-error"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
