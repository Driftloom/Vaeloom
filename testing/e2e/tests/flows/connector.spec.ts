import { test, expect } from '@playwright/test';

test.describe('Connectors Page', () => {
  test('navigates to connectors and verifies list', async ({ page }) => {
    await page.goto('/workspace/connectors');
    await expect(page.locator('[data-testid="connectors-page"]')).toBeVisible();
    const connectorCards = page.locator('[data-testid="connector-card"]');
    await expect(connectorCards.first()).toBeVisible();
    const count = await connectorCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('connector cards display name and status', async ({ page }) => {
    await page.goto('/workspace/connectors');
    const firstCard = page.locator('[data-testid="connector-card"]').first();
    await expect(firstCard.locator('[data-testid="connector-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="connector-status"]')).toBeVisible();
  });

  test('connect button opens modal', async ({ page }) => {
    await page.goto('/workspace/connectors');
    const connectBtn = page.locator('[data-testid="connector-card"] [data-testid="connect-button"]').first();
    await connectBtn.click();
    await expect(page.locator('[data-testid="connector-modal"], [role="dialog"]')).toBeVisible();
  });

  test('connect modal has form fields', async ({ page }) => {
    await page.goto('/workspace/connectors');
    await page.locator('[data-testid="connector-card"] [data-testid="connect-button"]').first().click();
    const modal = page.locator('[data-testid="connector-modal"], [role="dialog"]');
    await expect(modal.locator('input, select, textarea').first()).toBeVisible();
    await expect(modal.getByRole('button', { name: /connect|confirm|save/i })).toBeVisible();
  });

  test('cancel closes connect modal', async ({ page }) => {
    await page.goto('/workspace/connectors');
    await page.locator('[data-testid="connector-card"] [data-testid="connect-button"]').first().click();
    const modal = page.locator('[data-testid="connector-modal"], [role="dialog"]');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /cancel|close/i }).click();
    await expect(modal).not.toBeVisible();
  });
});
