import { test, expect } from '@playwright/test';
import { loginAsUser, openSidebar } from './helpers';

test.describe('Connectors Page', () => {
  test('navigates to connectors and verifies list', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/connectors/i)
      .click();
    await expect(page.locator('[data-testid="connectors-page"]')).toBeVisible();
    const connectorCards = page.locator('[data-testid="connector-card"]');
    await expect(connectorCards.first()).toBeVisible();
    const count = await connectorCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('connector cards display name and status', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/connectors/i)
      .click();
    const firstCard = page.locator('[data-testid="connector-card"]').first();
    await expect(firstCard.locator('[data-testid="connector-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="connector-status"]')).toBeVisible();
  });

  test('disconnected connector shows connect button', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/connectors/i)
      .click();
    const firstCard = page.locator('[data-testid="connector-card"]').first();
    await expect(firstCard.locator('[data-testid="connect-button"]')).toBeVisible();
  });

  test('connect button triggers a connection attempt', async ({ page }) => {
    await loginAsUser(page);
    await openSidebar(page);
    await page
      .locator('[data-testid="sidebar"]')
      .getByText(/connectors/i)
      .click();
    const firstCard = page.locator('[data-testid="connector-card"]').first();
    const connectBtn = firstCard.locator('[data-testid="connect-button"]');
    await expect(connectBtn).toBeVisible();

    const requestPromise = page.waitForRequest(
      (req) => req.method() === 'POST' && /\/api\/v1\/integrations$/.test(req.url()),
    );
    await connectBtn.click();
    const request = await requestPromise;
    expect(request.postDataJSON()).toHaveProperty('name');
  });
});
