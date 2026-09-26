import { expect, test } from '@playwright/test';
import { apiRequest, gotoWorkspace, login } from './helpers';

/**
 * Negative-path coverage that did not previously exist: unknown routes, an
 * unauthenticated deep link, and session teardown.
 *
 * Each test asserts an exact URL plus distinguishing rendered content, because
 * "the page is not blank" is satisfied equally by the 404 page, the login page
 * and an error boundary — which is how the previous assertions could pass while
 * proving nothing.
 */

test.describe('negative paths', () => {
  test('an unknown workspace route renders the full 404 page', async ({ page }) => {
    const wsId = await login(page);
    await page.goto(`/workspace/${wsId}/this-route-does-not-exist`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Workspace not found' }),
    ).toBeVisible();
    await expect(page.getByText(/does not exist or you do not have access/i)).toBeVisible();
    // A recovery affordance, so this is a rendered page and not a bare heading.
    await expect(page.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/');
    // A blank/error shell has no such explanation copy; a real 404 always does.
    await expect(page.locator('main#main-content')).toBeVisible();
  });

  test('an unknown public route renders the full 404 page', async ({ page }) => {
    await page.goto('/definitely-not-a-real-public-route', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Page not found' })).toBeVisible();
    await expect(page.getByText(/does not exist or has been moved/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/');
    // The public 404 must not leak the authenticated workspace shell.
    await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toHaveCount(0);
  });

  test('an unauthenticated deep link is sent to login and exposes no workspace chrome', async ({
    page,
  }) => {
    await page.goto('/workspace/00000000-0000-0000-0000-000000000000/settings');

    // workspace/[workspaceId]/layout.tsx:106 performs router.replace('/login')
    // with no return path, so the expected URL is the bare login route.
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    // The workspace shell only renders for an authenticated session, so its
    // absence is what proves the deep link was actually blocked.
    await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '404' })).toHaveCount(0);
  });

  test('an unauthenticated API call is rejected with 401', async ({ request }) => {
    // A standalone APIRequestContext carries no session at all.
    const res = await request.get('/api/v1/approvals?page=1&page_size=1');
    expect(res.status()).toBe(401);
  });

  test('logout clears the session and blocks the previous workspace URL', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/settings');
    await expect(page.getByRole('heading', { level: 1, name: /Workspace Settings/ })).toBeVisible({
      timeout: 30_000,
    });

    const before = await page.evaluate(() => ({
      token: window.localStorage.getItem('vaeloom.accessToken'),
      cookie: document.cookie,
    }));
    expect(before.token, 'login left no access token to clear').toBeTruthy();
    expect(before.cookie).toContain('vaeloom.accessToken=');

    await page.getByRole('button', { name: 'User account menu' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 30_000 });

    const after = await page.evaluate(() => ({
      token: window.localStorage.getItem('vaeloom.accessToken'),
      cookie: document.cookie,
    }));
    expect(after.token, 'logout left the access token in storage').toBeNull();
    expect(after.cookie, 'logout left the access token cookie behind').not.toContain(
      'vaeloom.accessToken=',
    );

    // A hard navigation re-runs the layout's auth check, so the old URL must
    // bounce back to login rather than restoring the shell from cache.
    await page.goto(`/workspace/${wsId}/settings`);
    await page.waitForURL((u) => u.pathname === '/login', { timeout: 30_000 });
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toHaveCount(0);
  });

  test('a document outside the session workspace is not served', async ({ page }) => {
    const wsId = await login(page);
    const foreign = await apiRequest(page, {
      method: 'GET',
      path:
        '/api/v1/documents/00000000-0000-0000-0000-000000000000/content' +
        `?workspace_id=${encodeURIComponent(wsId)}`,
    });
    // _verify_workspace_access passes for our own workspace, then the missing
    // document id is a 404 (documents.py:337-338) — never content.
    expect(foreign.status, `unexpected body: ${foreign.text.slice(0, 200)}`).toBe(404);
  });
});
