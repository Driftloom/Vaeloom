import { test, expect } from '@playwright/test';

test.describe('Workspace Dashboard', () => {
  test('navigates to workspace and verifies sidebar', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page.locator('[data-testid="workspace-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    const navItems = page.locator('[data-testid="sidebar"] a, [data-testid="sidebar"] button[role="menuitem"]');
    await expect(navItems.first()).toBeVisible();
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sidebar navigation items render', async ({ page }) => {
    await page.goto('/workspace');
    const expectedLabels = [/connectors/i, /memories/i, /agents/i, /settings/i];
    for (const label of expectedLabels) {
      await expect(page.locator('[data-testid="sidebar"]').getByText(label).first()).toBeVisible();
    }
  });

  test('clicking connectors nav loads connectors page', async ({ page }) => {
    await page.goto('/workspace');
    await page.locator('[data-testid="sidebar"]').getByText(/connectors/i).click();
    await expect(page).toHaveURL(/\/workspace\/connectors/);
    await expect(page.locator('[data-testid="connectors-page"]')).toBeVisible();
  });

  test('clicking memories nav loads memories page', async ({ page }) => {
    await page.goto('/workspace');
    await page.locator('[data-testid="sidebar"]').getByText(/memories/i).click();
    await expect(page).toHaveURL(/\/workspace\/memories/);
  });

  test('clicking agents nav loads agents page', async ({ page }) => {
    await page.goto('/workspace');
    await page.locator('[data-testid="sidebar"]').getByText(/agents/i).click();
    await expect(page).toHaveURL(/\/workspace\/agents/);
  });

  test('clicking settings nav loads settings page', async ({ page }) => {
    await page.goto('/workspace');
    await page.locator('[data-testid="sidebar"]').getByText(/settings/i).click();
    await expect(page).toHaveURL(/\/workspace\/settings/);
  });
});
