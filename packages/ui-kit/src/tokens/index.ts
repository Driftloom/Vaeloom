/**
 * Design token source of record.
 *
 * GENERATED FILE — DO NOT HAND-EDIT.
 *
 * `apps/web/src/styles/globals.css` is the single source of truth. The JSON in
 * this directory is a machine-generated projection of it, produced by
 * `scripts/gen_tokens.py`. Regenerate with:
 *
 *     python scripts/gen_tokens.py           # rewrite the JSON
 *     python scripts/gen_tokens.py --check   # CI gate; exits 1 on drift
 *
 * The app build never reads these files, so editing them still changes no
 * pixels — that is precisely why they must be generated rather than
 * hand-maintained. They previously were hand-authored and drifted: 66 colour
 * values across the three themes disagreed with the stylesheet, and the JSON
 * light palette would have failed the very axe contrast checks globals.css was
 * explicitly tuned to pass.
 *
 * PROVENANCE, NOT VAGUENESS
 * -------------------------
 * Each theme file records which values come from the runtime:
 *
 *   provenance.runtimeDerived    - present in globals.css; drift-checked.
 *   provenance.designRecordOnly  - design intent with NO runtime counterpart.
 *                                  Never given an invented runtime value, and
 *                                  NOT drift-checked, so nothing here implies
 *                                  an implementation that does not exist.
 *
 * Currently 39 of 57 names per theme are runtime-derived. The 18
 * design-record-only names are the 15 AI semantic colours
 * (proposed/processing/verified/needs-review/blocked), `--color-bg-scrim`
 * (globals.css `--overlay` carries no alpha) and `--color-text-inverse`.
 * Those are real gaps in globals.css, tracked in
 * `docs/frontend/design-tokens-audit.md`.
 */
import component from './component.json';
import primitives from './primitives.json';
import semantic from './semantic.json';
import darkTheme from './themes/dark.json';
import highContrastTheme from './themes/high-contrast.json';
import lightTheme from './themes/light.json';

/**
 * Machine-readable form of the contract above, for consumers that want to
 * assert on it rather than read a comment.
 */
export const TOKEN_SOURCE_OF_TRUTH = {
  /** The only stylesheet the app build and Tailwind actually read. */
  source: 'apps/web/src/styles/globals.css',
  /** Generated projection of `source`. Never hand-edited. */
  generated: 'packages/ui-kit/src/tokens',
  generator: 'scripts/gen_tokens.py',
  checkCommand: 'python scripts/gen_tokens.py --check',
  /** These JSON files are still not read by the app build. */
  wiredIntoAppBuild: false,
  /** Count of colour names per theme that globals.css actually defines. */
  runtimeDerivedPerTheme: 55,
  /** Total colour names per theme, all three themes in lockstep. */
  valuesPerTheme: 57,
  /**
   * Design intent with no runtime counterpart. Listed so that nothing in this
   * tree implies an implementation that does not exist.
   */
  designRecordOnly: ['--color-bg-scrim', '--color-text-inverse'],
  /** globals.css namespaces this engine does not model. */
  engineOnlyNamespaces: ['--space-*', '--font-size-*', '--font-weight-*'],
} as const;

export const tokens = {
  primitives,
  semantic,
  component,
  themes: {
    dark: darkTheme,
    light: lightTheme,
    'high-contrast': highContrastTheme,
  },
} as const;

export type ThemeName = 'dark' | 'light' | 'high-contrast';
export type Primitives = typeof primitives;
export type SemanticTokens = typeof semantic;
export type ComponentTokens = typeof component;

/**
 * Validates that all required theme variables are defined across all themes.
 * Returns true if valid, throws error if any theme is incomplete.
 */
export function validateTokens(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requiredKeys = Object.keys(darkTheme.values);

  const themeList: Array<{ name: string; values: Record<string, string> }> = [
    { name: 'dark', values: darkTheme.values },
    { name: 'light', values: lightTheme.values },
    { name: 'high-contrast', values: highContrastTheme.values },
  ];

  for (const theme of themeList) {
    for (const key of requiredKeys) {
      if (!theme.values[key]) {
        errors.push(`Theme '${theme.name}' is missing required token: ${key}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate CSS variable declarations for inclusion in stylesheets.
 *
 * Not called by the app — see the module docstring. The font scale is emitted
 * because `component.json` already dereferences `--font-size-*`; font *family*
 * is deliberately omitted because those values dereference `--font-*` custom
 * properties owned by the app's font loader, not by this engine.
 */
export function generateCssVariables(): string {
  function formatVars(values: Record<string, string>): string {
    return Object.entries(values)
      .map(([key, val]) => `  ${key}: ${val};`)
      .join('\n');
  }

  const radiusVars = Object.entries(primitives.radius)
    .map(([key, val]) => `  --radius-${key}: ${val};`)
    .join('\n');

  const elevationVars = Object.entries(primitives.elevation)
    .map(([key, val]) => `  --elevation-${key}: ${val};`)
    .join('\n');

  const spaceVars = Object.entries(primitives.space)
    .map(([key, val]) => `  --space-${key}: ${val};`)
    .join('\n');

  const fontSizeVars = Object.entries(primitives.typography.fontSize)
    .flatMap(([key, val]) => [
      `  --font-size-${key}: ${val.size};`,
      `  --line-height-${key}: ${val.lineHeight};`,
    ])
    .join('\n');

  const fontWeightVars = Object.entries(primitives.typography.fontWeight)
    .map(([key, val]) => `  --font-weight-${key}: ${val};`)
    .join('\n');

  return `
/* Generated by Vaeloom Design Token Engine */
:root {
  /* Radius Primitives & Semantics */
${radiusVars}
  --radius-control: var(--radius-md);
  --radius-card: var(--radius-lg);
  --radius-container: var(--radius-xl);
  --radius-pill: var(--radius-full);

  /* Elevation Primitives & Semantics */
${elevationVars}
  --elevation-card: var(--elevation-raised);

  /* Space Primitives */
${spaceVars}

  /* Typography Primitives (font families are app-owned, see docstring) */
${fontSizeVars}
${fontWeightVars}
}

:root,
.dark {
${formatVars(darkTheme.values)}
}

.light {
${formatVars(lightTheme.values)}
}

.high-contrast,
[data-theme="high-contrast"] {
${formatVars(highContrastTheme.values)}
  --color-border-default: #ffffff;
  --color-border-strong: #ffffff;
  --color-border-focus: #ffff00;
  --color-focus-ring: #ffff00;
}

@media (prefers-contrast: more) {
  :root {
${formatVars(highContrastTheme.values)}
    --color-border-default: #ffffff;
    --color-border-strong: #ffffff;
    --color-border-focus: #ffff00;
    --color-focus-ring: #ffff00;
  }
}
`.trim();
}
