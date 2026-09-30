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
    // Canvas values are now taken verbatim from globals.css. The dark canvas is
    // the brand pure black (#000000) and the light canvas #f7f8fc; the previous
    // #08080a / #f8f9fc came from a hand-authored JSON that had drifted.
    expect(css).toContain('--color-bg-canvas: #000000');
    expect(css).toContain('--color-bg-canvas: #f7f8fc');
    expect(css).toContain('--radius-md: 6px');
    expect(css).toContain('--radius-control: var(--radius-md)');
    expect(css).toContain('--radius-card: var(--radius-lg)');
    expect(css).toContain('--elevation-raised: 0 1px 3px 0 rgb(0 0 0 / 0.1)');
    expect(css).toContain('--elevation-card: var(--elevation-raised)');
    // globals.css does not declare --color-focus-ring inside the high-contrast
    // block, so that theme inherits the :root value; generateCssVariables()
    // pins the accessible yellow explicitly.
    expect(css).toContain('--color-focus-ring: #ffff00');
  });
});

/**
 * The JSON under `src/tokens` is GENERATED from `apps/web/src/styles/globals.css`
 * by `scripts/gen_tokens.py`. These tests re-derive every runtime-derived value
 * straight from the stylesheet and compare, so hand-editing the JSON (or
 * changing globals.css without regenerating) fails here rather than silently
 * diverging.
 *
 * The map is read from `tokens/mapping.json` — also generated — so the
 * globals-name -> token-name relationship has exactly one definition.
 *
 * What is deliberately NOT asserted: that the two agree on everything. 18 of
 * 57 names per theme are design-record-only (15 AI semantic colours, the scrim,
 * and text-inverse) and have no runtime counterpart. Those are listed in each
 * theme's `provenance.designRecordOnly` and must stay disjoint from
 * `runtimeDerived`, so nothing in the JSON implies an implementation that does
 * not exist.
 */
describe('generated token JSON is in sync with globals.css', () => {
  const globalsCss = readFileSync(GLOBALS_CSS, 'utf8');
  const mapping = (
    JSON.parse(
      readFileSync(
        resolve(REPO_ROOT, 'packages', 'ui-kit', 'src', 'tokens', 'mapping.json'),
        'utf8',
      ),
    ) as { map: Record<string, string[]> }
  ).map;

  /** globals.css stores colours as `R G B` triplets for Tailwind alpha support. */
  const toHex = (value: string): string => {
    const v = value.trim();
    if (v.startsWith('#')) return v.toLowerCase();
    const parts = v.split(/\s+/);
    if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
      return `#${parts.map((p) => Number(p).toString(16).padStart(2, '0')).join('')}`;
    }
    return v;
  };

  /** Every value globals.css declares for a name, normalised to hex. */
  const runtimeValues = (name: string): Set<string> => {
    const out = new Set<string>();
    for (const m of globalsCss.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g'))) {
      out.add(toHex(m[1] as string));
    }
    return out;
  };

  const themeNames = ['dark', 'light', 'high-contrast'] as const;

  it('marks every theme as generated, with a provenance block', () => {
    for (const theme of themeNames) {
      const t = tokens.themes[theme] as unknown as {
        generated: boolean;
        provenance: { generatedFrom: string; runtimeDerived: string[]; designRecordOnly: string[] };
      };
      expect(t.generated).toBe(true);
      expect(t.provenance.generatedFrom).toBe('apps/web/src/styles/globals.css');
      expect(Array.isArray(t.provenance.runtimeDerived)).toBe(true);
      expect(Array.isArray(t.provenance.designRecordOnly)).toBe(true);
    }
  });

  it('keeps runtimeDerived and designRecordOnly disjoint and complete', () => {
    for (const theme of themeNames) {
      const t = tokens.themes[theme] as unknown as {
        values: Record<string, string>;
        provenance: { runtimeDerived: string[]; designRecordOnly: string[] };
      };
      const runtime = new Set(t.provenance.runtimeDerived);
      const recordOnly = new Set(t.provenance.designRecordOnly);
      for (const name of runtime) {
        expect(recordOnly.has(name)).toBe(false);
      }
      const union = new Set([...runtime, ...recordOnly]);
      expect(union.size).toBe(Object.keys(t.values).length);
      for (const name of Object.keys(t.values)) {
        expect(union.has(name)).toBe(true);
      }
    }
  });

  it('gives every runtimeDerived value a matching declaration in globals.css', () => {
    for (const theme of themeNames) {
      const t = tokens.themes[theme] as unknown as {
        values: Record<string, string>;
        provenance: { runtimeDerived: string[] };
      };
      const derived = new Set(t.provenance.runtimeDerived);

      for (const [globalsName, tokenNames] of Object.entries(mapping)) {
        const declared = runtimeValues(globalsName);
        expect(declared.size).toBeGreaterThan(0);
        for (const tokenName of tokenNames) {
          if (!derived.has(tokenName)) continue;
          // The value must appear verbatim in globals.css for at least one
          // theme block. Themes that legitimately inherit (e.g. high-contrast
          // falls back to :root for --color-focus-ring) still match, because the
          // set spans every block in the file.
          expect(Array.from(declared)).toContain(t.values[tokenName]);
        }
      }
    }
  });

  it('documents the exact design-record-only gaps, so they stay visible', () => {
    for (const theme of themeNames) {
      const t = tokens.themes[theme] as unknown as {
        provenance: { designRecordOnly: string[] };
      };
      expect([...t.provenance.designRecordOnly].sort()).toEqual(
        [...TOKEN_SOURCE_OF_TRUTH.designRecordOnly].sort(),
      );
      expect(TOKEN_SOURCE_OF_TRUTH.runtimeDerivedPerTheme).toBe(t.provenance.runtimeDerived.length);
    }
  });

  it('never marks a name as runtime-derived unless globals.css declares it', () => {
    // The inverse direction of the sync test: a token claiming a runtime source
    // must actually be traceable to a declaration in the stylesheet. This is
    // what stops a hand-edited provenance block from inventing coverage.
    for (const theme of themeNames) {
      const t = tokens.themes[theme] as unknown as {
        provenance: { runtimeDerived: string[] };
      };
      const traceable = new Set(Object.values(mapping).flat());
      for (const name of t.provenance.runtimeDerived) {
        expect(traceable.has(name)).toBe(true);
      }
    }
  });

  it('resolves the destructive active state against a real token, not a guess', () => {
    // `--color-action-destructive-active` was aspirational: semantic.json and
    // component.json both dereference it, but globals.css defined no
    // `--error-active`, so it carried a hand-picked hex no stylesheet backed.
    // globals.css now defines it in all three themes, so the generator derives
    // it and the dangling var() reference is gone.
    const expected: Record<string, string> = {
      dark: '#dc2626',
      light: '#991b1b',
      'high-contrast': '#cc0000',
    };
    for (const theme of themeNames) {
      const t = tokens.themes[theme] as unknown as {
        values: Record<string, string>;
        provenance: { runtimeDerived: string[]; designRecordOnly: string[] };
      };
      expect(t.values['--color-action-destructive-active']).toBe(expected[theme]);
      expect(t.provenance.runtimeDerived).toContain('--color-action-destructive-active');
      expect(t.provenance.designRecordOnly).not.toContain('--color-action-destructive-active');
    }
  });

  it('keeps the radius and elevation scales value-identical on both sides', () => {
    const generated = generateCssVariables();
    const engineValues = new Map(
      [...generated.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => [
        m[1] as string,
        (m[2] as string).trim(),
      ]),
    );
    const engineNames = declaredNames(generated);
    const runtimeNames = declaredNames(globalsCss);
    const scales = engineNames.filter(
      (n) => n.startsWith('--radius-') || n.startsWith('--elevation-'),
    );
    const shared = scales.filter((n) => runtimeNames.includes(n)).sort();
    expect(shared).toHaveLength(17);
    const mismatched = shared.filter(
      (n) => ![...runtimeValues(n)].includes(engineValues.get(n) ?? ''),
    );
    expect(mismatched).toEqual([]);
  });

  it('keeps space and typography engine-only, as documented', () => {
    const engineOnlyPrefixes = TOKEN_SOURCE_OF_TRUTH.engineOnlyNamespaces.map((p) =>
      p.replace('*', ''),
    );
    const generated = generateCssVariables();
    const engineNames = declaredNames(generated);
    const runtimeNames = declaredNames(globalsCss);
    const leaked = engineNames.filter(
      (n) => engineOnlyPrefixes.some((p) => n.startsWith(p)) && runtimeNames.includes(n),
    );
    expect(leaked).toEqual([]);
    expect(runtimeNames.some((n) => n.startsWith('--space-'))).toBe(false);
    expect(runtimeNames.some((n) => n.startsWith('--font-size-'))).toBe(false);
  });

  it('keeps every theme at the same value count, so no theme is partial', () => {
    const counts = themeNames.map((t) => Object.keys(tokens.themes[t].values).length);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(57);
  });

  it('pins the size of the runtime palette so silent divergence is visible', () => {
    const runtimeNames = declaredNames(globalsCss);
    // 104 as of the AI-semantic-token pass, which added the 15 --ai-* names
    //   --error-active  - the pressed destructive state, which semantic.json and
    //                     component.json already dereferenced (dangling until now)
    //   --ai-* x15  - AI semantic states, previously design-record-only
    // Bump deliberately, and note the delta in the commit.
    expect(runtimeNames).toHaveLength(104);
    expect(runtimeNames).toContain('--primary-fg');
    expect(runtimeNames).toContain('--primary-700');
    expect(runtimeNames).toContain('--error-active');
    // Every theme must override the focus ring, or high-contrast silently
    // inherits the dim :root indigo and loses its accessible yellow.
    const highContrastBlock = globalsCss.slice(
      globalsCss.indexOf('.high-contrast,'),
      globalsCss.indexOf('@media (prefers-contrast'),
    );
    expect(highContrastBlock).toContain('--color-focus-ring: #ffff00');
    expect(highContrastBlock).toContain('--color-focus-ring-offset: #000000');
  });
});

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
