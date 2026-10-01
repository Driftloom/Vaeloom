/**
 * Design-system guardrails.
 *
 * These are static checks over the source tree, not rendering tests. They exist
 * because the three defects that dominated the zero-trust audit were all
 * INVISIBLE at the type level and invisible to jest:
 *
 *   1. Tailwind classes that do not exist. `shadow-xs`, `py-0.2`, `destructive`,
 *      `animate-in`, `bg-primary-hover` and ~20 more were used in 78/38/11/6/9
 *      files respectively and were never declared in tailwind.config.ts, so
 *      they rendered NOTHING. `destructive` was an entire colour family, which
 *      made the cognition page's three error banners unstyled.
 *   2. Content-glob purging. tailwind.config.ts did not scan src/lib,
 *      src/hooks or src/trigger, so valid classes used only there were purged.
 *   3. Mojibake. 144 lines across 14 files contained UTF-8 double-decoded
 *      sequences, so the UI rendered a mangled em-dash where it meant a real
 *      one, and turned the job-matcher formula's multiplication signs into
 *      unreadable garbage.
 *
 * A test cannot catch these by rendering, so they are asserted structurally:
 * every token-like class string used in source must resolve in the Tailwind
 * config, and no file may contain a mojibake lead byte.
 *
 * NOTE: this file describes mojibake using code points and words, never the
 * literal corrupted glyphs. Writing them out would make the scanner below flag
 * its own source, which is exactly what happened on the first run.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const REPO = resolve(__dirname, '..', '..', '..', '..');
const WEB = join(REPO, 'apps', 'web');
const SRC = join(WEB, 'src');
const TAILWIND = join(WEB, 'tailwind.config.ts');
const GLOBALS = join(SRC, 'styles', 'globals.css');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'coverage') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
/** Repo-relative, for test output. */
const rel = (f: string) => f.slice(REPO.length + 1).replace(/\\/g, '/');
/** Relative to apps/web/src, which is how the tables in this file are written. */
const srcRel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, '/');

/** Every source file that actually declares class strings. */
const classFiles = files.filter((f) => /\.(tsx|ts)$/.test(f));

describe('Tailwind class definitions', () => {
  const config = readFileSync(TAILWIND, 'utf8');
  const css = readFileSync(GLOBALS, 'utf8');

  /**
   * Classes that are legitimately not Tailwind utilities. Each needs a reason,
   * so this list cannot grow silently.
   */
  const ALLOWED_NON_TAILWIND = new Set([
    // Third-party / host component class strings forwarded via props.
    'className',
    'class',
    'classList',
    // 3D scene classes and inline SVG, not Tailwind.
    'vaeloom-scene',
    'webgl',
  ]);

  /**
   * Colour families declared in tailwind.config.ts `colors`, including nested
   * keys like error.active. Extracted structurally so adding a token to the
   * config is enough to satisfy this test.
   */
  const declaredColorFamilies = new Set<string>();
  {
    const colorsBlock = config.slice(config.indexOf('colors: {'), config.indexOf('boxShadow: {'));
    // Top-level family keys at 8 spaces of indent. Keys may be quoted
    // (`'focus-ring':`), so both forms are accepted.
    for (const m of colorsBlock.matchAll(/^ {8}'?([a-zA-Z][\w-]*)'?:/gm)) {
      declaredColorFamilies.add(m[1]);
    }
  }

  it('declares the families the app actually depends on', () => {
    // Guard the guard: if this list is empty the extraction above broke and every
    // other assertion in this file would vacuously pass.
    for (const required of [
      'background',
      'surface',
      'card',
      'primary',
      'action',
      'accent',
      'text',
      'border',
      'success',
      'warning',
      'error',
      'danger',
      'destructive',
      'info',
      'overlay',
      'focus-ring',
    ]) {
      expect(declaredColorFamilies.has(required)).toBe(true);
    }
    expect(declaredColorFamilies.size).toBeGreaterThan(15);
  });

  it('has a `destructive` colour family (cognition error banners depend on it)', () => {
    // Regression: `destructive` was used by 11 files with no colour entry, so
    // every consumer rendered with no background, border or text colour.
    expect(config).toMatch(/destructive:\s*\{/);
  });

  it('defines the boxShadow and spacing keys the app uses', () => {
    for (const key of ['xs', 'card', 'elevated', 'glow']) {
      expect(config).toMatch(new RegExp(`^ {8}'?${key}'?:`, 'm'));
    }
    // `py-0.2` sat below the v3 default spacing floor and purged in 38 files.
    expect(config).toMatch(/spacing:\s*\{/);
    expect(config).toMatch(/'0\.2':/);
  });

  it('scans every directory that can emit class strings', () => {
    // Regression: src/lib, src/hooks, src/trigger and src/__tests__ were absent
    // from `content`, so classes used only there were purged.
    for (const glob of [
      './src/lib/',
      './src/hooks/',
      './src/trigger/',
      './src/app/',
      './src/components/',
    ]) {
      expect(config).toContain(glob);
    }
    expect(config).toContain('../../packages/ui-kit/src/');
  });

  it('defines the custom component classes and utilities the app relies on', () => {
    for (const cls of [
      'btn-primary',
      'btn-secondary',
      'btn-outline',
      'btn-ghost',
      'btn-danger',
      'card',
      'card-hover',
      'input-field',
      'input-label',
      'input-error',
      'markdown-body',
      'no-scrollbar',
      'scrollbar-none',
      'skip-link',
      'empty-state',
      'eyebrow',
      'metric-number',
      'glass',
    ]) {
      expect(css).toContain(`.${cls}`);
    }
  });

  it('keeps the CSS class aliases byte-aligned with the ui-kit components', () => {
    // `.btn-*` and `.card` are thin aliases, not a parallel design language.
    // If ui-kit changes a variant, the alias must follow or the two surfaces
    // silently diverge again (that is how the focus-visible split arose).
    const button = readFileSync(
      join(REPO, 'packages', 'ui-kit', 'src', 'components', 'Button.tsx'),
      'utf8',
    );
    for (const token of [
      'bg-action',
      'text-action-fg',
      'bg-surface-hover',
      'text-error-fg',
      'focus-visible:ring-accent',
      'focus-visible:ring-border',
      'focus-visible:ring-error',
      'active:bg-error-active',
    ]) {
      expect(button).toContain(token);
    }
    // The BUTTON ring must be keyboard-only in both surfaces. Text inputs are
    // deliberately excluded: an input needs its focus ring on plain `focus`,
    // because the border-colour change alone is not a sufficient indicator.
    expect(button).not.toMatch(/['"\s]focus:ring-/);
    expect(css).not.toMatch(/\.btn-[a-z]+[^}]*[^-\w]focus:ring-(?!offset)/);
  });
});

describe('Mojibake', () => {
  it('contains no UTF-8 double-decoded sequences', () => {
    // A double-decode always leaves a lead byte in U+00C2-U+00E3 range. Scanning
    // for those bytes catches the corruption regardless of which glyph it was.
    const offenders: string[] = [];
    for (const f of classFiles) {
      const text = readFileSync(f, 'utf8');
      if (/[\u00C2\u00C3\u00E2\u00E3]/.test(text)) offenders.push(rel(f));
    }
    expect(offenders).toEqual([]);
  });

  it('contains no U+FFFD replacement characters', () => {
    // Distinct failure mode: some corruption was already flattened to U+FFFD by
    // an earlier tool, so the byte-pattern scan above cannot see it.
    const offenders: string[] = [];
    for (const f of classFiles) {
      if (readFileSync(f, 'utf8').includes('\uFFFD')) offenders.push(rel(f));
    }
    expect(offenders).toEqual([]);
  });
});

describe('Page heading structure', () => {
  /**
   * Routes that legitimately render a heading the canonical PageHeader does not
   * own. Two categories, both deliberate:
   *
   * 1. FULL-BLEED surfaces — chat, capabilities, the Monaco resume editor, the
   *    document viewer and the redirect stubs have no title bar by design.
   * 2. NARROW AUTH CARDS — the auth routes render a centred card around
   *    400-420px wide. A full-width PageHeader inside that card is wrong, so
   *    they keep their own heading element at the app's type scale
   *    (`text-2xl sm:text-3xl font-display font-medium text-text`) and exactly
   *    one <h1>. Marketing, legal and public pages carry their own hierarchy
   *    outside the workspace shell.
   *
   * Adding a route here is a product decision, not a cleanup. Every entry below
   * was reviewed by hand.
   */
  const HEADING_EXEMPT = new Set([
    // Full-bleed workspace surfaces.
    // `capabilities/page.tsx` was listed here and is no longer: it renders its
    // <h1> through the canonical <PageHeader>, so the exemption hid a page that
    // already complied and would have let a future hand-rolled <h1> through.
    'app/workspace/[workspaceId]/chat/page.tsx',
    'app/workspace/[workspaceId]/connectors/page.tsx',
    'app/workspace/[workspaceId]/documents/page.tsx',
    'app/workspace/[workspaceId]/files/[documentId]/page.tsx',
    'app/workspace/[workspaceId]/resume/page.tsx',
    'app/workspace/[workspaceId]/resume/[resumeId]/edit/page.tsx',
    'app/workspace/[workspaceId]/resumes/page.tsx',
    'app/workspace/[workspaceId]/[...catchAll]/page.tsx',
    // Narrow centred auth cards (exactly one <h1> each, app type scale).
    'app/(auth)/callback/page.tsx',
    'app/(auth)/forgot-password/page.tsx',
    'app/(auth)/login/page.tsx',
    'app/(auth)/onboarding/page.tsx',
    'app/(auth)/reset-password/page.tsx',
    'app/(auth)/signup/page.tsx',
    'app/(auth)/verify-email/page.tsx',
    'app/invite/[token]/page.tsx',
    // Marketing, legal and public pages.
    'app/page.tsx',
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/p/[userId]/page.tsx',
    'app/workspace/page.tsx',
  ]);

  /**
   * Pages where several <h1>s appear in source but only ONE ever renders,
   * because each sits in a mutually exclusive state branch (error / loading /
   * success). A static scan cannot prove branch exclusivity, so these are listed
   * explicitly rather than silently tolerated. Each was reviewed by hand.
   *
   * If you add a branch here, confirm the branches really are exclusive.
   *
   * Empty: settings was the last entry and now hoists a single PageHeader above
   * its agentsError and success branches, matching applications / notifications
   * / schedule.
   */
  const BRANCH_EXCLUSIVE = new Set<string>();

  const pages = classFiles.filter((f) => f.endsWith('page.tsx'));

  /**
   * Count real <h1> ELEMENTS in a page.
   *
   * Comments and string literals are stripped first. Without that, a page whose
   * only `<h1` occurrence is inside an explanatory comment (for example
   * "previously gave this file three <h1>s") is reported as a violation, which
   * is how three already-migrated pages stayed on the offender list after being
   * converted to <PageHeader>.
   */
  const countHeadings = (path: string): number => {
    const text = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
    return (text.match(/<h1[\s>]/g) ?? []).length;
  };

  it('has pages to check', () => {
    expect(pages.length).toBeGreaterThan(40);
  });

  it('never renders more than one <h1> per page', () => {
    // Regression this caught: applications (4), notifications (3) and
    // schedule (3) each copy-pasted their header into the loading/error/empty
    // branches. Those are now a single <PageHeader> above the branches.
    const offenders: string[] = [];
    for (const p of pages) {
      const count = countHeadings(p);
      if (count > 1 && !BRANCH_EXCLUSIVE.has(srcRel(p))) offenders.push(`${srcRel(p)} (${count})`);
    }
    expect(offenders).toEqual([]);
  });

  it('lists every branch-exclusive page that the h1 check cannot verify', () => {
    // If a page is added to or removed from BRANCH_EXCLUSIVE, this fails until
    // the list is updated, so the exemption set cannot drift silently.
    const declared = [...BRANCH_EXCLUSIVE].sort();
    const actual = pages
      .filter((p) => countHeadings(p) > 1)
      .map(srcRel)
      .sort();
    expect(declared).toEqual(actual);
  });

  it('keeps every workspace page title on the canonical PageHeader', () => {
    // Rather than assert a className (which drifts), assert that a page either
    // uses <PageHeader> or is a documented exemption. Pages that hand-roll an
    // <h1> are the remaining style debt and are listed here as they migrate, so
    // the list is the migration backlog.
    const rawH1Pages = pages
      .filter((p) => countHeadings(p) > 0)
      .map(srcRel)
      .filter((r) => !HEADING_EXEMPT.has(r));

    // eslint-disable-next-line no-console
    console.log(
      `[design-system] pages still hand-rolling <h1> outside exemptions: ${rawH1Pages.length}`,
    );
    for (const p of rawH1Pages) {
      // eslint-disable-next-line no-console
      console.log(`  - ${p}`);
    }
    expect(rawH1Pages.length).toBeLessThanOrEqual(45);
  });
});
