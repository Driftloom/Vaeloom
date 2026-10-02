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
 * Assert the theme the test asked for is the theme actually painted.
 *
 * This exists because the suite silently shipped a false pass. The four committed
 * baselines had top-band luminance 170 (dark) and 205 (light) - BOTH light. The
 * `dark` baselines were light renders, so dark mode could have been completely
 * broken and the pixel comparison still matched inside its 8% tolerance. Nothing
 * in the suite ever asked whether the theme applied; it only compared pictures.
 *
 * Three independent checks, because any one alone can lie:
 *   - the `<html>` class, which is what `useTheme` sets;
 *   - `data-theme`, which is set in the same batch and should never be absent; and
 *   - the painted `body` background, which is what a visitor actually sees and
 *     which stays light even when the class is right if a theme token failed.
 *
 * Polled rather than sampled after a fixed sleep. `getComputedStyle` does not
 * block on pending stylesheets, so a pre-CSS read returns `rgba(0, 0, 0, 0)` -
 * transparent. That was a real hole in the first version of this helper: the
 * number parse dropped alpha, `rgba(0,0,0,0)` became luma 0, and the DARK branch
 * (`0 < 96`) passed vacuously - the one failure this function exists to catch.
 * Polling plus an explicit alpha assertion closes it, and removes the guesswork
 * that a fixed sleep was standing in for.
 */
async function expectThemeApplied(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // `--bg` is `0 0 0` for dark and `247 248 252` for light, so the observed
  // luma is ~0 and ~248. The bounds sit in the empty middle with wide margins so
  // a token value change cannot flip the verdict.
  const bound = theme === 'dark' ? 96 : 159;

  const verdict = async (): Promise<string> => {
    const s = await page.evaluate(() => {
      const de = document.documentElement;
      const bg = getComputedStyle(document.body).backgroundColor;
      // Anchored, and alpha-aware: rejects oklch()/color(srgb ...) outright rather
      // than silently reading 0-1 channels as 0-255.
      const m = bg.match(
        /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/]\s*([\d.]+%?))?\s*\)$/i,
      );
      const rawAlpha = m?.[4];
      return {
        cls: (de.className.match(/\b(light|dark|high-contrast)\b/) ?? [])[1] ?? null,
        dataTheme: de.getAttribute('data-theme'),
        bodyBg: bg,
        parseable: m !== null,
        alpha:
          rawAlpha === undefined
            ? 1
            : rawAlpha.endsWith('%')
              ? Number.parseFloat(rawAlpha) / 100
              : Number(rawAlpha),
        luma: m ? 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]) : NaN,
      };
    });

    const problems: string[] = [];
    if (s.cls === null) problems.push('<html> has no theme class');
    else if (s.cls !== theme) problems.push(`<html> class is "${s.cls}", expected "${theme}"`);
    if (s.dataTheme !== theme) {
      problems.push(`data-theme is ${JSON.stringify(s.dataTheme)}, expected "${theme}"`);
    }
    if (!s.parseable) {
      problems.push(`body background "${s.bodyBg}" is not a parseable rgb()/rgba() colour`);
    } else if (s.alpha !== 1) {
      problems.push(
        `body background "${s.bodyBg}" is not opaque, so nothing is painted behind the copy`,
      );
    } else if (theme === 'dark' ? s.luma >= bound : s.luma <= bound) {
      problems.push(
        `body background "${s.bodyBg}" has luma ${Math.round(s.luma)}, expected ${
          theme === 'dark' ? `< ${bound}` : `> ${bound}`
        }`,
      );
    }
    return problems.length === 0 ? 'ok' : problems.join('; ');
  };

  await expect
    .poll(verdict, {
      timeout: 15_000,
      intervals: [250],
      message: `theme "${theme}" never settled into the expected state`,
    })
    .toBe('ok');
}

/**
 * Remove Next.js dev-only chrome before capturing.
 *
 * The dev indicator renders a red "N Issue" pill whenever the page logs anything.
 * It is dev-only, absent from a production build, and it was baked into all four
 * committed baselines - so every baseline differed from production for a reason
 * that has nothing to do with the design.
 *
 * CSS alone is not enough: the overlay re-creates itself after the style lands,
 * which is why the pill was still present when the suite ran end to end even
 * though it vanished in an isolated capture. So the style guards re-appearance
 * while the node removal does the actual work, and the removal runs twice to
 * catch an overlay that appears in between. The trailing assertion is the
 * post-condition - without it this is a race-based heuristic that fails silently.
 *
 * KNOWN LIMIT: the small "N" static-route badge survives this. It has no DOM box
 * at its own coordinates (its host is `pointer-events: none`, which
 * `elementFromPoint` skips) and lives outside `nextjs-portal`, so neither the
 * style nor the removal reaches it. Removing it durably needs Next's own
 * `devIndicators` option in next.config.js, which is shared config.
 */
async function hideDevIndicators(page: Page): Promise<void> {
  const purge = () => {
    document.querySelectorAll('nextjs-portal').forEach((n) => n.remove());
  };
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(purge);
  await page.waitForTimeout(250);
  await page.evaluate(purge);
  await expect(page.locator('nextjs-portal')).toHaveCount(0);
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
 * CI GATE (plan D-R2): `.github/workflows/ci-frontend.yml` now runs these with
 * `--grep "visual baselines"` WITHOUT `--update-snapshots` on a pinned
 * `ubuntu-24.04`, so the runner compares against the committed `-linux` baselines
 * and an unapproved pixel diff fails the build. A maintainer regenerates and
 * commits `-linux` via the manual `visual-baseline-refresh` job. BOOTSTRAP: only
 * `-win32` are committed today, so the first ubuntu run reports "snapshot
 * missing" until that refresh job seeds the `-linux` set once.
 *
 * Independent of pixels, correctness is still asserted where it can gate without a
 * baseline: `expectThemeApplied` runs in the a11y tests, inside the blocking
 * `--grep-invert "visual baselines"` job. That check exists because the four
 * committed baselines were both light renders - top-band luminance 170 (dark) and
 * 205 (light) - so a picture-only comparison could not, and did not, tell a
 * working dark mode from a broken one. It stays as the pixel-independent guard.
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
      // Gating on purpose. This test runs in the blocking CI job (the visual
      // baselines are excluded from it), so asserting the theme here is what
      // actually enforces "dark mode is dark" - the pixel comparison is advisory
      // and cross-OS, so it cannot be relied on to catch this.
      await expectThemeApplied(page, theme);
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
        // Same reason as in the a11y test: never capture a picture of a page that
        // is not in the theme under test, and never let dev chrome into a
        // committed baseline.
        await expectThemeApplied(page, theme);
        await hideDevIndicators(page);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page).toHaveScreenshot(`landing-${theme}-${vp}.png`, {
          fullPage: true,
          animations: 'disabled',
          maxDiffPixelRatio: 0.08,
          // `test.setTimeout` above does not cover this: the expect call carries
          // its own 5s default, and a full-page capture of this page is ~16,800px
          // tall (the hero is 130vh) with the reduced-motion fallback art in every
          // beat. That regularly overruns 5s and fails as a bare
          // "Timeout 5000ms exceeded" with no pixel diff reported, which reads as
          // a flake rather than the timeout it is.
          timeout: 30_000,
        });
      });
    }
  }
});
