import { expect, test, type Page } from '@playwright/test';
import { WORKSPACE_ROUTES, type RouteDefinition } from '../src/lib/route-manifest';
import { login } from './helpers';

/**
 * Route smoke gate — breadth coverage of the WHOLE route surface.
 *
 * The plan's Eng finding T7 is "12/34 routes smoke-tested": quality.spec.ts
 * deep-scans (axe, overflow, visual) a curated 12-route core, which let the
 * other ~23 routes 404 or crash unnoticed. This spec closes that gap by driving
 * the sweep off `WORKSPACE_ROUTES` — the manifest its own header names as the
 * source for "Automated E2E route coverage" — so the smoke set grows
 * automatically whenever a route is added, instead of rotting against a
 * hand-copied list.
 *
 * What each route must prove, and NOTHING more:
 *   • it is reachable (the URL it declares is the URL it lands on),
 *   • it renders a page-level <h1> (a real header, not a spinner-only shell),
 *   • it does NOT render the 404 catch-all ([...catchAll] → "404") or a blank
 *     error boundary.
 *
 * Exact heading text and a11y are NOT asserted here — auth.spec.ts pins the
 * h1 copy and quality.spec.ts runs axe. Splitting the concerns keeps this the
 * cheap, wide net that catches "route disappeared / route crashes", which is
 * precisely what 22 uncovered routes were missing.
 *
 * Enterprise routes render their gate panel (<h1>"… is an Enterprise feature")
 * in this environment because the seeded tenant carries no enterprise
 * entitlement — E6 makes that capability server-derived and fail-closed. A gate
 * panel is a legitimate render: one <h1>, not a 404, so it passes. The gate is
 * proving the ROUTE exists and paints, not that the feature is entitled on.
 */

/**
 * `/connectors` is a client redirect stub (connectors/page.tsx) that lands on
 * the capabilities directory with the connectors category pre-selected, so the
 * post-navigation URL is NOT the declared subpath. That is correct behaviour,
 * not a broken link; the redirect-target route is itself swept as `capabilities`.
 * Skipping it here avoids asserting a URL the app intentionally rewrites.
 */
const REDIRECT_STUBS = new Set(['connectors']);

/**
 * Unauthenticated, public surfaces. These render outside the workspace layout
 * (no `main#main-content`), so they are swept with a page-level <h1> check.
 * Each is reachable with no session and no token: the token-gated flows
 * (reset-password, verify-email) paint an "invalid / missing token" heading
 * rather than redirecting, which is still "the route rendered".
 */
const PUBLIC_ROUTES: Array<{ name: string; path: string }> = [
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'reset-password', path: '/reset-password' },
  { name: 'verify-email', path: '/verify-email' },
  { name: 'status', path: '/status' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
];

const h1 = /^\s*404\s*$/;

/** Fail loudly if the sweep silently stops covering routes (selector drift, a
 *  manifest rename, a spec edit that drops entries). The manifest is the floor. */
const EXPECTED_MIN_COVERAGE = 34;

async function assertWorkspaceRouteRendered(page: Page, wsId: string, route: RouteDefinition) {
  const target = route.subpath ? `/workspace/${wsId}/${route.subpath}` : `/workspace/${wsId}`;
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  // Stay inside the workspace: a bounce to /login (lost session) or the global
  // 404 leaves this prefix and must fail the smoke gate, not satisfy it.
  await expect
    .poll(async () => new URL(page.url()).pathname.startsWith(`/workspace/${wsId}`), {
      message: `${route.id} navigated out of the workspace: ${page.url()}`,
      timeout: 30_000,
    })
    .toBe(true);

  const main = page.locator('main#main-content');
  const title = main.getByRole('heading', { level: 1 });
  await expect(title, `${route.id} rendered no page-level <h1>`).toBeVisible({ timeout: 30_000 });
  // Exactly one page-level heading: two <h1>s is the regression quality.spec.ts
  // already guards for /capabilities, and zero-or-many means the shell broke.
  await expect(
    title,
    `${route.id} rendered ${await title.count()} page-level <h1>s, expected 1`,
  ).toHaveCount(1);
  await expect(title, `${route.id} hit the 404 catch-all`).not.toHaveText(h1);
}

test.describe('route smoke — full workspace surface', () => {
  test('every manifest route renders exactly one <h1> and never a 404', async ({ page }) => {
    test.setTimeout(600_000);
    const wsId = await login(page);

    const swept: string[] = [];
    for (const route of WORKSPACE_ROUTES) {
      if (REDIRECT_STUBS.has(route.id)) continue;
      await assertWorkspaceRouteRendered(page, wsId, route);
      swept.push(route.id);
    }

    // Sanity: the loop actually visited the manifest, rather than collecting an
    // empty list because WORKSPACE_ROUTES stopped being importable.
    expect(swept.length, 'workspace sweep collected no routes').toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[route-smoke] workspace routes swept: ${swept.length}/${WORKSPACE_ROUTES.length}`);
  });
});

test.describe('route smoke — public surface', () => {
  test('every public route renders exactly one <h1> and never a 404', async ({ page }) => {
    test.setTimeout(300_000);
    for (const { name, path } of PUBLIC_ROUTES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const title = page.getByRole('heading', { level: 1 });
      await expect(title, `${name} rendered no page-level <h1>`).toBeVisible({ timeout: 30_000 });
      await expect(
        title,
        `${name} rendered ${await title.count()} page-level <h1>s, expected 1`,
      ).toHaveCount(1);
      await expect(title, `${name} hit the 404 page`).not.toHaveText(h1);
    }
  });
});

test('route-smoke coverage meets the plan floor', () => {
  // Structural guard, not a browser check: asserts the sweep is as wide as the
  // plan's P1 target (T7: 12 -> 34) by construction. WORKSPACE_ROUTES is the
  // authoritative count, so this fails only if the manifest shrinks below the
  // documented surface or a public route is deleted — both of which demand a
  // deliberate, reviewable change here rather than a silent loss of coverage.
  const covered =
    WORKSPACE_ROUTES.filter((r) => !REDIRECT_STUBS.has(r.id)).length + PUBLIC_ROUTES.length;
  // eslint-disable-next-line no-console
  console.log(`[route-smoke] total routes covered: ${covered}`);
  expect(covered).toBeGreaterThanOrEqual(EXPECTED_MIN_COVERAGE);
});
