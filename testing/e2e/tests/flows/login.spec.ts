import { test, expect } from '@playwright/test';
import { loginAsUser, fillLoginForm } from './helpers';

test.describe('Login Flow', () => {
  test('navigates to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });

  test('successful login redirects to workspace', async ({ page }) => {
    await loginAsUser(page);
    await expect(page.locator('[data-testid="workspace-dashboard"]')).toBeVisible();
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /log in to vaeloom/i })).toBeVisible();
    await fillLoginForm(page, 'wrong@vaeloom.ai', 'wrongpass');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
