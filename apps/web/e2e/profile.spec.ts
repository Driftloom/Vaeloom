import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Profile System E2E', () => {
  let wsId: string;

  test.beforeEach(async ({ page }) => {
    wsId = await login(page);
  });

  test('profile page loads with user identity and tabs', async ({ page }) => {
    await page.goto(`/workspace/${wsId}/profile`, { waitUntil: 'domcontentloaded' });

    // Page main container
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // Tab buttons
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /memory & activity/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /appearance & export/i })).toBeVisible();

    // Header & Auto-populate CTA
    await expect(page.getByRole('button', { name: /auto-populate from resume/i })).toBeVisible();
  });

  test('switching tabs displays memory breakdown and appearance controls', async ({ page }) => {
    await page.goto(`/workspace/${wsId}/profile`, { waitUntil: 'domcontentloaded' });

    // Switch to Memory & Activity tab
    await page.getByRole('tab', { name: /memory & activity/i }).click();
    await expect(page.getByText(/what vaeloom knows/i)).toBeVisible();
    await expect(page.getByText(/recent activity/i)).toBeVisible();

    // Switch to Appearance & Export tab
    await page.getByRole('tab', { name: /appearance & export/i }).click();
    await expect(page.getByText(/appearance/i)).toBeVisible();
    await expect(page.getByText(/export profile/i)).toBeVisible();

    // Return to Overview
    await page.getByRole('tab', { name: /overview/i }).click();
    await expect(page.getByText(/skills & competencies/i)).toBeVisible();
  });

  test('skills showcase renders with interactive controls', async ({ page }) => {
    await page.goto(`/workspace/${wsId}/profile`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/skills & competencies/i)).toBeVisible();

    // Add skill input or button is available
    const addSkillBtn = page.getByRole('button', { name: /\+ add skill/i });
    if (await addSkillBtn.isVisible()) {
      await addSkillBtn.click();
      await expect(page.getByPlaceholder(/e\.g\. next\.js/i)).toBeVisible();
    }
  });

  test('ATS readiness and completeness widgets render', async ({ page }) => {
    await page.goto(`/workspace/${wsId}/profile`, { waitUntil: 'domcontentloaded' });

    // Completeness widget
    await expect(page.getByText(/profile completeness/i)).toBeVisible();

    // ATS Readiness widget
    await expect(page.getByText(/ats readiness/i)).toBeVisible();
  });

  test('job preferences card renders correctly', async ({ page }) => {
    await page.goto(`/workspace/${wsId}/profile`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/job preferences/i)).toBeVisible();
  });
});

test.describe('Public Profile Unauthenticated E2E', () => {
  test('public profile route does not redirect to login', async ({ page }) => {
    // Navigate unauthenticated to a public profile path
    await page.goto('/p/00000000-0000-0000-0000-000000000000');
    // Should NOT redirect to /login
    expect(page.url()).not.toContain('/login');
    // Should render the public profile header or 404 state gracefully
    await expect(page.locator('body')).toBeVisible();
  });
});
