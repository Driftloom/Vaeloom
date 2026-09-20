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
    await expect(page.locator('h1')).toContainText(/Set up your workspace/i);

    // Profile Step: fill inputs
    const displayNameInput = page.getByPlaceholder(/Alex Doe/i);
    await expect(displayNameInput).toBeVisible({ timeout: 10000 });
    await displayNameInput.fill('Zero Trust Tester');

    const jobTitleInput = page.getByPlaceholder(/Staff Software Engineer/i);
    await expect(jobTitleInput).toBeVisible();
    await jobTitleInput.fill('Staff Security Architect');

    // Click Continue
    const continueBtn = page.getByRole('button', { name: /continue/i });
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Verify advancement to WORKSPACE step
    const workspaceInput = page.getByPlaceholder(/Engineering & Career/i);
    await expect(workspaceInput).toBeVisible({ timeout: 10000 });
  });
});
