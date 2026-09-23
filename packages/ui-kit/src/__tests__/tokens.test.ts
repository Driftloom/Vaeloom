import { tokens, validateTokens, generateCssVariables } from '../tokens';

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
