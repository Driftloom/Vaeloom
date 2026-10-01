import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

import { render, screen } from '@testing-library/react';

import { Alert } from '../feedback/Alert';

// This package has no `@testing-library/jest-dom` dependency, so assertions are
// written against real DOM properties rather than the `toBeInTheDocument` family.

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const COMPONENTS_DIR = resolve(REPO_ROOT, 'packages', 'ui-kit', 'src', 'components');

/**
 * Tailwind's default palette, by shade number. Every one of these bypasses the
 * token system: no `high-contrast` override, no light-theme retune, and a
 * `-950`/`-200` pair tuned for a completely different canvas.
 */
const DEFAULT_PALETTE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|decoration|divide|outline|shadow|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const componentFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : componentFiles(full);
    }
    return /\.tsx?$/.test(entry) && !entry.endsWith('.d.ts') ? [full] : [];
  });

describe('Alert uses the semantic status tokens, not the Tailwind default palette', () => {
  it('tints every variant with its own status family', () => {
    // Root carries the fill/border/body-text triple; the icon wrapper carries
    // the lighter `-fg` slot, which is the two-tone split the old
    // `text-blue-200` container / `text-blue-400` icon pair provided.
    const expected: Record<string, { root: string[]; icon: string }> = {
      info: { root: ['bg-info/10', 'text-info', 'border-info/30'], icon: 'text-info-fg' },
      success: {
        root: ['bg-success/10', 'text-success', 'border-success/30'],
        icon: 'text-success-fg',
      },
      warning: {
        root: ['bg-warning/10', 'text-warning', 'border-warning/30'],
        icon: 'text-warning-fg',
      },
      danger: { root: ['bg-error/10', 'text-error', 'border-error/30'], icon: 'text-error-fg' },
    };

    for (const [variant, spec] of Object.entries(expected)) {
      const { container, unmount } = render(
        <Alert variant={variant as 'info'} title="Notice" description="Body" />,
      );
      const root = container.firstElementChild as HTMLElement;
      const rootClasses = root.className.split(/\s+/);
      const iconClasses = (root.firstElementChild as HTMLElement).className.split(/\s+/);
      for (const token of spec.root) {
        expect({ variant, token, present: rootClasses.includes(token) }).toEqual({
          variant,
          token,
          present: true,
        });
      }
      expect({ variant, token: spec.icon, present: iconClasses.includes(spec.icon) }).toEqual({
        variant,
        token: spec.icon,
        present: true,
      });
      unmount();
    }
  });

  it('matches the alpha-tinted ramp Badge already uses', () => {
    // Alert and Badge must not be able to drift apart. The shape under test is
    // Badge's: bg-<status>/10, border-<status>/30, text-<status>.
    const badge = readFileSync(join(COMPONENTS_DIR, 'Badge.tsx'), 'utf8');
    for (const status of ['info', 'success', 'warning', 'error']) {
      expect(badge).toContain(`bg-${status}/10 text-${status} border-${status}/30`);
    }
  });

  it('keeps every variant visually distinct', () => {
    const seen = new Map<string, string>();
    for (const variant of ['info', 'success', 'warning', 'danger'] as const) {
      const { container, unmount } = render(<Alert variant={variant} title="Notice" />);
      const cls = (container.firstElementChild as HTMLElement).className;
      expect(seen.has(cls)).toBe(false);
      seen.set(cls, variant);
      unmount();
    }
    expect(seen.size).toBe(4);
  });

  it('has no raw default-palette class anywhere in the kit', () => {
    // Alert was the only offender, but the guard is repo-wide: nothing in the
    // kit may reintroduce a `blue-950`-style class, because it silently opts
    // out of all three theme blocks.
    const files = componentFiles(COMPONENTS_DIR);
    expect(files.length).toBeGreaterThan(30);

    const offenders: Array<{ file: string; match: string }> = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.match(DEFAULT_PALETTE) ?? []) {
        offenders.push({ file: file.replace(`${REPO_ROOT}\\`, ''), match });
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Alert urgency drives the live-region semantics', () => {
  it('announces info and success politely', () => {
    for (const variant of ['info', 'success'] as const) {
      const { container, unmount } = render(<Alert variant={variant} title="Notice" />);
      const root = container.firstElementChild as HTMLElement;
      expect({ variant, role: root.getAttribute('role') }).toEqual({
        variant,
        role: 'status',
      });
      expect({ variant, live: root.getAttribute('aria-live') }).toEqual({
        variant,
        live: 'polite',
      });
      unmount();
    }
  });

  it('interrupts for warning and danger', () => {
    for (const variant of ['warning', 'danger'] as const) {
      const { container, unmount } = render(<Alert variant={variant} title="Notice" />);
      const root = container.firstElementChild as HTMLElement;
      expect({ variant, role: root.getAttribute('role') }).toEqual({
        variant,
        role: 'alert',
      });
      expect({ variant, live: root.getAttribute('aria-live') }).toEqual({
        variant,
        live: 'assertive',
      });
      unmount();
    }
  });

  it('defaults to the polite info variant', () => {
    render(<Alert title="Notice" />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('keeps the urgent variants findable by role=alert', () => {
    // The a11y contract other suites depend on: a danger Alert must still be
    // reachable with getByRole('alert').
    render(<Alert variant="danger" title="Upload failed" description="File type is blocked" />);
    expect(screen.getByRole('alert').textContent).toContain('Upload failed');
  });

  it('still exposes the title, description and dismiss control', () => {
    render(
      <Alert variant="success" title="Saved" description="Draft stored" onClose={jest.fn()} />,
    );
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Draft stored')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss alert' })).toBeTruthy();
  });
});
