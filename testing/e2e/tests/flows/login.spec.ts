import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('navigates to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('successful login redirects to workspace', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@vaeloom.ai');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/workspace/);
    await expect(page.locator('[data-testid="workspace-dashboard"]')).toBeVisible();
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('wrong@vaeloom.ai');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
