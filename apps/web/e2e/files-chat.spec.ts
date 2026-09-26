import { expect, test } from '@playwright/test';
import { gotoWorkspace, login } from './helpers';

const DOCS_API = '/api/v1/documents';

test.describe('files', () => {
  test('upload, select, bulk archive and clear selection', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/files');
    await expect(page.getByRole('heading', { level: 1, name: 'Workspace Files' })).toBeVisible({
      timeout: 30_000,
    });

    const fileName = `pw-e2e-${Date.now()}.txt`;
    const [upload] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(DOCS_API) && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.setInputFiles('input[type="file"]', {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('Phase 02B e2e upload'),
      }),
    ]);
    expect(upload, 'the UI never POSTed the fixture document').not.toBeNull();
    expect(upload.status()).toBe(201);

    const row = page.locator('tr', { hasText: fileName }).first();
    await expect(row, 'the uploaded document never appeared in the table').toBeVisible({
      timeout: 30_000,
    });

    // Row actions are View Document and Share Document only (files/page.tsx:1057,
    //1083); rename/archive live on the bulk toolbar, so the old test's
    // row-level rename/archive click targeted buttons that do not exist.
    await row.getByRole('checkbox', { name: `Select ${fileName}` }).check();
    const toolbar = page.getByText('1 document(s) selected');
    await expect(toolbar).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download (.zip)' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Archive Selected' })).toBeEnabled();

    const [archive] = await Promise.all([
      page.waitForResponse(
        (res) =>
          /\/api\/v1\/documents\/[^/?]+\/archive/.test(res.url()) &&
          res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.getByRole('button', { name: 'Archive Selected' }).click(),
    ]);
    expect(archive, 'archiving never issued a request').not.toBeNull();
    expect(archive.status()).toBe(200);

    await expect(page.locator('body')).toContainText(/moved to archive/i, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByText('1 document(s) selected')).toHaveCount(0);
  });

  test('opening a document shows its stored content in the viewer', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/files');
    await expect(page.getByRole('heading', { level: 1, name: 'Workspace Files' })).toBeVisible({
      timeout: 30_000,
    });

    const fileName = `pw-viewer-${Date.now()}.txt`;
    const marker = `viewer-marker-${Date.now()}`;
    const [upload] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(DOCS_API) && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.setInputFiles('input[type="file"]', {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from(`marker:${marker}`),
      }),
    ]);
    expect(upload).not.toBeNull();
    expect(upload.status()).toBe(201);

    const row = page.locator('tr', { hasText: fileName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole('button', { name: fileName }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: fileName })).toBeVisible();
    await expect(dialog.getByText(marker, { exact: false })).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('chat', () => {
  test('send message and see it rendered in the transcript', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/chat');
    await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible({
      timeout: 30_000,
    });

    const prompt = `Hello from Playwright ${Date.now()}`;
    const composer = page.getByLabel('Chat message');
    await expect(composer).toBeVisible();
    await composer.fill(prompt);
    await page.keyboard.press('Enter');

    await expect(page.getByText(prompt, { exact: false })).toBeVisible({ timeout: 30_000 });
    // A new conversation is titled from the first prompt (ChatWindow.tsx:544)
    // and is reachable in the thread rail.
    const rail = page.locator('aside').filter({ hasText: 'THREADS' });
    await expect(
      rail.getByRole('button', { name: new RegExp(prompt.slice(0, 24), 'i') }),
    ).toBeVisible({
      timeout: 30_000,
    });
    // There is no delete-thread control anywhere in the app, so the old test's
    // `getByRole('button', { name: /delete thread/i })` was permanently skipped.
    await expect(page.getByRole('button', { name: /delete thread/i })).toHaveCount(0);
  });

  test('stop control replaces send during streaming', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/chat');
    await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible({
      timeout: 30_000,
    });
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
    await page.getByLabel('Chat message').fill('Hello stop test');
    await page.keyboard.press('Enter');

    const stop = page.getByRole('button', { name: 'Stop generation' });
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
