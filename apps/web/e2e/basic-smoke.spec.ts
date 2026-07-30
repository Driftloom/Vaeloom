import { test, expect } from '@playwright/test';
import { config, apiUrl } from './config';

test.describe('Basic Smoke Tests', () => {
  test('homepage redirects unauthenticated user to login', async ({ page }) => {
    await page.goto(config.baseUrl, { waitUntil: 'networkidle' });
    await page.waitForURL('**/login', { timeout: config.timeouts.navigation });
    expect(page.url()).toContain('/login');
  });

  test('login page loads with correct elements', async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText('Log in to Vaeloom');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: config.timeouts.element });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Log in');
  });

  test('signup page loads and has link to login', async ({ page }) => {
    await page.goto(`${config.baseUrl}/signup`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText('Sign up');
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test('login form shows validation errors on empty submit', async ({ page }) => {
    await page.goto(`${config.baseUrl}/login`, { waitUntil: 'networkidle' });
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Email is required').first()).toBeVisible({ timeout: config.timeouts.element });
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
    const response = await page.request.get(apiUrl('/health'));
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
    await page.locator('input[type="password"]').fill(config.auth.testPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/workspace/**', { timeout: config.timeouts.navigation });
    expect(page.url()).toContain('/workspace/');
  });
});
