/**
 * Local E2E config: no managed webServer.
 *
 * Playwright's `webServer` starts a process and then polls the URL to decide
 * whether the port was already taken. On this host that check races the server it
 * just started — `next dev` binds `[::]:3000` and Playwright then reports
 * `EADDRINUSE` against its own child, aborting before a single test runs.
 *
 * This config therefore manages nothing. Start the two servers yourself, point
 * them at each other, and run:
 *
 *   # terminal 1 - API on SQLite
 *   cd apps/api
 *   set DATABASE__URL=sqlite+aiosqlite:///./e2e.db
 *   set VAELOOM_TARGET_URL=sqlite+aiosqlite:///./e2e.db
 *   set JWT_SECRET=test-jwt-secret-for-ci-only-32-chars-long!!
 *   set INFISICAL_ENABLED=false && set LLM_API_KEY=mock-key
 *   uv run --project . python -m uvicorn api.main:app --host 127.0.0.1 --port 8050
 *
 *   # terminal 2 - web
 *   cd apps/web
 *   set INTERNAL_API_URL=http://127.0.0.1:8050
 *   pnpm dev
 *
 *   # terminal 3 - tests
 *   cd apps/web && pnpm exec playwright test --config=e2e.local.config.ts
 *
 * The committed `playwright.config.ts` keeps the managed `webServer` because that
 * is correct for CI, where the runner has exclusive use of the host. This file is
 * for local iteration only.
 */
import { defineConfig, devices } from '@playwright/test';

const E2E_API_PORT = Number(process.env['VAELOOM_E2E_API_PORT'] ?? '8050');
const E2E_API_ORIGIN = `http://127.0.0.1:${E2E_API_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['line']],
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.05 },
  },
  use: {
    baseURL: process.env['WEB_URL'] ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  metadata: { e2eApiOrigin: E2E_API_ORIGIN },
});
