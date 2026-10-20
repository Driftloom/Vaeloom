/**
 * Memory-area design-token guardrail.
 *
 * Static scan over the Memory + Vault-Sync surfaces. These files shipped with
 * ~447 Tailwind classes referencing `var(--color-*)` custom properties that
 * exist only in `design/tokens/*.json` — never emitted into CSS — plus raw hex
 * colours in the graph palette and `text-white` on light fills. Every one of
 * them rendered as nothing (or wrong), and none of them can fail a rendering
 * test: the CSS is simply absent.
 *
 * Bans, inside `app/workspace/[workspaceId]/memory/**` and `components/memory/**`
 * (test files excluded — honesty tests name phantom strings as negative
 * fixtures):
 *   1. `var(--color-*)` except the allowlisted `--color-focus-ring`, which is
 *      really defined in `globals.css` and really used by keyboard rings.
 *   2. Raw `#RGB` / `#RRGGBB` / `#RRGGBBAA` inside any string literal — the
 *      graph palette lives in const maps and `fill=`/`stroke=` attribute
 *      strings, not only in `className`/`style`.
 *   3. Numeric `rgb(` / `rgba(` — the only legal form is `rgb(var(--token))`.
 *
 * Deliberately RED on the 2026-10-18 tree (fail-before evidence); must be GREEN
 * after Wave 1 of `docs/superpowers/plans/2026-10-18-memory-sync-production-overhaul.md`.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const REPO = resolve(__dirname, '..', '..', '..', '..');
const SRC = join(REPO, 'apps', 'web', 'src');

const SCAN_ROOTS = [
  join(SRC, 'app', 'workspace', '[workspaceId]', 'memory'),
  join(SRC, 'components', 'memory'),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = SCAN_ROOTS.flatMap((root) => walk(root));
const rel = (f: string) => f.slice(REPO.length + 1).replace(/\\/g, '/');

const read = (f: string) => readFileSync(f, 'utf8');

/** Block comments stripped, `//` line comments stripped unless part of `://`. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** `#fff` / `#818cf8` / `#818cf880`; alternation strict so `#1584` is not a hit. */
const HEX_IN_STRING = /(["'`])[^"'`\n]*#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

describe('memory-area design tokens', () => {
  it('has files to scan', () => {
    // Guard the guard: an empty scan would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(15);
  });

  it('uses no phantom var(--color-*) other than the focus-ring allowlist', () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of read(f).matchAll(/var\(--color-(?!focus-ring)[\w-]*\)/g)) {
        offenders.push(`${rel(f)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses no raw hex colours in string literals (class maps, attrs, styles)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const text = stripComments(read(f));
      for (const m of text.matchAll(HEX_IN_STRING)) {
        const hex = m[0].slice(m[0].indexOf('#'));
        offenders.push(`${rel(f)}: ${hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses no numeric rgb()/rgba() (only rgb(var(--token)) is legal)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of read(f).matchAll(/\brgba?\(\s*\d/g)) {
        offenders.push(`${rel(f)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
