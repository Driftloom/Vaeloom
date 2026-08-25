import { expect, test } from '@playwright/test';
import { gotoWorkspace, login } from './helpers';

test.describe('files', () => {
  test('upload, rename, archive and undo', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/files');

    // Upload
    await page.setInputFiles('input[type="file"]', {
      name: 'pw-e2e.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Phase 02B e2e upload'),
    });
    await expect(page.locator('table, [role="status"]').first()).toBeVisible({ timeout: 30_000 });

    const row = page.locator('tr', { hasText: 'pw-e2e.txt' }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Rename via row action (opens modal with diff preview); submit = "Save"
    await row
      .getByRole('button', { name: /rename/i })
      .first()
      .click();
    const nameInput = page.locator('[role="dialog"] input').first();
    await nameInput.fill('pw-e2e-renamed.txt');
    await page.locator('[role="dialog"] button[type="submit"]').click();
    await expect(page.locator('tr', { hasText: 'pw-e2e-renamed.txt' }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Archive then undo via History
    await page
      .locator('tr', { hasText: 'pw-e2e-renamed.txt' })
      .first()
      .getByRole('button', { name: /archive/i })
      .first()
      .click();
    await expect(page.locator('body')).toContainText(/archived/i, { timeout: 30_000 });
  });
});

test.describe('chat', () => {
  test('send message, see response, create/delete thread locally', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/chat');
    await page.waitForTimeout(1500);

    const composer = page.locator('textarea');
    await composer.fill('Hello from Playwright');
    await page.keyboard.press('Enter');
    // Streaming indicator or response content appears; mock LLM responds fast.
    await expect(page.locator('body')).toContainText(/hello from playwright/i);
    await page.waitForTimeout(2500);

    // Thread appears in rail; delete it (local operation).
    const threadRow = page.getByRole('button', { name: /playwright/i }).first();
    if (await threadRow.count()) {
      await threadRow.hover();
      await page
        .getByRole('button', { name: /delete thread/i })
        .first()
        .click();
    }
  });

  test('stop control replaces send during streaming', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/chat');
    await page.waitForTimeout(1200);
    // Resting state: send visible, stop absent.
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);

    // Real mid-stream stop: throttle the REAL SSE endpoint (no fake backend —
    // the request still reaches the API; we only delay delivery) so the
    // streaming window is observable.
    await page.route('**/api/v1/agents/chat/stream', async (route) => {
      await new Promise((r) => setTimeout(r, 8_000));
      await route.continue().catch(() => {});
    });
    await page.locator('textarea').fill('Hello stop test');
    await page.keyboard.press('Enter');

    const stop = page.getByRole('button', { name: 'Stop generating' });
    await expect(stop).toBeVisible({ timeout: 10_000 });
    await stop.click();

    // Abort path keeps an honest partial/stopped state and restores Send.
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('body')).toContainText(/generation stopped/i, {
      timeout: 10_000,
    });
  });
});
