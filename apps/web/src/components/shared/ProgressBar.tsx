import React from 'react';
import { Progress as UiKitProgress } from '@vaeloom/ui-kit';

/**
 * Adapter onto the ui-kit `Progress` bar.
 *
 * The prop names diverge from ui-kit's (`color` vs `variant`, and ui-kit's
 * `showValue` defaults to false while this one defaulted to true), so the old
 * names are mapped here rather than breaking every call site. `accent` maps to
 * ui-kit's `ai` variant, which is the same accent fill under a different name.
 */
interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: 'primary' | 'accent' | 'success' | 'warning';
  showValue?: boolean;
  className?: string;
}

const variantMap: Record<
  NonNullable<ProgressBarProps['color']>,
  'primary' | 'success' | 'warning' | 'ai'
> = {
  primary: 'primary',
  accent: 'ai',
  success: 'success',
  warning: 'warning',
};

export function ProgressBar({
  value,
  max,
  label,
  color = 'primary',
  showValue = true,
  className = '',
}: ProgressBarProps) {
  return (
    <UiKitProgress
      value={value}
      max={max}
      label={label}
      showValue={showValue}
      variant={variantMap[color]}
      className={className}
    />
  );
}
