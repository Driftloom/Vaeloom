import { expect, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@vaeloom.ai';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'password123';

export async function fillLoginForm(page: Page, email: string, password: string) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  for (let i = 0; i < 20; i++) {
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await page.waitForTimeout(150);
    if ((await emailInput.inputValue()) === email) return;
  }
  throw new Error('login form did not stay hydrated');
}

export async function loginAsUser(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /log in to vaeloom/i })).toBeVisible();
  await fillLoginForm(page, TEST_EMAIL, TEST_PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/workspace\//);
}

export async function openSidebar(page: Page) {
  const sidebar = page.locator('[data-testid="sidebar"]');
  await expect(sidebar).toBeAttached();
  const onScreen = await sidebar.evaluate((el) => el.getBoundingClientRect().left >= 0);
  if (onScreen) return;
  await page.getByRole('button', { name: /open navigation/i }).click();
  await expect(sidebar).toBeVisible();
  await page.waitForTimeout(300);
}

export function workspaceUrl(workspaceId: string, path = ''): string {
  return `/workspace/${workspaceId}${path}`;
}
