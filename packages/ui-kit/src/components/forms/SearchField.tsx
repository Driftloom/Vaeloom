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
        <div className="absolute left-3 pointer-events-none text-text-muted flex items-center">
          <SearchIcon size={16} />
        </div>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border-subtle bg-surface pl-9 pr-8 py-1.5 text-sm text-text placeholder-text-muted transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent"
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
            className="absolute right-2.5 text-text-muted hover:text-text p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
    );
  },
);

SearchField.displayName = 'SearchField';
