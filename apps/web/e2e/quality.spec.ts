import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectRouteRendered, gotoWorkspace, login } from './helpers';

interface CoreRoute {
  name: string;
  seg: string;
  /** Exact expected URL (pathname + search) after navigation. */
  expectPath: (wsId: string) => string;
  /**
   * A locator only the real page content satisfies. Scoped to the page-level h1
   * because the sidebar and breadcrumb repeat most route names, and the
   * dashboard uses its own testid since its h1 is the workspace name.
   */
  marker: (page: Page) => Locator;
}

const h1 = (page: Page, name: string | RegExp, exact?: boolean) =>
  page.locator('main#main-content').getByRole('heading', { level: 1, name, exact });

const CORE_ROUTES: CoreRoute[] = [
  {
    name: 'dashboard',
    seg: '',
    expectPath: (ws) => `/workspace/${ws}`,
    marker: (page) => page.getByTestId('workspace-dashboard'),
  },
  {
    name: 'chat',
    seg: '/chat',
    expectPath: (ws) => `/workspace/${ws}/chat`,
    marker: (page) => h1(page, 'Chat', true),
  },
  {
    name: 'memory',
    seg: '/memory',
    expectPath: (ws) => `/workspace/${ws}/memory`,
    marker: (page) => h1(page, 'Memory', true),
  },
  {
    name: 'files',
    seg: '/files',
    expectPath: (ws) => `/workspace/${ws}/files`,
    marker: (page) => h1(page, 'Workspace Files', true),
  },
  {
    name: 'history',
    seg: '/history',
    expectPath: (ws) => `/workspace/${ws}/history`,
    marker: (page) => h1(page, 'History', true),
  },
  {
    name: 'jobs',
    seg: '/jobs',
    expectPath: (ws) => `/workspace/${ws}/jobs`,
    marker: (page) => h1(page, 'Jobs', true),
  },
  {
    name: 'applications',
    seg: '/applications',
    expectPath: (ws) => `/workspace/${ws}/applications`,
    marker: (page) => h1(page, 'Applications', true),
  },
  {
    name: 'resume',
    seg: '/resume',
    expectPath: (ws) => `/workspace/${ws}/resume`,
    marker: (page) => h1(page, 'Resume', true),
  },
  {
    name: 'schedule',
    seg: '/schedule',
    expectPath: (ws) => `/workspace/${ws}/schedule`,
    marker: (page) => h1(page, 'Schedule', true),
  },
  // /connectors is a redirect stub (connectors/page.tsx:14) onto the
  // capabilities directory, so the URL after navigation is NOT /connectors.
  {
    name: 'connectors',
    seg: '/connectors',
    expectPath: (ws) => `/workspace/${ws}/capabilities?category=connectors`,
    marker: (page) => h1(page, /Connectors Studio/),
  },
  {
    name: 'approvals',
    seg: '/approvals',
    expectPath: (ws) => `/workspace/${ws}/approvals`,
    marker: (page) => h1(page, 'Approvals', true),
  },
  {
    name: 'settings',
    seg: '/settings',
    expectPath: (ws) => `/workspace/${ws}/settings`,
    marker: (page) => h1(page, 'Workspace Settings', true),
  },
];

/**
 * The routing gate every measurement below depends on. Without it a 404, a
 * login redirect or a blank error boundary reports zero axe violations and zero
 * overflow, so both gates pass on a broken page.
 */
async function openVerifiedRoute(page: Page, wsId: string, route: CoreRoute): Promise<void> {
  await gotoWorkspace(page, wsId, route.seg);
  await page.waitForLoadState('domcontentloaded');
  await expectRouteRendered(page, {
    seg: route.seg,
    expectPath: route.expectPath(wsId),
    marker: route.marker(page),
  });
}

test.describe('route rendering gate', () => {
  test('every core route renders its own content, not a 404/login/error page', async ({ page }) => {
    test.setTimeout(300_000);
    const wsId = await login(page);
    for (const route of CORE_ROUTES) {
      await openVerifiedRoute(page, wsId, route);
      // A page must expose exactly one page-level heading for screen-reader
      // navigation; the 404 and login pages are excluded by the gate above.
      await expect(
        page.locator('main#main-content').getByRole('heading', { level: 1 }),
        `${route.seg || '(dashboard)'} did not render exactly one page-level h1`,
      ).toHaveCount(1);
    }
  });
});

test.describe('a11y — real pages, both themes', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`axe: zero serious/critical across core routes (${theme})`, async ({ page }) => {
      test.setTimeout(300_000);
      const wsId = await login(page);
      await page.evaluate((t) => localStorage.setItem('theme', t), theme);
      for (const route of CORE_ROUTES) {
        await openVerifiedRoute(page, wsId, route);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const bad = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          bad.map((v) => `${v.id}(${v.nodes.length})`),
          `serious/critical violations on ${route.seg || '(dashboard)'} (${theme})`,
        ).toEqual([]);
      }
    });
  }
});

test.describe('responsive overflow', () => {
  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    test(`no accidental horizontal overflow @${width}`, async ({ page }) => {
      test.setTimeout(300_000);
      const wsId = await login(page);
      await page.setViewportSize({ width, height: 850 });
      for (const route of CORE_ROUTES) {
        await openVerifiedRoute(page, wsId, route);
        const overX = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        // Intentional scroll containers (kanban/calendar/tables) are inside
        // overflow-x-auto wrappers; the PAGE itself must not scroll sideways.
        // Verified-route first: an error page reports overX === 0.
        expect(overX, `${route.name} overflows at ${width}px`).toBeLessThanOrEqual(2);
      }
    });
  }
});

/**
 * Visual baselines.
 *
 * CI does not compare these. `.github/workflows/ci-frontend.yml:62` excludes
 * the "visual baselines" grep from the gating run and `:67` re-runs it with
 * `--update-snapshots`, which rewrites every PNG and always exits 0. Cross-OS
 * font rasterization is the stated reason, so the committed `-win32` PNGs can
 * never be compared from the `ubuntu-latest` runner.
 *
 * Required CI change to make this a real gate (workflows are out of scope for
 * this change): run `pnpm exec playwright test --grep "visual baselines"`
 * without `--update-snapshots` on a pinned image with committed `-linux`
 * baselines, or drop the refresh step and let the failure block.
 */
test.describe('visual baselines', () => {
  // `name` is the baseline slug and must match the committed PNG exactly.
  // It previously doubled as the path and was recovered with `name.slice(1)`,
  // which turned "dashboard" into "ashboard" — 8 of the 36 baselines could
  // never resolve.
  const SHOTS: Array<[string, string]> = [
    ['login', '/login'],
    ['dashboard', ''],
    ['chat', '/chat'],
    ['files', '/files'],
    ['memory', '/memory'],
    ['resume', '/resume'],
    ['schedule', '/schedule'],
    ['approvals', '/approvals'],
    ['settings', '/settings'],
  ];

  for (const theme of ['dark', 'light'] as const) {
    for (const vp of [375, 1440] as const) {
      for (const [name, seg] of SHOTS) {
        if (name !== 'login') continue;
        test(`${name} ${theme} ${vp}`, async ({ page }) => {
          test.setTimeout(120_000);
          await page.setViewportSize({ width: vp, height: vp === 375 ? 812 : 900 });
          await page.goto('/login', { waitUntil: 'domcontentloaded' });
          await page.evaluate((t) => localStorage.setItem('theme', t), theme);
          await page.goto(seg, { waitUntil: 'networkidle' });
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
          await page.waitForTimeout(600);
          await expect(page).toHaveScreenshot(`${name}-${theme}-${vp}.png`);
        });
      }
    }
  }

  for (const theme of ['dark', 'light'] as const) {
    for (const vp of [375, 1440] as const) {
      for (const [name, seg] of SHOTS) {
        if (name === 'login') continue;
        test(`${name} ${theme} ${vp}`, async ({ page }) => {
          test.setTimeout(120_000);
          const wsId = await login(page);
          await page.setViewportSize({ width: vp, height: vp === 375 ? 812 : 900 });
          await page.evaluate((t) => localStorage.setItem('theme', t), theme);
          await gotoWorkspace(page, wsId, seg);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1400);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
          await expect(page).toHaveScreenshot(`${name}-${theme}-${vp}.png`);
        });
      }
    }
  }
});
