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

    // Scoped to the transcript log. The rail titles a new thread from its first
    // prompt (chat-store.ts:1300 `title: promptText.slice(0, 40)`), so once
    // ChatThreadRail shipped the same string legitimately appears twice — in the
    // rail button and in the transcript — and an unscoped getByText trips Playwright
    // strict mode. Scoping to the log is what the test name claims to assert
    // ("rendered in the transcript"), so it is stricter than the old form, not looser.
    const transcript = page.getByRole('log');
    await expect(transcript.getByText(prompt, { exact: false })).toBeVisible({ timeout: 30_000 });
    // A new conversation is titled from the first prompt (ChatWindow.tsx:544)
    // and is reachable in the thread rail.
    const rail = page.locator('aside').filter({ hasText: 'THREADS' });
    // Chat history is now server-side, so a workspace accumulates one thread per run
    // and the rail is NOT empty on a repeat run. "Hello from Playwright " is 21 chars,
    // so a 24-char slice kept only the first 3 digits of the timestamp — enough for
    // a shape check but not an identity, and every leftover thread matched it. Slice
    // past the timestamp prefix so the label identifies THIS run's thread.
    const threadLabel = prompt.slice(0, 32);
    // Scoped away from the per-thread actions trigger, whose accessible name also
    // contains the title — matching both would trip Playwright strict mode.
    const thread = rail
      .locator('li button')
      .filter({ hasText: new RegExp(threadLabel, 'i') })
      .first();
    await expect(thread).toBeVisible({ timeout: 30_000 });

    // INVERTED from the old assertion. That test encoded a known gap — the pre-rail
    // chat had no delete affordance anywhere, so it asserted
    // `getByRole('button', { name: /delete thread/i })` had count 0. ChatThreadRail now
    // ships a per-thread actions disclosure, so the control MUST exist.
    //
    // RAIL CONTRACT (reconcile here if the rail's roles or names change):
    //   trigger   → button, aria-label `Actions for ${title}`
    //   items     → native buttons named Rename / Clear / Delete (deliberately NOT
    //               `role="menuitem"`: a menu widget requires roving tabindex, and
    //               shipping menuitem without it is a worse violation than buttons)
    //   confirm   → inline panel, button aria-label `Confirm delete` (text "Yes, delete")
    // The trigger is matched with an anchored regex on purpose: its accessible name
    // contains the thread title, so an unanchored match also hits the select button
    // and Playwright strict mode fails on the 2-element result.
    const threadActions = rail.getByRole('button', {
      name: new RegExp(`^actions for ${threadLabel}`, 'i'),
    });
    await expect(threadActions, 'thread actions trigger never rendered').toBeVisible();
    await threadActions.click();

    const deleteItem = rail.getByRole('button', { name: /^delete$/i });
    await expect(deleteItem, 'the actions disclosure exposed no Delete item').toBeVisible();
    await deleteItem.click();

    const confirmDelete = rail.getByRole('button', { name: /^confirm delete$/i });
    await expect(confirmDelete, 'deleting a thread asked for no confirmation').toBeVisible();
    await confirmDelete.click();

    await expect(thread, 'the confirmed delete left the thread in the rail').toHaveCount(0);
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
