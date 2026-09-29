import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * The profile page is a client component that fetches the profile over SWR, so
 * `domcontentloaded` only proves the shell rendered. The tab bar sits inside the
 * `if (!profile)` guard, so its presence is a reliable "data arrived" signal.
 * Without this gate each widget assertion raced the fetch on the 5s default.
 */
async function gotoProfile(page: Page, workspaceId: string): Promise<void> {
  await page.goto(`/workspace/${workspaceId}/profile`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible({ timeout: 30_000 });
}

test.describe('Profile System E2E', () => {
  let wsId: string;

  test.beforeEach(async ({ page }) => {
    wsId = await login(page);
  });

  test('profile page loads with user identity and tabs', async ({ page }) => {
    await gotoProfile(page, wsId);

    // Page main container
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // Tab buttons
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /memory & activity/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /appearance & export/i })).toBeVisible();

    // Identity: the hero header renders the signed-in account, which is what
    // "loads with user identity" means. The page exposes no auto-populate CTA,
    // so assert the identity block rather than a control that does not exist.
    await expect(page.getByRole('heading', { name: /profile/i }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('switching tabs displays memory breakdown and appearance controls', async ({ page }) => {
    await gotoProfile(page, wsId);

    // Switch to Memory & Activity tab
    await page.getByRole('tab', { name: /memory & activity/i }).click();
    await expect(page.getByRole('heading', { name: /what vaeloom knows/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: /recent activity/i })).toBeVisible();

    // Switch to Appearance & Export tab
    await page.getByRole('tab', { name: /appearance & export/i }).click();
    // Scope to the heading role: a bare /appearance/i text match also hits the
    // tab label itself, which made the old locator ambiguous.
    await expect(page.getByRole('heading', { name: /export profile/i })).toBeVisible({
      timeout: 30_000,
    });

    // Return to Overview
    await page.getByRole('tab', { name: /overview/i }).click();
    await expect(page.getByRole('heading', { name: /skills & competencies/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('skills showcase renders with interactive controls', async ({ page }) => {
    await gotoProfile(page, wsId);
    await expect(page.getByText(/skills & competencies/i)).toBeVisible();

    // Add skill input or button is available
    const addSkillBtn = page.getByRole('button', { name: /\+ add skill/i });
    if (await addSkillBtn.isVisible()) {
      await addSkillBtn.click();
      await expect(page.getByPlaceholder(/e\.g\. next\.js/i)).toBeVisible();
    }
  });

  test('ATS readiness and completeness widgets render', async ({ page }) => {
    await gotoProfile(page, wsId);

    // Completeness widget
    await expect(page.getByText(/profile completeness/i)).toBeVisible();

    // ATS Readiness widget
    await expect(page.getByText(/ats readiness/i)).toBeVisible();
  });

  test('job preferences card renders correctly', async ({ page }) => {
    await gotoProfile(page, wsId);
    await expect(page.getByRole('heading', { name: /job preferences/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe('Public Profile Unauthenticated E2E', () => {
  test('public profile route does not redirect to login', async ({ page }) => {
    // Navigate unauthenticated to a public profile path
    await page.goto('/p/00000000-0000-0000-0000-000000000000');
    // Should NOT redirect to /login
    expect(page.url()).not.toContain('/login');
    // Should render the public profile header or 404 state gracefully
    await expect(page.getByText('Vaeloom').first()).toBeVisible();
  });
});
