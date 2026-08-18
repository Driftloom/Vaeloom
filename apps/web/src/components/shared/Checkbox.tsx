import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Checkbox({ checked, onChange, label, disabled = false, id }: CheckboxProps) {
  const generatedId = React.useId();
  const checkboxId = id ?? generatedId;

  return (
    <label htmlFor={checkboxId} className="inline-flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed bg-surface"
      />
      {label && <span className="text-sm text-text">{label}</span>}
    </label>
  );
}
