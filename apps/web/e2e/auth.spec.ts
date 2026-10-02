import { expect, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Sidebar contract for workspace portal mode. Kept in sync with the manifest's
 * `getNavigationGroups(ws, { portalMode: 'workspace' })` output — every link a
 * workspace user actually sees. Portal-curated routes that live only in the
 * admin/developer/enterprise groups (Schedule, Secrets Vault, Billing,
 * Connectors, Admin, …) are NOT in this nav, so they are covered by URL
 * navigation in ROUTE_HEADINGS below instead.
 *
 * For each entry the click must land on the exact URL AND the app must mark
 * that link `aria-current="page"` — a wrong/dead link or a silent client-side
 * failure cannot satisfy both.
 */
const SIDEBAR_ROUTES: Array<{ label: string; landsOn: (ws: string) => string }> = [
  { label: 'Dashboard', landsOn: (ws) => `/workspace/${ws}` },
  { label: 'Chat', landsOn: (ws) => `/workspace/${ws}/chat` },
  { label: 'Agents', landsOn: (ws) => `/workspace/${ws}/agents` },
  { label: 'Capabilities', landsOn: (ws) => `/workspace/${ws}/capabilities` },
  { label: 'Approvals', landsOn: (ws) => `/workspace/${ws}/approvals` },
  { label: 'Second Brain', landsOn: (ws) => `/workspace/${ws}/memory` },
  { label: 'Vault Sync', landsOn: (ws) => `/workspace/${ws}/memory/vault` },
  { label: 'Search', landsOn: (ws) => `/workspace/${ws}/search` },
  { label: 'Documents', landsOn: (ws) => `/workspace/${ws}/files` },
  { label: 'Career Strategy', landsOn: (ws) => `/workspace/${ws}/career` },
  { label: 'Resumes', landsOn: (ws) => `/workspace/${ws}/resume` },
  { label: 'Jobs', landsOn: (ws) => `/workspace/${ws}/jobs` },
  { label: 'Applications', landsOn: (ws) => `/workspace/${ws}/applications` },
  { label: 'Tasks & DAGs', landsOn: (ws) => `/workspace/${ws}/tasks` },
  { label: 'Activity Log', landsOn: (ws) => `/workspace/${ws}/history` },
  { label: 'Email Intel', landsOn: (ws) => `/workspace/${ws}/email` },
  { label: 'Profile & Account', landsOn: (ws) => `/workspace/${ws}/profile` },
  { label: 'Workspace Settings', landsOn: (ws) => `/workspace/${ws}/settings` },
  { label: 'Security & Keys', landsOn: (ws) => `/workspace/${ws}/settings/security` },
  { label: 'Help & Guides', landsOn: (ws) => `/workspace/${ws}/help` },
];

/** h1 text of each destination, so "the page rendered" is not just "an h1 exists". */
const ROUTE_HEADINGS: Array<{
  path: (ws: string) => string;
  heading: RegExp;
  subheading?: RegExp;
}> = [
  { path: (ws) => `/workspace/${ws}`, heading: /E2E Audit/ },
  { path: (ws) => `/workspace/${ws}/chat`, heading: /^Chat$/ },
  { path: (ws) => `/workspace/${ws}/memory`, heading: /^Second Brain & Memory$/ },
  { path: (ws) => `/workspace/${ws}/files`, heading: /Workspace Files/ },
  { path: (ws) => `/workspace/${ws}/history`, heading: /^History$/ },
  { path: (ws) => `/workspace/${ws}/jobs`, heading: /^Jobs$/ },
  { path: (ws) => `/workspace/${ws}/applications`, heading: /^Applications$/ },
  { path: (ws) => `/workspace/${ws}/resume`, heading: /^Resume$/ },
  { path: (ws) => `/workspace/${ws}/schedule`, heading: /^Schedule$/ },
  { path: (ws) => `/workspace/${ws}/approvals`, heading: /^Approvals$/ },
  { path: (ws) => `/workspace/${ws}/settings`, heading: /Workspace Settings/ },
  { path: (ws) => `/workspace/${ws}/settings/security`, heading: /^Security$/ },
  { path: (ws) => `/workspace/${ws}/agents`, heading: /Specialist Agent Fleet/ },
  { path: (ws) => `/workspace/${ws}/search`, heading: /Unified Enterprise Search/ },
  { path: (ws) => `/workspace/${ws}/career`, heading: /Strategy & Competency Radar/ },
  { path: (ws) => `/workspace/${ws}/tasks`, heading: /Autonomous Tasks & Workflow DAGs/ },
  { path: (ws) => `/workspace/${ws}/email`, heading: /^Email Intelligence$/ },
  { path: (ws) => `/workspace/${ws}/vault`, heading: /Sovereign Trust & Verifiable Credentials/ },
  { path: (ws) => `/workspace/${ws}/help`, heading: /Documentation & Help Center/ },
  {
    path: (ws) => `/workspace/${ws}/billing`,
    heading: /^(Billing|Billing is an Enterprise feature)$/,
  },
  {
    // The page h1 is "Capabilities"; ?category=connectors opens the Connectors
    // tab, whose panel is headed by an h2 "Connectors Studio". Assert both, so
    // this entry proves the URL param actually routed to the view.
    path: (ws) => `/workspace/${ws}/capabilities?category=connectors`,
    heading: /^Capabilities$/,
    subheading: /Connectors Studio/,
  },
];

test.describe('auth', () => {
  test('login rejects bad credentials with an inline error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'audit@vaeloom.test');
    await page.fill('#password', 'wrong-password');
    await page.click('button[type="submit"]');
    await expect(page.locator('form [role="alert"]')).toBeVisible();
  });

  test('login succeeds and lands in workspace', async ({ page }) => {
    const wsId = await login(page);
    expect(new URL(page.url()).pathname).toBe(`/workspace/${wsId}`);
  });

  test('signup validates weak password inline', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#displayName', 'Playwright Tester');
    await page.fill('#email', `pw-${Date.now()}@vaeloom.test`);
    await page.fill('#password', 'weak');
    await page.fill('#confirmPassword', 'weak');
    await page.click('button[type="submit"]');
    await expect(page.locator('form')).toContainText(/8 characters/i);
  });

  test('unauthenticated workspace access redirects to login', async ({ page }) => {
    await page.goto('/workspace/some-id/files');
    // The workspace layout performs a client-side `router.replace('/login')`
    // (workspace/[workspaceId]/layout.tsx:106) and passes NO return path, so the
    // expected URL is the bare login route. The previous assertion expected
    // `/login?redirect=`, a URL the application never produces.
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('auth callback route exists (no 404)', async ({ request }) => {
    const res = await request.get('/auth/callback?code=x&state=y');
    // The SPA page renders (200) even when the exchange itself fails.
    expect(res.status()).toBe(200);
  });
});

test.describe('workspace navigation', () => {
  test('every sidebar link navigates to its own route and marks it current', async ({ page }) => {
    test.setTimeout(300_000);
    const wsId = await login(page);
    const nav = page.getByRole('navigation', { name: 'Workspace navigation' });
    await expect(nav).toBeVisible();

    for (const { label, landsOn } of SIDEBAR_ROUTES) {
      const link = nav.getByRole('link', { name: label, exact: true });
      await expect(link, `sidebar has no link named "${label}"`).toHaveCount(1);
      await link.click();
      const expected = landsOn(wsId);
      try {
        await page.waitForURL((u) => u.pathname + u.search === expected, { timeout: 30_000 });
      } catch {
        throw new Error(
          `clicking sidebar link "${label}" did not land on ${expected}; landed on ${page.url()}`,
        );
      }
      await expect(
        page.locator('main#main-content h1', { hasText: /^\s*404\s*$/ }),
        `"${label}" rendered the 404 page`,
      ).toHaveCount(0);
      // aria-current is set by comparing the router pathname to the link's own
      // href, so it can only be present on the route the link targets.
      await expect(
        nav.getByRole('link', { name: label, exact: true }),
        `"${label}" is not marked aria-current after navigation`,
      ).toHaveAttribute('aria-current', 'page');
    }
  });

  test('each workspace route renders its own page heading', async ({ page }) => {
    test.setTimeout(600_000);
    const wsId = await login(page);
    for (const { path, heading, subheading } of ROUTE_HEADINGS) {
      const target = path(wsId);
      await page.goto(target, { waitUntil: 'domcontentloaded' });
      await page.waitForURL((u) => u.pathname + u.search === target, { timeout: 30_000 });
      await expect(
        page.locator('main#main-content').getByRole('heading', { level: 1 }),
        `${target} rendered no page-level h1 matching ${heading}`,
      ).toHaveText(heading, { timeout: 30_000 });
      if (subheading) {
        await expect(
          page
            .locator('main#main-content')
            .getByRole('heading', { level: 2 })
            .filter({ hasText: subheading }),
          `${target} rendered no h2 matching ${subheading}`,
        )
          .first()
          .toBeVisible({ timeout: 30_000 });
      }
    }
  });
});
