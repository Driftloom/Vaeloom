import { test, expect } from '@playwright/test';
import { loginAsUser, openSidebar } from './helpers';

test.describe('Workspace Dashboard', () => {
  test('navigates to workspace and verifies sidebar', async ({ page }) => {
    await loginAsUser(page);
    await expect(page.locator('[data-testid="workspace-dashboard"]')).toBeVisible();
    await openSidebar(page);
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    const navItems = page.locator('[data-testid="sidebar"] a');
    await expect(navItems.first()).toBeVisible();
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('sidebar navigation items render', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    const expectedLabels = [/connectors/i, /memory graph/i, /resume/i, /settings/i];
    for (const label of expectedLabels) {
      await expect(page.locator('[data-testid="sidebar"]').getByText(label).first()).toBeVisible();
    }
  });

  test('clicking connectors nav loads connectors page', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/connectors/i)
      .click();
    await expect(page).toHaveURL(/\/workspace\/[^/]+\/connectors/);
    await expect(page.locator('[data-testid="connectors-page"]')).toBeVisible();
  });

  test('clicking memory graph nav loads memory page', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/memory graph/i)
      .click();
    await expect(page).toHaveURL(/\/workspace\/[^/]+\/memory/);
  });

  test('clicking resume nav loads resume page', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/resume/i)
      .click();
    await expect(page).toHaveURL(/\/workspace\/[^/]+\/resume/);
  });

  test('clicking settings nav loads settings page', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/settings/i)
      .click();
    await expect(page).toHaveURL(/\/workspace\/[^/]+\/settings/);
  });
});
