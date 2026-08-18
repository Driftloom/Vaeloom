import React from 'react';

interface RadioProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Radio({ name, value, checked, onChange, label, disabled = false, id }: RadioProps) {
  const generatedId = React.useId();
  const radioId = id ?? generatedId;

  return (
    <label htmlFor={radioId} className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="radio"
        id={radioId}
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="h-4 w-4 border-border text-primary focus:ring-primary focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed bg-surface"
      />
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  );
}
