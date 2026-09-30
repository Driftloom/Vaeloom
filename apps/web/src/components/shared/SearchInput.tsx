import React from 'react';
import { SearchField as UiKitSearchField } from '@vaeloom/ui-kit';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * ui-kit's `SearchField` renders `type="search"` before its prop spread, so a
   * caller can still override it. The app previously forced `type="text"`;
   * no consumer depended on that, so it is left to the canonical component.
   */
  type?: 'text' | 'search';
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  type,
  className = '',
}: SearchInputProps) {
  return (
    <UiKitSearchField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      // ui-kit's SearchField has no visible label, so the placeholder alone would
      // leave the input unnamed. This keeps the accessible name the fork had.
      aria-label={placeholder}
      type={type}
      className={className}
    />
  );
}
