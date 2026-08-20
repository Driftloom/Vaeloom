import { test, expect } from '@playwright/test';
import { config, apiUrl } from './config';

test.describe('Basic Smoke Tests', () => {
  test('homepage loads marketing page for unauthenticated user', async ({ page }) => {
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
    // '/' is public per middleware PUBLIC_PATHS — shows marketing, not redirect
    await expect(page.locator('h1')).toContainText('Your AI-powered', {
      timeout: config.timeouts.element,
    });
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test('login page loads with correct elements', async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle' });
    await expect(page.locator('h2')).toContainText('Welcome back', {
      timeout: config.timeouts.element,
    });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('signup page loads and has link to login', async ({ page }) => {
    await page.goto(`${config.baseUrl}/signup`, { waitUntil: 'networkidle' });
    await expect(page.locator('h2')).toContainText('Create your account', {
      timeout: config.timeouts.element,
    });
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test('login form shows validation errors on empty submit', async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Email is required').first()).toBeVisible({
      timeout: config.timeouts.element,
    });
    await expect(page.locator('text=Password is required').first()).toBeVisible();
  });

  test('login form shows error for invalid credentials', async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill('nonexistent@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: config.timeouts.element });
  });

  test('API health check responds ok', async ({ page }) => {
    // health is at /health (not /api/v1/health) per apps/api/src/api/main.py
    const response = await page.request.get(`${config.apiUrl}/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('service');
    expect(body).toHaveProperty('version');
  });

  test('workspace page redirects unauthenticated to login', async ({ page }) => {
    await page.goto(`${config.baseUrl}/workspace/some-id`, { waitUntil: 'networkidle' });
    await page.waitForURL('**/login**', { timeout: config.timeouts.navigation });
    expect(page.url()).toContain('/login');
  });

  test('signup flow creates account and redirects', async ({ page }) => {
    const email = `smoke-${Date.now()}@vaeloom.test`;
    await page.goto(`${config.baseUrl}/signup`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('#password').fill(config.auth.testPassword);
    await page.locator('#confirmPassword').fill(config.auth.testPassword);
    await page.locator('button[type="submit"]').click();
    // signup currently redirects to '/' (marketing) per page.tsx:59 router.push('/'); test checks auth success via token, not workspace URL
    await page.waitForURL('**/', { timeout: config.timeouts.navigation });
    // verify auth succeeded by checking localStorage (set by useAuth login/signup)
    const token = await page.evaluate(() => localStorage.getItem('vaeloom.accessToken'));
    expect(token).toBeTruthy();
  });
});
