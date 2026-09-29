import { expect, test } from '@playwright/test';
import { login, apiRequest } from './helpers';

test.describe('onboarding wizard', () => {
  test('onboarding wizard page loads and renders step indicators', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.locator('h1')).toContainText(/Set up your workspace/i);
    // Verify wizard step titles are visible
    await expect(page.getByRole('heading', { level: 2, name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
    await expect(page.getByText('Resume & Skills', { exact: true })).toBeVisible();
    await expect(page.getByText('Integrations', { exact: true })).toBeVisible();
  });

  test('onboarding wizard allows advancing through steps', async ({ page }) => {
    await login(page);
    const reset = await apiRequest(page, { method: 'POST', path: '/onboarding/reset' });
    expect(reset.status).toBe(200);
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

    // Restore completion state for subsequent test suites
    await apiRequest(page, {
      method: 'POST',
      path: '/onboarding/complete',
      body: { final_data: {} },
    });
  });
});
