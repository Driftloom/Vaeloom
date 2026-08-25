import { defineConfig, devices } from '@playwright/test';

/**
 * Real-application E2E suite (Phase-02B / F-26).
 *
 * Tests run against the REAL FastAPI backend (SQLite + mock LLM key) and the
 * REAL Next.js app — no synthetic shells, no fake backend.
 *
 * Visual baselines live under ./e2e/quality.spec.ts-snapshots/ (Playwright
 * default, platform-suffixed: -win32/-linux). Cross-OS font rasterization makes
 * strict cross-platform comparison unreliable, so CI gates the functional +
 * axe + responsive specs and runs the visual suite as an ADVISORY step that
 * refreshes/uploads per-OS baselines as artifacts instead of hard-failing.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
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
      reuseExistingServer: true,
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
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
