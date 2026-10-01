'use client';

import React from 'react';

import { MIN_TOUCH_TARGET } from '../layout/touchTarget';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className = '',
}) => {
  const generatedId = React.useId();
  const switchId = id || generatedId;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100 disabled:cursor-not-allowed disabled:opacity-50 ${MIN_TOUCH_TARGET} ${
          checked ? 'bg-action' : 'bg-border-subtle'
        }`}
      >
        {/* The knob cannot be one colour in all three themes, because its two
            tracks pull in opposite directions. `--action` is the same indigo in
            every theme, so a light knob always wins there (`--action-fg` is
            #FFFFFF in all three: 6.3:1). The unchecked `--border-subtle` track
            is near-black in dark but near-white in light and high-contrast, so
            there a dark knob wins. `--switch-knob` (declared in all three theme
            blocks) supplies that resting fill: 17.7:1 in dark, 14.9:1 in light,
            10.3:1 in high-contrast. Both states clear 3:1 against their own
            track, which is the bar WCAG 1.4.11 sets for a control boundary. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4 bg-action-fg' : 'translate-x-0 bg-[rgb(var(--switch-knob))]'
          }`}
        />
      </button>
      {label && (
        // `htmlFor` already forwards a click on the label to the button, so an
        // onClick here fires onChange twice — once for the label, once for the
        // button — and nets to a no-op only by accident. `disabled` is enforced
        // solely by the native attribute on the button, and that same attribute
        // is what suppresses the forwarded click, so the label path and the
        // button path cannot disagree about it.
        <label
          htmlFor={switchId}
          className={`text-sm text-text select-none cursor-pointer ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          {label}
        </label>
      )}
    </div>
  );
};

Switch.displayName = 'Switch';
