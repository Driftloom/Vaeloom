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
/**
 * The API port the E2E stack uses.
 *
 * It is a single constant used for three things - the launcher's bind port, the
 * health URL Playwright waits on, and the target the Next.js rewrite proxies to -
 * because if any two of those disagree the app silently talks to whatever else
 * is listening on that port. That is not hypothetical: on a machine where another
 * stack publishes 8000, a hard-coded 8000 produced 500s from a completely
 * unrelated service that happened to identify itself as `vaeloom-api`.
 */
const E2E_API_PORT = Number(process.env['VAELOOM_E2E_API_PORT'] ?? '8000');
const E2E_API_ORIGIN = `http://127.0.0.1:${E2E_API_PORT}`;

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
    // 127.0.0.1 rather than localhost: `localhost` resolves to IPv6 ::1 first on
    // some hosts, and the dev server may only be bound on IPv4, which turns every
    // navigation into a 30s timeout rather than a clear connection error.
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'uv run --project apps/api python apps/web/e2e/api-launcher.py',
      url: `${E2E_API_ORIGIN}/health`,
      // Reusing a locally started API would silently test whatever code that
      // process happens to be running, so reuse is opt-in for local iteration.
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
      cwd: '../..',
      env: {
        JWT_SECRET: 'test-jwt-secret-for-ci-only-32-chars-long!!',
        ENCRYPTION_KEY: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
        DATABASE__URL: 'sqlite+aiosqlite:///./e2e.db',
        DATABASE_MIGRATION__URL: 'sqlite+aiosqlite:///./e2e.db',
        VAELOOM_TARGET_URL: 'sqlite+aiosqlite:///./e2e.db',
        DATABASE_URL: 'sqlite+aiosqlite:///./e2e.db',
        VAELOOM_E2E_API_PORT: String(E2E_API_PORT),
        VAELOOM_E2E_API_HOST: '127.0.0.1',
        LLM_API_KEY: 'mock-key',
        OTEL_SDK_DISABLED: 'true',
      },
    },
    {
      command: 'pnpm next dev -p 3000',
      url: 'http://127.0.0.1:3000/login',
      reuseExistingServer: !process.env['CI'],
      timeout: 300_000,
      // No `cwd` override: `next` must resolve from apps/web. Setting it to the
      // repo root (as the API entry does) makes node look for
      // node_modules/next at the root, where it does not exist, and the server
      // fails with MODULE_NOT_FOUND before Playwright can report anything useful.
      env: {
        // Without this the rewrite falls back to NEXT_PUBLIC_API_URL from
        // apps/web/.env.local, which may point somewhere else entirely.
        INTERNAL_API_URL: E2E_API_ORIGIN,
        NEXT_PUBLIC_API_URL: E2E_API_ORIGIN,
      },
    },
  ],
});
