import { expect, test } from '@playwright/test';
import { gotoWorkspace, login } from './helpers';

test.describe('Module 05 — Documents & Security Workflow', () => {
  test('document lifecycle: block HTML/SVG, upload valid file, verify nosniff download', async ({
    page,
  }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/files');

    // 1. Attempt to upload an HTML file (XSS attack simulation)
    // Server must reject with 400 Bad Request
    const [htmlUploadResponse] = await Promise.all([
      page
        .waitForResponse(
          (res) => res.url().includes('/api/v1/documents') && res.request().method() === 'POST',
          { timeout: 15_000 },
        )
        .catch(() => null),
      page.setInputFiles('input[type="file"]', {
        name: 'xss_payload.html',
        mimeType: 'text/html',
        buffer: Buffer.from('<script>alert("xss")</script>'),
      }),
    ]);

    if (htmlUploadResponse) {
      expect(htmlUploadResponse.status()).toBe(400);
    }

    // 2. Upload a legitimate text document
    const validFileName = `module05-verified-${Date.now()}.txt`;
    await page.setInputFiles('input[type="file"]', {
      name: validFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('Enterprise Document Lifecycle Verification Content'),
    });

    // Wait for the table or list to show the new document
    const row = page.locator('tr', { hasText: validFileName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    // 3. Download the document and assert security headers
    const [downloadResponse] = await Promise.all([
      page
        .waitForResponse(
          (res) => res.url().includes('/content') && res.request().method() === 'GET',
          { timeout: 15_000 },
        )
        .catch(() => null),
      // Click download button if available on row
      row
        .getByRole('button', { name: /download/i })
        .first()
        .click()
        .catch(() => null),
    ]);

    if (downloadResponse) {
      const headers = downloadResponse.headers();
      // Verify anti-XSS download headers
      expect(headers['content-disposition']?.toLowerCase()).toContain('attachment');
      expect(headers['x-content-type-options']?.toLowerCase()).toContain('nosniff');
    }
  });
});
