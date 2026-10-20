import { expect, test } from '@playwright/test';
import { gotoWorkspace, login } from './helpers';

/**
 * Wave 3 R1 required e2e additions for the memory & vault-sync overhaul.
 *
 * These lock two contracts that were only proven manually during the overhaul:
 *
 *  1. `GET /workspaces/{id}/memories` resolves to a BARE ARRAY (no envelope).
 *     `ChatMemoryDrawer` must render that shape. The mock below returns the
 *     exact bare-array payload so an envelope regression fails here instead of
 *     surfacing as an empty drawer in production.
 *
 *  2. When the vault status request fails with no last-good data, the panel
 *     must show ONE honest error surface with a retry affordance — not a panel
 *     of invented zeros (`VaultSyncPanel.tsx:374-387`). The retry must issue
 *     another status request; failures of that retry must not crash the page.
 */

test.describe('memory honesty', () => {
  test('chat memory drawer renders memories from a bare-array response', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/chat');
    await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible({
      timeout: 30_000,
    });

    const nonce = Date.now();
    const markerTitle = `E2E bare-array memory ${nonce}`;
    const markerContent = `bare-array contract marker ${nonce}`;

    let hits = 0;
    await page.route(`**/api/v1/workspaces/${wsId}/memories`, async (route) => {
      hits += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // BARE ARRAY, exactly what routers/memory.py returns for this route.
        body: JSON.stringify([
          {
            id: `e2e-bare-${nonce}`,
            type: 'note',
            title: markerTitle,
            content: markerContent,
            domain: null,
            confidence: null,
            created_at: '2026-10-18T12:00:00',
          },
        ]),
      });
    });

    await page.getByTestId('subpage-tab-memory').click();
    const requestPromise = page.waitForRequest(
      (r) => r.url().includes(`/api/v1/workspaces/${wsId}/memories`) && r.method() === 'GET',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /inspect vault drawer/i }).click();
    await requestPromise;

    const dialog = page.getByRole('dialog', { name: /obsidian memory vault/i });
    await expect(dialog, 'the memory drawer never opened').toBeVisible({ timeout: 30_000 });

    // The drawer rendered the mocked bare-array row.
    await expect(
      dialog.getByText(markerTitle),
      'a bare-array /workspaces/{id}/memories response did not render in the drawer',
    ).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText(markerContent)).toBeVisible();
    expect(hits, 'the drawer never fetched /workspaces/{id}/memories').toBeGreaterThanOrEqual(1);

    // The drawer is fed by the API, not by any fabricated content: the old
    // seed titles of the in-page "Memory Vault" tab were removed entirely, and
    // must never reappear in the drawer either.
    await expect(dialog.getByText('AI Multi-Agent Career Copilot Architecture')).toHaveCount(0);

    // The drawer's own client-side filter works over the fetched data.
    const drawerSearch = dialog.getByTestId('memory-search-input');
    await drawerSearch.fill(markerContent);
    await expect(dialog.getByText(markerTitle)).toBeVisible();
    await drawerSearch.fill(`no-match-${nonce}`);
    await expect(
      dialog.getByText(markerTitle),
      'a non-matching filter query left the marker row visible',
    ).toHaveCount(0);
  });

  test('vault panel shows an honest error with retry when the status API fails', async ({
    page,
  }) => {
    const wsId = await login(page);

    let statusHits = 0;
    let syncHits = 0;
    await page.route('**/api/v1/vault-sync/status?*', async (route) => {
      statusHits += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 500, message: 'E2E simulated outage' },
          status: 500,
        }),
      });
    });
    // Neutralise the retry's sync trigger: this test simulates the outage, it
    // must not write a real manual_sync_requested event into the ledger.
    await page.route('**/api/v1/vault-sync/sync*', async (route) => {
      syncHits += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 503, message: 'E2E simulated outage' },
          status: 503,
        }),
      });
    });

    await gotoWorkspace(page, wsId, '/memory/vault');

    const surface = page.getByRole('alert').filter({ hasText: 'Vault status unavailable' });
    await expect(surface, 'the failing status request showed no honest error surface').toBeVisible({
      timeout: 30_000,
    });
    // No invented zeros: the metric cards must not render without data.
    await expect(page.getByText('Sync Engine')).toHaveCount(0);
    expect(statusHits, 'the panel never requested vault status').toBeGreaterThanOrEqual(1);

    const initialStatusHits = statusHits;
    await surface.getByRole('button', { name: /request sync/i }).click();

    // The recovery action re-attempts the status request instead of dead-ending.
    await expect
      .poll(() => statusHits, {
        message: 'retry did not re-issue the vault status request',
        timeout: 15_000,
      })
      .toBeGreaterThan(initialStatusHits);
    expect(syncHits, 'retry did not attempt the vault sync trigger').toBeGreaterThanOrEqual(1);

    // Still failing: the error surface persists (no crash, no fake success).
    await expect(surface).toBeVisible();
  });
});
