'use client';

import React, { useRef, useEffect } from 'react';
import { Button } from '../Button';
import { ArrowUpIcon } from '../../icons';

export interface ChatComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  contextPills?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask anything or type / for agents...',
  disabled = false,
  loading = false,
  contextPills,
  actions,
  className = '',
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea height based on content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !loading) {
        onSubmit();
      }
    }
  };

  return (
    <div
      className={`rounded-card border border-border bg-surface shadow-card transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 ${className}`}
    >
      {contextPills && (
        <div className="px-3 pt-2.5 flex items-center gap-1.5 flex-wrap border-b border-border/40 pb-2">
          {contextPills}
        </div>
      )}

      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none resize-none min-h-[44px] max-h-[180px] leading-relaxed"
          aria-label="Message prompt input"
        />

        <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border/40">
          <div className="flex items-center gap-2 text-xs text-text-dim">
            {actions || (
              <span>
                Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            disabled={!value.trim() || disabled || loading}
            onClick={onSubmit}
            className="rounded-full w-8 h-8 p-0 flex items-center justify-center shrink-0"
            aria-label="Send message"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowUpIcon size={16} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
