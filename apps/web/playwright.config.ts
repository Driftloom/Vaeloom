import { defineConfig, devices } from '@playwright/test';

/**
 * Real-application E2E suite (Phase-02B / F-26).
 *
 * Tests run against the REAL FastAPI backend (SQLite + mock LLM key) and the
 * REAL Next.js app — no synthetic shells, no fake backend.
 *
 * Visual baselines live under ./e2e/<spec>.spec.ts-snapshots/ and resolve via the
 * explicit snapshotPathTemplate below. Cross-OS font rasterization makes strict
 * cross-platform comparison unreliable, so CI gates the functional + axe +
 * responsive specs and runs the visual suite as an ADVISORY step that
 * refreshes/uploads per-OS baselines as artifacts instead of hard-failing — see
 * the note at the top of e2e/quality.spec.ts and e2e/landing.spec.ts for the CI
 * change required to make it a real gate.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  // A stray `test.only` must fail the run rather than silently skip the rest.
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Pinned explicitly rather than left implicit: the {arg}{-projectName}{-snapshotSuffix}
  // segment is what makes `landing-dark-1440.png` resolve to
  // `landing-dark-1440-chromium-win32.png`. The landing baselines were committed
  // without the project segment and could never be found.
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'uv run --project apps/api python apps/web/e2e/api-launcher.py',
      url: 'http://localhost:8000/health',
      // Reusing a locally started API would silently test whatever code that
      // process happens to be running, so reuse is opt-in for local iteration.
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      cwd: '../..',
      env: {
        JWT_SECRET: 'test-jwt-secret-for-ci-only-32-chars-long!!',
        ENCRYPTION_KEY: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
        DATABASE__URL: 'sqlite+aiosqlite:///./dev.db',
        LLM_API_KEY: 'mock-key',
        OTEL_SDK_DISABLED: 'true',
      },
    },
    {
      command: 'pnpm next dev -p 3000',
      url: 'http://localhost:3000/login',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
