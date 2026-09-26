import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { generateCssVariables, TOKEN_SOURCE_OF_TRUTH, tokens, validateTokens } from '../tokens';
import component from '../tokens/component.json';
import primitives from '../tokens/primitives.json';
import semantic from '../tokens/semantic.json';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const GLOBALS_CSS = resolve(REPO_ROOT, 'apps', 'web', 'src', 'styles', 'globals.css');

const declaredNames = (css: string): string[] =>
  [...new Set([...css.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1] as string))].sort();

const referencedNames = (blob: string): string[] =>
  [...new Set([...blob.matchAll(/var\((--[a-zA-Z0-9-]+)/g)].map((m) => m[1] as string))].sort();

describe('Vaeloom Design Token Engine (DS-GATE-03)', () => {
  it('should pass token integrity validation across all themes', () => {
    const result = validateTokens();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('should contain all required primitive categories', () => {
    expect(tokens.primitives.color).toBeDefined();
    expect(tokens.primitives.space).toBeDefined();
    expect(tokens.primitives.typography).toBeDefined();
    expect(tokens.primitives.radius).toBeDefined();
    expect(tokens.primitives.elevation).toBeDefined();
    expect(tokens.primitives.motion).toBeDefined();
  });

  it('should contain all required semantic token layers', () => {
    expect(tokens.semantic.color.bg).toBeDefined();
    expect(tokens.semantic.color.text).toBeDefined();
    expect(tokens.semantic.color.border).toBeDefined();
    expect(tokens.semantic.color.action).toBeDefined();
    expect(tokens.semantic.color.status).toBeDefined();
    expect(tokens.semantic.color.ai).toBeDefined();
    expect(tokens.semantic.color.focus).toBeDefined();
  });

  it('should generate valid CSS variables for dark, light, and high-contrast', () => {
    const css = generateCssVariables();
    expect(css).toContain(':root');
    expect(css).toContain('.dark');
    expect(css).toContain('.light');
    expect(css).toContain('.high-contrast');
    expect(css).toContain('--color-bg-canvas: #08080a');
    expect(css).toContain('--color-bg-canvas: #f8f9fc');
    expect(css).toContain('--color-bg-canvas: #000000');
    expect(css).toContain('--radius-md: 6px');
    expect(css).toContain('--radius-control: var(--radius-md)');
    expect(css).toContain('--radius-card: var(--radius-lg)');
    expect(css).toContain('--elevation-raised: 0 1px 3px 0 rgb(0 0 0 / 0.1)');
    expect(css).toContain('--elevation-card: var(--elevation-raised)');
    expect(css).toContain('--color-focus-ring: #ffff00');
  });
});

/**
 * These two engines are NOT supposed to agree. `globals.css` is the runtime
 * stylesheet the app actually loads; the JSON under `src/tokens` is design
 * documentation with no build-time caller. Reconciling them is out of scope, so
 * the drift is pinned here as a baseline that fails if it changes.
 *
 * Measured shape of the drift (86 custom properties in globals.css):
 *   - colour:  disjoint, 2 of 57 names shared, both value-identical
 *   - scales:  aligned, 17 of 17 `--radius-*` / `--elevation-*` value-identical
 *   - space + typography: engine-only
 */
describe('token engine vs. runtime stylesheet drift baseline', () => {
  const generated = generateCssVariables();
  const engineValues = new Map(
    [...generated.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => [
      m[1] as string,
      (m[2] as string).trim(),
    ]),
  );
  const engineNames = declaredNames(generated);
  const globalsCss = readFileSync(GLOBALS_CSS, 'utf8');
  const runtimeValues = new Map<string, Set<string>>();
  for (const m of globalsCss.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = m[1] as string;
    const bucket = runtimeValues.get(name) ?? new Set<string>();
    bucket.add((m[2] as string).trim());
    runtimeValues.set(name, bucket);
  }
  const runtimeNames = declaredNames(globalsCss);

  const SHARED_COLORS = ['--color-focus-ring', '--color-focus-ring-offset'] as const;
  const inBoth = (names: string[], other: string[]) =>
    names.filter((n) => other.includes(n)).sort();

  it('reads the documented runtime source of truth from disk', () => {
    expect(existsSync(GLOBALS_CSS)).toBe(true);
    expect(TOKEN_SOURCE_OF_TRUTH.runtime).toBe('apps/web/src/styles/globals.css');
    expect(TOKEN_SOURCE_OF_TRUTH.designRecord).toBe('packages/ui-kit/src/tokens');
    expect(TOKEN_SOURCE_OF_TRUTH.wiredIntoAppBuild).toBe(false);
  });

  it('keeps the colour namespaces disjoint apart from the two documented names', () => {
    const engineColors = engineNames.filter((n) => n.startsWith('--color-'));
    expect(inBoth(engineColors, runtimeNames)).toEqual([...SHARED_COLORS]);
    expect(TOKEN_SOURCE_OF_TRUTH.sharedColorNames).toEqual([...SHARED_COLORS]);
  });

  it('keeps the radius and elevation scales value-identical on both sides', () => {
    const scales = engineNames.filter(
      (n) => n.startsWith('--radius-') || n.startsWith('--elevation-'),
    );
    const shared = inBoth(scales, runtimeNames);
    expect(shared).toHaveLength(17);
    expect(TOKEN_SOURCE_OF_TRUTH.sharedScaleNames).toBe(shared.length);
    const mismatched = shared.filter(
      (n) => ![...(runtimeValues.get(n) ?? [])].includes(engineValues.get(n) ?? ''),
    );
    expect(mismatched).toEqual([]);
  });

  it('keeps space and typography engine-only, as documented', () => {
    const engineOnlyPrefixes = TOKEN_SOURCE_OF_TRUTH.engineOnlyNamespaces.map((p) =>
      p.replace('*', ''),
    );
    const leaked = engineNames.filter(
      (n) => engineOnlyPrefixes.some((p) => n.startsWith(p)) && runtimeNames.includes(n),
    );
    expect(leaked).toEqual([]);
    expect(runtimeNames.some((n) => n.startsWith('--space-'))).toBe(false);
    expect(runtimeNames.some((n) => n.startsWith('--font-size-'))).toBe(false);
  });

  it('keeps the two shared colour names value-identical in the dark and light themes', () => {
    type ThemeValues = (typeof tokens.themes)['dark']['values'];
    const blocks: Array<[ThemeValues, RegExp]> = [
      [tokens.themes.dark.values, /:root,\s*\.dark\s*\{([\s\S]*?)\n\}/],
      [tokens.themes.light.values, /\.light\s*\{([\s\S]*?)\n\}/],
    ];
    for (const [values, block] of blocks) {
      const blockText = block.exec(generated)?.[1] ?? '';
      for (const name of SHARED_COLORS) {
        expect(values[name]).toMatch(/^#[0-9a-f]{6}$/);
        expect(blockText).toContain(`${name}: ${values[name]};`);
        // globals.css declares these twice (dark root + light), so membership is
        // the honest assertion: both theme values must be present there.
        expect(runtimeValues.get(name)).toContain(values[name]);
      }
    }
    expect(runtimeValues.get('--color-focus-ring')).toEqual(new Set(['#818cf8', '#6366f1']));
    expect(runtimeValues.get('--color-focus-ring-offset')).toEqual(new Set(['#08080a', '#ffffff']));
    // The engine's high-contrast focus ring is intentionally not in globals.css.
    expect(tokens.themes['high-contrast'].values['--color-focus-ring']).toBe('#ffff00');
    expect(runtimeValues.get('--color-focus-ring')?.has('#ffff00')).toBe(false);
  });

  it('pins the size of the runtime palette so silent divergence is visible', () => {
    // 88 as of the token-authority pass that added the previously-dangling
    // --primary-fg and --primary-700 (both were referenced by shipped code but
    // declared nowhere). Bump deliberately, and note the delta in the commit.
    expect(runtimeNames).toHaveLength(88);
    // The two that shipped code dereferenced but which were never declared.
    expect(runtimeNames).toContain('--primary-fg');
    expect(runtimeNames).toContain('--primary-700');
    expect(runtimeOnlyColours(runtimeNames, engineNames).length).toBeGreaterThan(50);
  });
});

function runtimeOnlyColours(runtimeNames: string[], engineNames: string[]): string[] {
  return runtimeNames.filter(
    (n) => !engineNames.includes(n) && !n.startsWith('--radius-') && !n.startsWith('--elevation-'),
  );
}

describe('generateCssVariables() is internally self-consistent', () => {
  const generated = generateCssVariables();
  const declared = declaredNames(generated);

  it('resolves every var() reference the generated CSS makes', () => {
    const unresolved = referencedNames(generated).filter((name) => !declared.includes(name));
    expect(unresolved).toEqual([]);
  });

  it('resolves every var() reference the semantic and component layers make', () => {
    // Regression guard: component.json referenced --font-size-12, which the
    // generator never emitted, so the engine shipped a dangling reference.
    const referenced = referencedNames(`${JSON.stringify(semantic)}${JSON.stringify(component)}`);
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((name) => !declared.includes(name))).toEqual([]);
  });

  it('does not emit the host-owned font custom properties', () => {
    // --font-inter & friends belong to the app's font loader; emitting them
    // here would make this engine look like it owns typography families.
    expect(generated).not.toContain('--font-inter');
    expect(generated).not.toContain('--font-space-grotesk');
    expect(generated).not.toContain('--font-ibm-plex-mono');
  });

  it('agrees with validateTokens() about which themes exist', () => {
    const emittedThemes = ['dark', 'light', 'high-contrast']
      .filter((name) => generated.includes(`.${name}`))
      .sort();
    expect(emittedThemes).toEqual(Object.keys(tokens.themes).sort());
    expect(validateTokens().valid).toBe(true);
  });

  it('emits one declaration per primitive scale entry', () => {
    const keys = <T extends object>(obj: T) => Object.keys(obj) as Array<keyof T>;
    for (const key of keys(primitives.space)) {
      expect(generated).toContain(`--space-${key}: ${primitives.space[key]};`);
    }
    for (const key of keys(primitives.radius)) {
      expect(generated).toContain(`--radius-${key}: ${primitives.radius[key]};`);
    }
    for (const key of keys(primitives.elevation)) {
      expect(generated).toContain(`--elevation-${key}: ${primitives.elevation[key]};`);
    }
    for (const key of keys(primitives.typography.fontSize)) {
      expect(generated).toContain(
        `--font-size-${key}: ${primitives.typography.fontSize[key].size};`,
      );
    }
  });
});
