import { expect, type Locator, type Page } from '@playwright/test';

export const TEST_USER = {
  email: 'audit@vaeloom.test',
  password: 'AuditPass123!',
};

/** UI login against the real backend; resolves to the workspace id. */
export async function login(page: Page): Promise<string> {
  await page.goto('/login', { waitUntil: 'load' });
  await page.fill('#email', TEST_USER.email);
  await page.fill('#password', TEST_USER.password);
  await Promise.all([
    page.waitForURL(/\/workspace\/[^/]+/, { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ]);
  const m = page.url().match(/\/workspace\/([^/?]+)/);
  const wsId = m?.[1];
  if (!wsId) throw new Error('login did not land in a workspace');
  return wsId;
}

export async function gotoWorkspace(page: Page, wsId: string, seg = ''): Promise<void> {
  await page.goto(`/workspace/${wsId}${seg}`, { waitUntil: 'domcontentloaded' });
}

export interface ApiResult<T = unknown> {
  status: number;
  json: T | null;
  text: string;
}

/**
 * Authenticated JSON call executed INSIDE the logged-in browser context.
 *
 * Tests must keep using `login()` (real UI form submit, no token injection).
 * This helper exists only to arrange preconditions through the app's own API
 * surface, so it reuses the session the app already established: the bearer
 * token the app wrote to storage, plus the same CSRF double-submit handshake
 * the app's own client performs (middleware/csrf.py guards every mutating
 * method, Bearer or not).
 *
 * It never fabricates or bypasses a session — an unauthenticated call returns
 * 401 and the caller's exact-status assertion fails.
 */
export async function apiRequest<T = unknown>(
  page: Page,
  opts: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown },
): Promise<ApiResult<T>> {
  return page.evaluate(
    async (o: { method: string; path: string; body: unknown }) => {
      const token = window.localStorage.getItem('vaeloom.accessToken');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (o.method !== 'GET') {
        const csrfRes = await fetch('/csrf-token', { credentials: 'include' });
        const csrfJson = (await csrfRes.json()) as { csrf_token?: string };
        if (!csrfJson.csrf_token) throw new Error('CSRF token endpoint returned no token');
        headers['X-CSRF-Token'] = csrfJson.csrf_token;
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(o.path, {
        method: o.method,
        headers,
        credentials: 'include',
        body: o.body === null ? undefined : JSON.stringify(o.body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, json, text };
    },
    { method: opts.method, path: opts.path, body: opts.body === undefined ? null : opts.body },
  ) as Promise<ApiResult<T>>;
}

/**
 * Fails loudly when a route did not actually render.
 *
 * Without this, a 404 page, a login redirect or a blank error boundary all look
 * "clean" to an axe scan (no violations) and to an overflow measurement
 * (scrollWidth === clientWidth), so both gates silently pass on broken pages.
 *
 * `marker` must be a locator that only the real page content can satisfy. The
 * sidebar and the top-nav breadcrumb share most route names ("Chat", "Memory",
 * "Approvals"), so a plain text search over the document is not discriminating.
 */
export async function expectRouteRendered(
  page: Page,
  opts: { seg: string; expectPath: string; marker: Locator },
): Promise<void> {
  const { seg, expectPath, marker } = opts;

  // A login redirect fails this; a client-side redirect stub (e.g.
  // /connectors -> /capabilities?category=connectors) satisfies it, which is why
  // the expected path is route data rather than a constant.
  try {
    await page.waitForURL((u) => u.pathname + u.search === expectPath, { timeout: 30_000 });
  } catch {
    throw new Error(
      `route ${seg || '(dashboard)'} never reached ${expectPath}; landed on ${page.url()} — ` +
        'a login redirect, 404 or client error must fail the gate, not satisfy it',
    );
  }

  const main = page.locator('main#main-content');
  await expect(main).toBeVisible();

  // Both 404 pages render exactly one <h1> reading "404"; a gate that only
  // counts headings is satisfied by them.
  await expect(
    main.locator('h1', { hasText: /^\s*404\s*$/ }),
    `${seg} rendered the 404 page instead of the route`,
  ).toHaveCount(0);

  await expect(marker, `${seg} did not render its route-specific landmark`).toBeVisible({
    timeout: 30_000,
  });
}
