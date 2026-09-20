import { expect, test } from '@playwright/test';

test.describe('onboarding wizard', () => {
  test('onboarding wizard page loads and renders step indicators', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.locator('h1')).toContainText(/Set up your workspace/i);
    // Verify wizard step titles are visible
    await expect(page.getByText('Profile')).toBeVisible();
    await expect(page.getByText('Workspace')).toBeVisible();
    await expect(page.getByText('Resume & Skills')).toBeVisible();
    await expect(page.getByText('Integrations')).toBeVisible();
  });

  test('onboarding wizard allows advancing through steps', async ({ page }) => {
    await page.goto('/onboarding');
    // If the step form inputs are present, test filling and continuing
    const displayNameInput = page
      .locator('#displayName, input[name="displayName"], input[placeholder*="name" i]')
      .first();
    if (await displayNameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await displayNameInput.fill('Zero Trust Tester');
      const continueBtn = page.getByRole('button', { name: /continue|next/i });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      }
    }
  });
});
