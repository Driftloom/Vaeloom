import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Wait for webfonts, but never block forever.
 *
 * `page.evaluate(() => document.fonts.ready)` returns a promise that only settles
 * once every font request has finished. In an environment with no outbound
 * network those requests never finish, the promise never resolves, and because
 * `page.evaluate` has no timeout of its own the test hangs indefinitely - which
 * is what stalled the whole suite rather than failing one test.
 *
 * Racing it against a bounded timer keeps a missing font a non-event: the page is
 * still asserted on, just with fallback fonts, which is what a user without
 * webfonts sees anyway.
 */
async function waitForFonts(page: Page, timeout = 5_000): Promise<void> {
  await page
    .evaluate(
      (ms) =>
        Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, ms))]),
      timeout,
    )
    .catch(() => {
      /* fonts are advisory here; never fail the run on them */
    });
}

/**
 * Landing (/) — the marketing surface.
 *
 * Functional + a11y gates run in CI like quality.spec. Visual baselines
 * are captured with `reducedMotion: 'reduce'` so the static SVG scene
 * fallbacks render instead of WebGL canvases — deterministic frames
 * (canvas pixels vary per rAF, which would make baselines flaky).
 * The reduced-motion pass doubles as the WCAG fallback-mode check:
 * if the page stops telling its story without 3D, these snapshots show it.
 *
 * NOT A CI GATE: `.github/workflows/ci-frontend.yml:62` excludes the
 * "visual baselines" grep from the blocking run and `:67` re-runs it with
 * `--update-snapshots`, which rewrites every PNG and always exits 0. Required
 * CI change: run `pnpm exec playwright test --grep "visual baselines"` WITHOUT
 * `--update-snapshots` on a pinned image with committed `-linux` baselines.
 */

test.describe('landing functional', () => {
  test('renders product truth with working CTAs and anchors', async ({ page }) => {
    // Relative URL so the configured `baseURL` applies. A hard-coded
    // `localhost:3000` silently ignores it, and `localhost` resolves to IPv6
    // ::1 on some hosts where the dev server only listens on IPv4 - which turns
    // the navigation into a hang rather than a clear connection error.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await waitForFonts(page);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('second brain');

    // Primary conversion path present (hero + final CTA at minimum)
    const signups = page.locator('a[href="/signup"]');
    await expect(signups.first()).toBeVisible();
    expect(await signups.count()).toBeGreaterThanOrEqual(2);

    // Every nav anchor must resolve to a real section id — no dead links
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[id]')).map((el) => el.id),
    );
    for (const hash of ['#how-it-works', '#memory', '#agents', '#career', '#trust']) {
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
      await page.goto('/', { waitUntil: 'domcontentloaded' });
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
        // `networkidle` is not used: the landing page opens a realtime client, and
        // a long-lived connection means the network never goes idle, so the wait
        // blocks until the test timeout instead of reporting why.
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await waitForFonts(page);
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
