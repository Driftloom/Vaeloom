import React from 'react';
import { Switch as UiKitSwitch } from '@vaeloom/ui-kit';

/**
 * App-facing alias for the ui-kit `Switch`.
 *
 * This previously shipped a second switch widget (`h-6 w-11 translate-x-5`,
 * `bg-primary`) with no `MIN_TOUCH_TARGET`, so it rendered a 24x44px hit area
 * against ui-kit's 24px-minimum control. It also named the prop `enabled`
 * instead of `checked`; that name is preserved here so the existing pages keep
 * compiling, but the rendering and the accessibility affordances now come from
 * the single canonical implementation.
 */
export interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({ enabled, onChange, label, disabled, id, className }: ToggleProps) {
  return (
    <UiKitSwitch
      checked={enabled}
      onChange={onChange}
      label={label}
      disabled={disabled}
      id={id}
      className={className}
    />
  );
}
