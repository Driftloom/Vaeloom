import { expect, test } from '@playwright/test';
import { apiRequest, gotoWorkspace, login } from './helpers';

/**
 * These are the only end-to-end assertions on the stored-XSS upload boundary
 * and on the download hardening headers, so they must be unconditional: if the
 * expected response never arrives the test FAILS with a timeout naming the
 * awaited request. Nothing here may swallow the failure and continue.
 */

const DOCS_API = '/api/v1/documents';
const UNIQUE = `module05-verified-${Date.now()}`;

test.describe('Module 05 — Documents & Security Workflow', () => {
  test('active-content upload is rejected with 400 and never persisted', async ({ page }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/files');
    await expect(page.getByRole('heading', { level: 1, name: 'Workspace Files' })).toBeVisible({
      timeout: 30_000,
    });

    const maliciousName = 'xss_payload.html';
    // Rejections are recorded per-upload, so the queue must drain before the
    // control file is queued; otherwise `isUploading` would swallow the second
    // setInputFiles event and the test would assert nothing about persistence.
    const rejection = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(DOCS_API) && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.setInputFiles('input[type="file"]', {
        name: maliciousName,
        mimeType: 'text/html',
        buffer: Buffer.from('<script>alert("xss")</script>'),
      }),
    ]);

    expect(rejection[0], 'the UI never POSTed the HTML file to the documents API').not.toBeNull();
    expect(rejection[0].status()).toBe(400);
    const rejectionBody = JSON.parse(await rejection[0].text()) as { detail?: string };
    expect(typeof rejectionBody.detail).toBe('string');
    expect(rejectionBody.detail).toContain('Security rejection');

    // Negative control: upload an allowed file, wait for the list to refresh,
    // then prove the rejected file is absent from the very same listing.
    const controlName = `${UNIQUE}.txt`;
    const [controlUpload] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(DOCS_API) && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.setInputFiles('input[type="file"]', {
        name: controlName,
        mimeType: 'text/plain',
        buffer: Buffer.from('Enterprise Document Lifecycle Verification Content'),
      }),
    ]);
    expect(controlUpload, 'the UI never POSTed the control file').not.toBeNull();
    expect(controlUpload.status()).toBe(201);

    const controlRow = page.locator('tr', { hasText: controlName }).first();
    await expect(
      controlRow,
      'the accepted control file never reached the document table',
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.locator('tr', { hasText: maliciousName }),
      'a rejected active-content upload was persisted to the document table',
    ).toHaveCount(0);

    const list = await apiRequest<{ items?: Array<{ path?: string }> }>(page, {
      method: 'GET',
      path: `${DOCS_API}?workspace_id=${encodeURIComponent(wsId)}`,
    });
    expect(list.status, `document list failed: ${list.text}`).toBe(200);
    const paths = (list.json?.items ?? []).map((d) => d.path ?? '');
    expect(paths.filter((p) => p.endsWith(maliciousName))).toEqual([]);
    expect(paths.filter((p) => p.endsWith(controlName))).toHaveLength(1);
  });

  test('document content is served as an attachment with nosniff and a sandbox CSP', async ({
    page,
  }) => {
    const wsId = await login(page);
    await gotoWorkspace(page, wsId, '/files');
    await expect(page.getByRole('heading', { level: 1, name: 'Workspace Files' })).toBeVisible({
      timeout: 30_000,
    });

    const fileName = `${UNIQUE}.txt`;
    const [upload] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes(DOCS_API) && res.request().method() === 'POST',
        { timeout: 30_000 },
      ),
      page.setInputFiles('input[type="file"]', {
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('Enterprise Document Lifecycle Verification Content'),
      }),
    ]);
    expect(upload, 'the UI never POSTed the fixture document').not.toBeNull();
    expect(upload.status()).toBe(201);

    const row = page.locator('tr', { hasText: fileName }).first();
    await expect(row, 'the uploaded document never appeared in the table').toBeVisible({
      timeout: 30_000,
    });

    // The row's only two actions are "View Document" and "Share Document"
    // (files/page.tsx:1057,1083). Opening the viewer is what fetches
    // /documents/{id}/content, so the viewer — not a download button — is the
    // network event carrying the anti-XSS headers under test.
    const [content] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/content') && res.request().method() === 'GET',
        { timeout: 30_000 },
      ),
      row.getByRole('button', { name: fileName }).click(),
    ]);

    expect(content, 'opening the document never fetched its content').not.toBeNull();
    expect(content.status()).toBe(200);

    const headers = content.headers();
    expect(headers['content-disposition']).toBe(`attachment; filename="${fileName}"`);
    expect(headers['x-content-type-options']?.toLowerCase()).toBe('nosniff');
    expect(headers['x-frame-options']?.toLowerCase()).toBe('deny');
    expect(headers['content-security-policy']?.toLowerCase()).toBe("default-src 'none'; sandbox");
  });
});
