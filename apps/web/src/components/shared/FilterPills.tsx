'use client';

import React from 'react';

export interface FilterPillOption {
  value: string;
  label: string;
}

interface FilterPillsProps {
  options: FilterPillOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the group for assistive tech — a row of filters is not self-describing. */
  ariaLabel: string;
  className?: string;
}

/**
 * Single-select filter pill row.
 *
 * The row was copy-pasted byte-identically into email/search/tasks, and a fourth
 * near-copy in career. The copies drifted: the email/search/tasks variant built
 * the active pill from `bg-action text-white` while career used the same raw
 * pair, so none of them used the app's `btn-primary` alias. The group is a
 * single-select toolbar, not a set of independent controls, so it renders as
 * `role="group"` with `aria-pressed` per option rather than a listbox — the
 * options stay individually focusable and announce their selected state.
 */
export function FilterPills({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: FilterPillsProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? 'btn-primary px-3 py-1 rounded-full text-xs font-medium'
                : 'bg-surface-200 text-text-secondary hover:text-text px-3 py-1 rounded-full text-xs font-medium transition-colors'
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
