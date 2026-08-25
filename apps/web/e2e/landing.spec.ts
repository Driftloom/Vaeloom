import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Landing (/) — the marketing surface.
 *
 * Functional + a11y gates run in CI like quality.spec. Visual baselines
 * are captured with `reducedMotion: 'reduce'` so the static SVG scene
 * fallbacks render instead of WebGL canvases — deterministic frames
 * (canvas pixels vary per rAF, which would make baselines flaky).
 * The reduced-motion pass doubles as the WCAG fallback-mode check:
 * if the page stops telling its story without 3D, these snapshots show it.
 */

test.describe('landing functional', () => {
  test('renders product truth with working CTAs and anchors', async ({ page }) => {
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('second brain');

    // Primary conversion path present (hero + final CTA at minimum)
    const signups = page.locator('a[href="/signup"]');
    await expect(signups.first()).toBeVisible();
    expect(await signups.count()).toBeGreaterThanOrEqual(2);

    // Every nav anchor must resolve to a real section id — no dead links
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[id]')).map((el) => el.id),
    );
    for (const hash of ['#how-it-works', '#memory', '#agents', '#career', '#enterprise']) {
      expect(ids, `${hash} target exists`).toContain(hash.slice(1));
    }
    // Regression guards: dead pricing anchor and false SOC 2 claim stay gone
    await expect(page.locator('a[href="#pricing"]')).toHaveCount(0);
    expect(await page.content()).not.toMatch(/SOC ?2/i);

    // No information may be 3D-gated: canvas scenes are aria-hidden and
    // every canvas has a static fallback + sr-only narrative in the DOM
    const narratives = await page.getByText(/Interactive knowledge graph/).count();
    expect(narratives).toBeGreaterThanOrEqual(1);
  });
});

for (const theme of ['dark', 'light'] as const) {
  test.describe(`landing a11y (${theme})`, () => {
    test.use({ colorScheme: theme });
    test('axe: zero serious/critical', async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.evaluate(async () => {
        const h = document.body.scrollHeight;
        for (let y = 0; y < h; y += 800) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const bad = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(bad.map((v) => `${v.id}(${v.nodes.length})`)).toEqual([]);
    });
  });
}

test.describe('landing visual baselines (reduced motion — static fallbacks)', () => {
  for (const theme of ['dark', 'light'] as const) {
    for (const vp of [375, 1440] as const) {
      test(`landing ${theme} ${vp}`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: vp, height: 850 });
        await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page).toHaveScreenshot(`landing-${theme}-${vp}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.08,
        });
      });
    }
  }
});
