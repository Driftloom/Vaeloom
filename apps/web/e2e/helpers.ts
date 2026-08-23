import type { Page } from '@playwright/test';

export const TEST_USER = {
  email: 'audit@vaeloom.test',
  password: 'AuditPass123!',
};

/** UI login against the real backend; resolves to the workspace id. */
export async function login(page: Page): Promise<string> {
  await page.goto('/login', { waitUntil: 'load' });
  await page.fill('#email', TEST_USER.email);
  await page.fill('#password', TEST_USER.password);
  await Promise.all([
    page.waitForURL(/\/workspace\/[^/]+/, { timeout: 45_000 }),
    page.click('button[type="submit"]'),
  ]);
  const m = page.url().match(/\/workspace\/([^/?]+)/);
  const wsId = m?.[1];
  if (!wsId) throw new Error('login did not land in a workspace');
  return wsId;
}

export async function gotoWorkspace(page: Page, wsId: string, seg = ''): Promise<void> {
  await page.goto(`/workspace/${wsId}${seg}`, { waitUntil: 'domcontentloaded' });
}
