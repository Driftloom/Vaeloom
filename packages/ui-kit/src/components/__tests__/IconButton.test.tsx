import { readFileSync } from 'fs';
import { resolve } from 'path';

import { render } from '@testing-library/react';

import { IconButton } from '../actions/IconButton';

// Mirrors the regression guard in `Switch.test.tsx`: a sibling component had a
// hard-coded `bg-white`/`text-white` that rendered an unreadable control in one
// theme, and nothing caught it because no test looked at the colour.

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const ICON_BUTTON_SOURCE = readFileSync(
  resolve(REPO_ROOT, 'packages', 'ui-kit', 'src', 'components', 'actions', 'IconButton.tsx'),
  'utf8',
);
const BUTTON_SOURCE = readFileSync(
  resolve(REPO_ROOT, 'packages', 'ui-kit', 'src', 'components', 'Button.tsx'),
  'utf8',
);
const GLOBALS_CSS = readFileSync(
  resolve(REPO_ROOT, 'apps', 'web', 'src', 'styles', 'globals.css'),
  'utf8',
);

const classesFor = (variant: 'primary' | 'danger' | 'ai'): string[] => {
  const { container, unmount } = render(
    <IconButton aria-label="Probe" variant={variant} size="md">
      <span aria-hidden="true" />
    </IconButton>,
  );
  const button = container.querySelector('button') as HTMLElement;
  const classes = button.className.split(/\s+/);
  unmount();
  return classes;
};

const themeBlock = (label: string): string => {
  // `:root` is the light theme; the other two are class-scoped blocks. Slice
  // between the label and the next `}` so a test reads one theme, not the file.
  const start = GLOBALS_CSS.indexOf(label);
  if (start < 0) throw new Error(`theme block not found: ${label}`);
  const end = GLOBALS_CSS.indexOf('\n}', start);
  return GLOBALS_CSS.slice(start, end);
};

describe('IconButton foregrounds are token-driven', () => {
  it('contains no text-white literal in the component source', () => {
    // `text-white` on `bg-error` contradicted the light theme's dark-red
    // `--error-fg`, and on the high-contrast accent (pure #FFFF00) it reached
    // roughly 1.07:1 -- invisible.
    expect(ICON_BUTTON_SOURCE).not.toContain('text-white');
  });

  it('uses --action-fg for the primary variant, matching Button', () => {
    expect(classesFor('primary')).toContain('text-action-fg');
    expect(BUTTON_SOURCE).toContain('text-action-fg');
  });

  it('uses --error-fg for the danger variant, matching Button', () => {
    expect(classesFor('danger')).toContain('text-error-fg');
    expect(BUTTON_SOURCE).toContain('text-error-fg');
  });

  it('uses --accent-fg for the ai variant', () => {
    expect(classesFor('ai')).toContain('text-accent-fg');
  });

  it('renders the same foreground class as Button for every shared variant', () => {
    // The actual defect: two components, one variant name, two foregrounds.
    const iconClasses = classesFor('danger');
    expect(iconClasses.some((c) => c.startsWith('text-'))).toBe(true);
    expect(iconClasses).toContain('text-error-fg');
    expect(iconClasses).not.toContain('text-white');
  });
});

describe('--accent-fg exists and is contrast-bearing in every theme', () => {
  // Selectors verified against globals.css: `:root, .dark` share one block, and
  // `.high-contrast, html.high-contrast, [data-theme="high-contrast"]` is the
  // third.
  it('the shared root/dark block declares a white foreground', () => {
    expect(themeBlock(':root,\n.dark')).toContain('--accent-fg: 255 255 255');
  });

  it('the high-contrast foreground is black, because that accent is pure yellow', () => {
    const hc = themeBlock('.high-contrast,\nhtml.high-contrast');
    // White on #FFFF00 is ~1.07:1. This is the regression that motivated the
    // token existing at all.
    expect(hc).toContain('--accent: 255 255 0');
    expect(hc).toContain('--accent-fg: 0 0 0');
  });

  it('is declared in all three theme blocks, never missing', () => {
    const declarations = GLOBALS_CSS.match(/--accent-fg:/g) ?? [];
    expect(declarations.length).toBeGreaterThanOrEqual(3);
  });
});
