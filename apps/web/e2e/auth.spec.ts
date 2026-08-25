import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('auth', () => {
  test('login rejects bad credentials with an inline error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'audit@vaeloom.test');
    await page.fill('#password', 'wrong-password');
    await page.click('button[type="submit"]');
    await expect(page.locator('form [role="alert"]')).toBeVisible();
  });

  test('login succeeds and lands in workspace', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
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
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });

  test('auth callback route exists (no 404)', async ({ request }) => {
    const res = await request.get('/auth/callback?code=x&state=y');
    // The SPA page renders (200) even when the exchange itself fails.
    expect(res.status()).toBe(200);
  });
});

test.describe('workspace navigation', () => {
  test('sidebar reaches every core route', async ({ page }) => {
    const wsId = await login(page);
    for (const seg of [
      '/chat',
      '/memory',
      '/files',
      '/history',
      '/jobs',
      '/applications',
      '/resume',
      '/schedule',
      '/connectors',
      '/approvals',
      '/notifications',
      '/agents',
      '/settings',
    ]) {
      await page.goto(`/workspace/${wsId}${seg}`);
      await expect(page.locator('h1')).toHaveCount(1);
      const main = page.locator('main#main-content');
      await expect(main).toHaveCount(1);
    }
  });
});
