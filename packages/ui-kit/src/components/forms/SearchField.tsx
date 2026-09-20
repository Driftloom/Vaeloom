import React from 'react';
import { SearchIcon, XIcon } from '../../icons';

export interface SearchFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange'
> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onChange, onClear, placeholder = 'Search...', className = '', ...props }, ref) => {
    return (
      <div className={`relative flex items-center w-full ${className}`.trim()}>
        <div className="absolute left-3 pointer-events-none text-[var(--color-text-muted,#71717a)] flex items-center">
          <SearchIcon size={16} />
        </div>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] pl-9 pr-8 py-1.5 text-sm text-[var(--color-text-primary,#f4f4f5)] placeholder-[var(--color-text-muted,#71717a)] transition-colors hover:border-[var(--color-border-strong,#3f3f46)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#3b82f6)] focus-visible:border-transparent"
          {...props}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            className="absolute right-2.5 text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
    );
  },
);

SearchField.displayName = 'SearchField';
