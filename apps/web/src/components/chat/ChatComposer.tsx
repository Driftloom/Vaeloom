'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MentionTarget, SlashCommand } from './types';

/** Auto-grow ceiling. Past this the textarea scrolls instead of growing, so the
 *  composer can never push the transcript off-screen. */
const MAX_TEXTAREA_PX = 120;

export interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  commands: SlashCommand[];
  commandsState: 'loading' | 'ready' | 'error';
  commandsError?: string;
  mentionTargets: MentionTarget[];
  selectedAgent: string;
  onSelectAgent: (name: string) => void;
  attachment: File | null;
  onAttachment: (file: File | null) => void;
  maxLength: number;
  persistenceError?: string | null;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  selectedSquad?: string[];
  onToggleSquadAgent?: (agentId: string) => void;
}

type PopupKind = 'slash' | 'mention';

interface PopupState {
  kind: PopupKind;
  /** Text typed after the trigger. */
  query: string;
  /** Index of the trigger char in the committed value: the splice point on commit. */
  start: number;
  activeIndex: number;
}

interface TriggerMatch {
  kind: PopupKind;
  query: string;
  start: number;
}

/**
 * Resolve an active `/` or `@` trigger, but only when it opens its own token.
 *
 * The previous implementation was purely positional (`lastIndexOf` plus a check
 * that no space followed), so pasting `https://x.com/pricing` opened an empty
 * command palette across the composer and `me@corp.com` opened the agent
 * palette. A trigger is only a trigger at the first character of the current
 * whitespace-delimited token.
 */
function detectTrigger(v: string): TriggerMatch | null {
  let tokenStart = 0;
  for (let i = v.length - 1; i >= 0; i--) {
    const ch = v[i];
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
      tokenStart = i + 1;
      break;
    }
  }
  const token = v.slice(tokenStart);
  const first = token.charAt(0);
  if (first !== '/' && first !== '@') return null;
  return { kind: first === '/' ? 'slash' : 'mention', query: token.slice(1), start: tokenStart };
}

function monogram(raw: string): string {
  return raw
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();
}

export function ChatComposer(props: ChatComposerProps): JSX.Element {
  const {
    value,
    onChange,
    onSubmit,
    onStop,
    busy,
    commands,
    commandsState,
    commandsError,
    mentionTargets,
    selectedAgent,
    onSelectAgent,
    attachment,
    onAttachment,
    maxLength,
    persistenceError,
    inputRef,
    selectedSquad,
    onToggleSquadAgent,
  } = props;

  const [popup, setPopup] = useState<PopupState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /** Set the moment the turn is handed over, cleared when the run settles, so
   *  the live region can tell "submitting" apart from "answering". */
  const [awaitingSubmit, setAwaitingSubmit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // `React.RefObject.current` is readonly in @types/react 18 and the parent owns
  // this ref (it focuses it on Cmd+J), so the write needs one widening cast.
  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      if (inputRef) (inputRef as { current: HTMLTextAreaElement | null }).current = el;
    },
    [inputRef],
  );

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const listboxId = `chat-composer-${uid}-listbox`;
  const hintId = `chat-composer-${uid}-hint`;
  const agentSelectId = `chat-composer-${uid}-agent`;
  const optionId = (i: number): string => `chat-composer-${uid}-option-${i}`;

  const popupKind = popup ? popup.kind : null;
  const query = popup ? popup.query : '';
  const lowered = query.toLowerCase();

  // Both fields must be lowercased: the old filter lowercased `desc` but
  // compared `trigger` raw, so `/ORG` never matched `/organize`.
  const filteredCommands = useMemo(
    () =>
      lowered
        ? commands.filter(
            (c) =>
              c.trigger.toLowerCase().includes(lowered) || c.desc.toLowerCase().includes(lowered),
          )
        : commands,
    [commands, lowered],
  );

  const filteredAgents = useMemo(
    () =>
      lowered
        ? mentionTargets.filter(
            (m) =>
              m.name.toLowerCase().includes(lowered) || m.mission.toLowerCase().includes(lowered),
          )
        : mentionTargets,
    [mentionTargets, lowered],
  );

  const count = popupKind === 'slash' ? filteredCommands.length : filteredAgents.length;
  const hasOptions = popup !== null && count > 0;
  const activeIndex = popup ? popup.activeIndex : -1;
  const activeId = hasOptions && activeIndex >= 0 ? optionId(activeIndex) : undefined;

  // An ARIA combobox may only report `expanded`/`aria-controls` when it truly
  // controls a listbox. The loading/error/empty render is a plain status line
  // instead, so the combobox stays collapsed and that line announces itself.
  //
  // `commandsState` gates this as well as `hasOptions`, matching the precedence
  // `statusLine` already uses a few lines below and that `ChatEmptyState` uses for
  // the same data. Without the gate, a retained non-empty `commands` array renders a
  // stale listbox while a failed load is reported nowhere — the palette looks
  // authoritative and the user is told nothing.
  const listboxActive = hasOptions && (popup?.kind === 'mention' || commandsState === 'ready');

  const statusLine = ((): string | null => {
    if (!popup) return null;
    if (popup.kind === 'mention') return hasOptions ? null : `No agent matches “${query}”.`;
    if (commandsState === 'loading') return 'Loading commands…';
    if (commandsState === 'error') return commandsError || 'Agent commands are unavailable.';
    if (commands.length === 0) return 'No commands published for this workspace.';
    return hasOptions ? null : `No command matches “${query}”.`;
  })();

  const countAnnouncement =
    hasOptions && popup
      ? `${count} ${popup.kind === 'slash' ? 'commands' : 'agents'} available`
      : '';

  // The value can change from outside `handleInput` (edit-and-resend, a clear
  // from the transcript); a stale popup would then splice at the wrong index.
  useEffect(() => {
    if (!popup) return;
    const t = detectTrigger(value);
    if (!t || t.start !== popup.start) setPopup(null);
  }, [value, popup]);

  useEffect(() => {
    if (awaitingSubmit && !busy) setAwaitingSubmit(false);
  }, [awaitingSubmit, busy]);

  // Auto-grow on every value change, not only on user input: committing a slash
  // command or a mention also rewrites the text and must resize the field.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [value]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const length = value.length;
  const atLimit = maxLength > 0 && length >= maxLength;
  const nearLimit = maxLength > 0 && length >= maxLength * 0.9;
  const canSend = (value.trim().length > 0 || attachment !== null) && !atLimit;

  const handleInput = (v: string): void => {
    onChange(v);
    const t = detectTrigger(v);
    setPopup(t ? { kind: t.kind, query: t.query, start: t.start, activeIndex: 0 } : null);
  };

  const commit = (index: number): void => {
    if (!popup) return;
    const start = popup.start <= value.length ? popup.start : value.length;
    if (popup.kind === 'slash') {
      const c = filteredCommands[index];
      if (!c) return;
      onChange(`${value.slice(0, start)}${c.trigger} `);
      if (c.agent) onSelectAgent(c.agent);
    } else {
      const a = filteredAgents[index];
      if (!a) return;
      onChange(`${value.slice(0, start)}@${a.name} `);
      onSelectAgent(a.name);
    }
    setPopup(null);
    textareaRef.current?.focus();
  };

  const submit = (): void => {
    if (!canSend) return;
    setAwaitingSubmit(true);
    setPopup(null);
    onSubmit();
  };

  const moveActive = (delta: number): void => {
    if (!popup || !hasOptions) return;
    setPopup({ ...popup, activeIndex: (popup.activeIndex + delta + count) % count });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (listboxActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && activeIndex >= 0) {
        e.preventDefault();
        commit(activeIndex);
        return;
      }
    }
    if (e.key === 'Escape' && popup) {
      e.preventDefault();
      setPopup(null);
      textareaRef.current?.focus();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const agentOptions = useMemo((): MentionTarget[] => {
    const merged = new Map<string, string>();
    if (!mentionTargets.some((m) => m.name === 'auto')) merged.set('auto', 'Auto routing');
    for (const m of mentionTargets) merged.set(m.name, m.mission);
    // The parent's selection can outlive the catalog it came from (agent removed
    // upstream); an unmatched value renders the select as blank.
    if (selectedAgent && !merged.has(selectedAgent)) merged.set(selectedAgent, 'Selected agent');
    return [...merged.entries()].map(([name, mission]) => ({ name, mission }));
  }, [mentionTargets, selectedAgent]);

  const rowClasses = (isActive: boolean): string =>
    `flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors motion-reduce:transition-none ${
      isActive ? 'bg-primary/10' : 'bg-transparent hover:bg-surface-hover'
    }`;

  const badgeClasses =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-hover font-mono text-2xs text-text-secondary';

  return (
    <div className="shrink-0 border-t border-border/40 bg-background pb-[env(safe-area-inset-bottom,0px)]">
      {/* Bottom padding must clear the iOS home indicator, otherwise the send
          button sits underneath it. `env()` has no design-token equivalent, so
          this arbitrary value is deliberate. */}
      <div className="mx-auto w-full max-w-[768px] px-4 py-3 md:px-6">
        {persistenceError ? (
          <div
            role="status"
            className="mb-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning"
          >
            {persistenceError}
          </div>
        ) : null}

        <p role="status" className="sr-only">
          {countAnnouncement}
        </p>

        {popup ? (
          <div className="mb-2 overflow-hidden rounded-xl border border-border/50 bg-surface shadow-lg">
            {listboxActive && popup.kind === 'slash' ? (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Slash commands"
                className="max-h-[220px] overflow-y-auto"
              >
                {filteredCommands.map((c, i) => (
                  <div
                    key={`${c.trigger}-${c.agent}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      // Keep the caret in the textarea; a bare click would blur it.
                      e.preventDefault();
                      commit(i);
                    }}
                    onMouseEnter={() => setPopup((p) => (p ? { ...p, activeIndex: i } : p))}
                    className={rowClasses(i === activeIndex)}
                  >
                    <span className={badgeClasses}>{monogram(c.trigger)}</span>
                    <span className="shrink-0 font-mono text-sm text-text">{c.trigger}</span>
                    <span className="truncate text-xs text-text-dim">{c.desc}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {listboxActive && popup.kind === 'mention' ? (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Agents"
                className="max-h-[220px] overflow-y-auto"
              >
                {filteredAgents.map((a, i) => (
                  <div
                    key={a.name}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(i);
                    }}
                    onMouseEnter={() => setPopup((p) => (p ? { ...p, activeIndex: i } : p))}
                    className={rowClasses(i === activeIndex)}
                  >
                    <span className={badgeClasses}>{monogram(a.name)}</span>
                    <span className="shrink-0 text-sm text-text">@{a.name}</span>
                    <span className="truncate text-xs text-text-dim">{a.mission}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {!listboxActive ? (
              <p role="status" className="px-3 py-2.5 text-xs text-text-dim">
                {statusLine}
              </p>
            ) : null}
          </div>
        ) : null}

        {attachment ? (
          <div className="mb-2 flex items-center gap-2 rounded-full border border-border/50 bg-surface px-3 py-1.5 text-xs">
            <span className="truncate">{attachment.name}</span>
            <button
              type="button"
              onClick={() => onAttachment(null)}
              className="ml-auto rounded p-0.5 text-text-dim transition-colors hover:bg-surface-hover hover:text-text motion-reduce:transition-none"
              aria-label="Remove attached file"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ) : null}

        {selectedSquad && selectedSquad.length > 0 && (
          <div className="mb-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-mono text-text-dim">Squad:</span>
            {selectedSquad.map((agentId) => (
              <span
                key={agentId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-action/10 text-action border border-action/30"
              >
                <span>@{agentId}</span>
                {onToggleSquadAgent && (
                  <button
                    type="button"
                    onClick={() => onToggleSquadAgent(agentId)}
                    className="hover:opacity-75 text-[10px]"
                    aria-label={`Remove @${agentId} from squad`}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {value.trim().length === 0 && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              {
                label: '🎯 Tailor Resume',
                prompt: '/tailor-resume Staff Distributed Systems Engineer',
              },
              {
                label: '🔍 Audit ATS Score',
                prompt: '/ats-audit Evaluate ATS parseability and keywords',
              },
              {
                label: '💼 Discover Verified Jobs',
                prompt: '/job-radar Senior Full-Stack Engineer remote',
              },
              {
                label: '💬 Behavioral STAR Prep',
                prompt: '/star-prep Conflict resolution with engineering leadership',
              },
            ].map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={() => {
                  onChange(pill.prompt);
                  textareaRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-border/60 bg-surface-100/80 px-2.5 py-1 text-[11px] text-text-dim hover:border-action/50 hover:bg-surface-200 hover:text-text transition-all"
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        <div
          className={`flex items-end gap-2 rounded-[24px] border bg-surface px-2 py-2 transition-colors motion-reduce:transition-none ${
            dragOver ? 'border-primary ring-2 ring-primary/20' : 'border-border/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            // Drag events fire for every descendant; only clear when the
            // pointer genuinely leaves the pill.
            if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))
              return;
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) onAttachment(f);
          }}
        >
          {/* A real button, not a <label>: the native file input is display:none,
              so a wrapping <label> exposes no accessible name at all and an
              aria-label on it is prohibited (WCAG 4.1.2). The button carries the
              name and drives the hidden input, keeping pointer and keyboard users
              in the tab order. */}
          <input
            ref={fileInputRef}
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            onChange={(e) => onAttachment(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent text-text-dim transition-colors hover:border-border/50 hover:bg-background hover:text-text motion-reduce:transition-none"
            aria-label="Attach file"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <textarea
            ref={setTextareaRef}
            aria-label="Chat message"
            role="combobox"
            aria-expanded={listboxActive}
            aria-controls={listboxActive ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-describedby={hintId}
            value={value}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              // Deliberately no preventDefault: a clipboard can hold an image
              // and text at once and dropping the text would lose the words.
              const f = e.clipboardData.files[0];
              if (f) onAttachment(f);
            }}
            rows={1}
            maxLength={maxLength}
            placeholder={
              selectedAgent === '' || selectedAgent === 'auto'
                ? 'Ask anything…'
                : `Message @${selectedAgent}`
            }
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-2 text-sm placeholder:text-text-dim focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              aria-label="Stop generation"
              title="Stop generating"
              onClick={onStop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error text-error-fg transition-opacity hover:opacity-90 motion-reduce:transition-none"
            >
              <span className="h-2.5 w-2.5 rounded-xs bg-current" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send message"
              onClick={submit}
              disabled={!canSend}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action text-action-fg transition-colors hover:bg-action-hover disabled:opacity-40 motion-reduce:transition-none"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 sm:justify-center">
          <label htmlFor={agentSelectId} className="sr-only">
            Active agent
          </label>
          <select
            id={agentSelectId}
            value={selectedAgent}
            onChange={(e) => onSelectAgent(e.target.value)}
            className="w-32 shrink cursor-pointer rounded-lg border border-border/50 bg-surface-200 px-2 py-1 text-xs text-text transition-colors hover:border-border motion-reduce:transition-none sm:w-auto"
          >
            {agentOptions.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name === 'auto' ? 'auto' : `@${a.name}`}
              </option>
            ))}
          </select>
          {/* The wrapper stays rendered at every breakpoint: a `hidden` element
              is dropped from the accessibility tree, so `aria-describedby` would
              resolve to nothing on a phone. */}
          <div id={hintId} className="text-xs text-text-dim">
            <span className="hidden sm:inline">
              <span aria-hidden="true">⏎</span> send
              <span className="sr-only">Enter sends your message.</span>
              {' · '}
              <span aria-hidden="true">⇧⏎</span> newline
              <span className="sr-only">Shift plus Enter inserts a line break.</span>
              {' · '}
              <span className="font-mono">@</span> agents · <span className="font-mono">/</span>{' '}
              commands
            </span>
          </div>
          <span
            aria-live={nearLimit ? 'polite' : undefined}
            className={`shrink-0 font-mono text-xs ${nearLimit ? 'text-error' : 'text-text-dim'}`}
          >
            ~{Math.max(0, Math.ceil(length / 3.8))} tok · {length}/{maxLength}
          </span>
        </div>

        {/* The stop button is a shape, not a state announcement. */}
        <p role="status" className="sr-only">
          {busy ? (awaitingSubmit ? 'Sending your message' : 'The assistant is responding') : ''}
        </p>
      </div>
    </div>
  );
}
