/**
 * WCAG 2.5.8 (Target Size Minimum, AA) requires every pointer target to be at
 * least 24x24 CSS pixels. Icon-only controls are the usual offenders because
 * their rendered size is the icon, not the hit area.
 *
 * Apply this alongside the visual size rather than growing the glyph: `min-h-6
 * min-w-6` is 24px in Tailwind's 0.25rem scale and does not affect layout of
 * the icon inside.
 */
export const MIN_TOUCH_TARGET = 'min-h-6 min-w-6';
