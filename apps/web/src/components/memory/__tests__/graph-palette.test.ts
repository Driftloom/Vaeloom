import { readFileSync } from 'fs';
import path from 'path';
import { GRAPH_NODE_STYLES, GRAPH_NODE_TYPE_ORDER } from '@/components/memory/GraphViewer';

/**
 * Contract tests for the knowledge-graph node palette.
 *
 * The spec (§2, "Node type palette") requires that every node type reads as a
 * distinct visual identity in the user's *active* theme: the second and third
 * channels (stroke-dash pattern, geometric shape) exist so that node types
 * whose colours collide under a theme remain distinguishable. These tests
 * parse the resolved token triplets straight out of globals.css per theme,
 * so a palette that only looks distinct on paper fails here.
 */

const CSS_PATH = path.join(__dirname, '..', '..', '..', 'styles', 'globals.css');

const TOKEN_VALUE = /--([\w-]+)\s*:\s*([0-9]+\s+[0-9]+\s+[0-9]+)\s*;/g;
const TOKEN_REF = /^rgb\(var\(--([\w-]+)\)\)$/;

const THEMES: Array<{ name: string; blockStartMarker: string }> = [
  { name: 'dark', blockStartMarker: '.dark {' },
  { name: 'light', blockStartMarker: '.light {' },
  { name: 'high-contrast', blockStartMarker: '.high-contrast,' },
];

function extractThemeTokens(css: string, theme: { name: string; blockStartMarker: string }) {
  const marker = css.indexOf(theme.blockStartMarker);
  if (marker === -1) {
    throw new Error(`Theme block "${theme.blockStartMarker}" not found in globals.css`);
  }
  const open = css.indexOf('{', marker);
  let depth = 0;
  let close = open;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  const block = css.slice(open, close);
  const tokens = new Map<string, string>();
  TOKEN_VALUE.lastIndex = 0;
  let match = TOKEN_VALUE.exec(block);
  while (match !== null) {
    const name = match[1];
    const value = match[2];
    if (name && value) tokens.set(name, value.replace(/\s+/g, ' '));
    match = TOKEN_VALUE.exec(block);
  }
  return tokens;
}

function resolveTriplet(value: string, tokens: Map<string, string>): string | null {
  const match = TOKEN_REF.exec(value.trim());
  if (!match) return null;
  const tokenName = match[1];
  if (!tokenName) return null;
  return tokens.get(tokenName) ?? null;
}

describe('knowledge-graph node palette', () => {
  const rawCss = readFileSync(CSS_PATH, 'utf8');
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

  it('declares the palette for exactly the canonical node type union, in order', () => {
    expect(GRAPH_NODE_TYPE_ORDER).toHaveLength(8);
    expect(Object.keys(GRAPH_NODE_STYLES).sort()).toEqual([...GRAPH_NODE_TYPE_ORDER].sort());
    expect(new Set(GRAPH_NODE_TYPE_ORDER).size).toBe(GRAPH_NODE_TYPE_ORDER.length);
    expect(GRAPH_NODE_TYPE_ORDER).toContain('entity');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('concept');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('document');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('event');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('topic');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('project');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('person');
    expect(GRAPH_NODE_TYPE_ORDER).toContain('organization');
  });

  it('references every fill and stroke through rgb(var(--token)) — no hex, no numeric rgb()', () => {
    for (const type of GRAPH_NODE_TYPE_ORDER) {
      const style = GRAPH_NODE_STYLES[type];
      expect(style.fill).toMatch(TOKEN_REF);
      expect(style.stroke).toMatch(TOKEN_REF);
      expect(style.fill).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style.stroke).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(style.fill).not.toMatch(/rgb\(\s*[0-9]/);
      expect(style.stroke).not.toMatch(/rgb\(\s*[0-9]/);
    }
  });

  for (const theme of THEMES) {
    it(`resolves all tokens and keeps all 8 node types pairwise distinct in "${theme.name}"`, () => {
      const tokens = extractThemeTokens(css, theme);
      expect(tokens.size).toBeGreaterThan(10);

      const identities = new Map<string, string>();
      for (const type of GRAPH_NODE_TYPE_ORDER) {
        const style = GRAPH_NODE_STYLES[type];
        const fillTriplet = resolveTriplet(style.fill, tokens);
        const strokeTriplet = resolveTriplet(style.stroke, tokens);
        expect({ type, theme: theme.name, fillTriplet }).toEqual({
          type,
          theme: theme.name,
          fillTriplet: expect.any(String),
        });
        expect({ type, theme: theme.name, strokeTriplet }).toEqual({
          type,
          theme: theme.name,
          strokeTriplet: expect.any(String),
        });

        const identity = `${fillTriplet}|dash:${style.dashed ? 'yes' : 'no'}|shape:${style.shape}`;
        const collidedWith = identities.get(identity);
        expect({
          collision: collidedWith ? `${type} collides with ${collidedWith}` : null,
          theme: theme.name,
        }).toEqual({ collision: null, theme: theme.name });
        identities.set(identity, type);
      }
      expect(identities.size).toBe(8);
    });
  }

  it('carries collision-proof second channels: shape and dash are actually used', () => {
    const shapes = new Set(GRAPH_NODE_TYPE_ORDER.map((t) => GRAPH_NODE_STYLES[t].shape));
    expect(shapes.size).toBeGreaterThanOrEqual(3);

    const dashedTypes = GRAPH_NODE_TYPE_ORDER.filter((t) => GRAPH_NODE_STYLES[t].dashed);
    expect(dashedTypes.length).toBeGreaterThanOrEqual(1);
    expect(GRAPH_NODE_STYLES.concept.dashed).toBe(true);
  });

  it('never paints a node with the warning or error semantic colours', () => {
    for (const theme of THEMES) {
      const tokens = extractThemeTokens(css, theme);
      const warning = tokens.get('color-warning');
      const error = tokens.get('color-error');
      for (const type of GRAPH_NODE_TYPE_ORDER) {
        const style = GRAPH_NODE_STYLES[type];
        const fillTriplet = resolveTriplet(style.fill, tokens);
        if (warning)
          expect({ type, theme: theme.name, fillTriplet }).not.toEqual({
            type,
            theme: theme.name,
            fillTriplet: warning,
          });
        if (error)
          expect({ type, theme: theme.name, fillTriplet }).not.toEqual({
            type,
            theme: theme.name,
            fillTriplet: error,
          });
      }
    }
  });
});
