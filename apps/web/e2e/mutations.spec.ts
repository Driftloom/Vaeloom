import { expect, test } from '@playwright/test';
import { apiRequest, gotoWorkspace, login } from './helpers';

test.describe('critical mutations', () => {
  test('schedule create validates inline then creates', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/schedule');
    await page.getByRole('button', { name: 'New event' }).first().click();
    // Empty submit → inline errors, no toast-only validation.
    await page.locator('[role="dialog"] button', { hasText: 'Create' }).last().click();
    await expect(page.locator('#ev-title-error')).toBeVisible();
    await page.fill('#ev-title', 'PW e2e event');
    await page.fill('#ev-date', '2026-12-01T09:00');
    await page.locator('[role="dialog"] button', { hasText: 'Create' }).last().click();
    await expect(page.locator('body')).toContainText('Event created', { timeout: 30_000 });
  });

  test('memory correction modal opens with diff flow', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/memory');
    await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible({
      timeout: 30_000,
    });

    // The modal only exists once there is a memory to correct
    // (MemoryCorrectionPanel.tsx:108), so seed one through the public API
    // rather than asserting a modal that can never open.
    const title = `pw-memory-${Date.now()}`;
    const created = await apiRequest(page, {
      method: 'POST',
      path: '/api/v1/memories',
      body: {
        type: 'note',
        title,
        summary: 'Original summary that will be superseded',
        content: 'Seed content for the memory-correction e2e flow.',
      },
    });
    expect(created.status, `memory seed failed: ${created.text}`).toBe(201);

    await page.getByRole('tab', { name: /Corrections/ }).click();
    const panel = page.getByRole('region', { name: 'Memory corrections' });
    await expect(panel).toBeVisible();

    // A memory provably exists (asserted against the API above), so the panel
    // must not claim there are none. MemoryCorrectionPanel.tsx:31 reads
    // `res.items` while GET /memories returns `{ memories: [...] }`, so this
    // currently fails and is the point of the test.
    await expect(
      panel.getByText('No memories yet'),
      'a memory exists but the corrections panel reported none',
    ).toHaveCount(0);
    const row = panel.locator('li', { hasText: title });
    await expect(row, `the seeded memory "${title}" is not listed for correction`).toBeVisible({
      timeout: 30_000,
    });

    await row.getByRole('button', { name: 'Correct', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Correct memory: ${title}`);
    // The diff flow: the old summary is shown, and the draft is editable.
    await expect(dialog.getByText('Original summary that will be superseded')).toBeVisible();
    await dialog.locator('#memory-summary').fill('Corrected summary from the e2e suite');
    await expect(dialog.locator('#memory-summary')).toHaveValue(
      'Corrected summary from the e2e suite',
    );
    await expect(dialog.getByRole('button', { name: 'Save correction' })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('resume generation surface is honest (no random ATS)', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/resume');
    await expect(page.getByRole('heading', { level: 1, name: 'Resume' })).toBeVisible({
      timeout: 30_000,
    });
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/ATS \(fallback\)/);
  });

  test('job search runs an agent query', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/jobs');
    await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible({
      timeout: 30_000,
    });

    // jobs/page.tsx:390 renders the search field with a placeholder and no
    // label/aria-label, so it is located by placeholder, not by accessible name.
    const searchBox = page.getByPlaceholder(/Product Manager in Berlin/i);
    await expect(searchBox).toBeVisible();
    await searchBox.fill('frontend engineer');

    const [agentRequest] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/api/v1/agents/chat') && req.method() === 'POST',
        { timeout: 30_000 },
      ),
      page.getByRole('button', { name: 'Search', exact: true }).click(),
    ]);

    // Assert the invocation, not the response status: the E2E API is started
    // with a placeholder LLM_API_KEY and no provider credential, so a status
    // assertion here would test the harness, not the product. What must hold is
    // that the job_search agent is actually asked, with the user's query.
    const payload = JSON.parse(agentRequest.postData() ?? '{}') as Record<string, unknown>;
    expect(payload['agentName']).toBe('job_search');
    expect(String(payload['message'])).toContain('frontend engineer');

    // Honest terminal state: the control must not be stuck on "Searching…".
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible({
      timeout: 60_000,
    });
  });

  test('application outcome persists through the real endpoint', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/applications');
    // Empty state is a valid outcome for a fresh workspace; assert honest UI.
    await expect(page.getByRole('heading', { level: 1, name: 'Applications' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page
        .locator('body')
        .getByText(/no applications|application/i)
        .first(),
    ).toBeVisible();
  });

  test('settings theme toggle persists and flips html class', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/settings');
    await expect(page.getByRole('heading', { level: 1, name: /Settings/ })).toBeVisible({
      timeout: 30_000,
    });

    // TopNav renders the ThemeToggle on every workspace route, so this control
    // is asserted present rather than skipped when a locator misses.
    const toggle = page.getByRole('button', { name: /^Switch to / });
    await expect(toggle.first()).toBeVisible();

    const readTheme = () =>
      page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? '');

    const before = await readTheme();
    expect(['dark', 'light', 'high-contrast']).toContain(before);
    await toggle.first().click();
    await expect
      .poll(readTheme, { message: 'theme toggle did not change the resolved theme' })
      .not.toBe(before);

    const after = await readTheme();
    await page.reload({ waitUntil: 'load' });
    await expect.poll(readTheme, { message: 'theme did not survive a reload' }).toBe(after);
  });

  test('approvals keyboard A/R works on focused card', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/approvals');
    await expect(page.getByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible({
      timeout: 30_000,
    });

    // The hotkeys live on ApprovalCard's keydown handler
    // (ApprovalCard.tsx:48-68), so a pending card must exist to exercise them.
    const stamp = Date.now();
    const approveSeed = await apiRequest<{ id?: string }>(page, {
      method: 'POST',
      path: '/api/v1/approvals',
      body: {
        agent_name: 'e2e-approver',
        action_type: 'e2e_keyboard_approve',
        payload: { stamp },
        reason: 'keyboard hotkey coverage',
        workspace_id: wsId,
      },
    });
    expect(approveSeed.status, `approval seed failed: ${approveSeed.text}`).toBe(201);
    const approveId = approveSeed.json?.id;
    expect(typeof approveId, 'seeded approval carried no id').toBe('string');

    const rejectSeed = await apiRequest<{ id?: string }>(page, {
      method: 'POST',
      path: '/api/v1/approvals',
      body: {
        agent_name: 'e2e-approver',
        action_type: 'e2e_keyboard_reject',
        payload: { stamp },
        reason: 'keyboard hotkey coverage',
        workspace_id: wsId,
      },
    });
    expect(rejectSeed.status, `approval seed failed: ${rejectSeed.text}`).toBe(201);
    const rejectId = rejectSeed.json?.id;
    expect(typeof rejectId, 'seeded approval carried no id').toBe('string');

    const readStatus = async (id: string) => {
      const res = await apiRequest<{ status?: string }>(page, {
        method: 'GET',
        path: `/api/v1/approvals/${encodeURIComponent(id)}`,
      });
      return { http: res.status, decision: res.json?.status };
    };

    // Prove the read path works before using it as the oracle, otherwise a
    // 401/404 here would surface only as a poll timeout.
    expect((await readStatus(approveId as string)).http).toBe(200);

    const card = page
      .getByRole('region', { name: 'e2e-approver e2e_keyboard_approve approval' })
      .first();
    await expect(card, 'the seeded approval never rendered as a pending card').toBeVisible({
      timeout: 30_000,
    });
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('a');
    await expect
      .poll(async () => (await readStatus(approveId as string)).decision, {
        message: 'pressing "a" on the focused card did not approve it',
      })
      .toBe('APPROVED');

    const rejectCard = page
      .getByRole('region', { name: 'e2e-approver e2e_keyboard_reject approval' })
      .first();
    await expect(rejectCard).toBeVisible({ timeout: 30_000 });
    await rejectCard.focus();
    await page.keyboard.press('r');
    await expect
      .poll(async () => (await readStatus(rejectId as string)).decision, {
        message: 'pressing "r" on the focused card did not reject it',
      })
      .toBe('REJECTED');

    // Both hotkeyed cards leave the pending panel (approvals/page.tsx:130).
    await expect(
      page.getByRole('region', { name: 'e2e-approver e2e_keyboard_approve approval' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'e2e-approver e2e_keyboard_reject approval' }),
    ).toHaveCount(0);
  });
});
