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

/**
 * Which app server the suite runs against.
 *
 * `build` (default) runs `next build` then `next start`, so the suite exercises
 * the optimised artifact that actually deploys.
 *
 * The previous config hardcoded `next dev`. That had two consequences, both
 * observed rather than theoretical:
 *
 *   1. `next dev` and `next build` share `.next`. Running the suite therefore
 *      overwrote the production build, so `next start` afterwards failed with
 *      `PageNotFoundError` / `pages-manifest.json ENOENT` until `.next` was
 *      deleted by hand.
 *   2. Dev serves routes lazily. The first hit on a large route (the heavy
 *      /capabilities bundle — since code-split via next/dynamic in plan E4, but
 *      still the largest route) took longer than the 45 s `waitForURL` budget in
 *      quality.spec.ts, which surfaced as a bare navigation timeout with no
 *      indication that compilation was the cause.
 *
 * `dev` is available for fast local iteration via E2E_WEB_MODE=dev, and is not
 * what CI should use.
 */
const E2E_WEB_MODE = process.env['E2E_WEB_MODE'] === 'dev' ? 'dev' : 'build';

/**
 * Everything the web server needs is parameterised so two runs can coexist.
 *
 * This exists because a shared `apps/web/.next` is a single-writer resource.
 * With the suite hardcoded to port 3000 and the default distDir, a `next dev`
 * or a second Playwright run silently truncates the build out from under
 * `next start`, which then fails with `PageNotFoundError: Cannot find module for
 * page: /_document` or `pages-manifest.json ENOENT`. That failure looks like a
 * build bug and is not one; it is two writers.
 *
 * Defaults preserve today's behaviour for a solo run. Set E2E_WEB_PORT and
 * NEXT_DIST_DIR to run a second suite concurrently against its own build.
 */
const E2E_WEB_PORT = Number(process.env['E2E_WEB_PORT'] ?? '3000');
const E2E_WEB_ORIGIN = `http://127.0.0.1:${E2E_WEB_PORT}`;
// The suite builds into its own distDir by default so that running the tests
// can never clobber a developer's `next dev` output, which was the original
// defect. `.next-build` rather than a new name because .gitignore already
// covers `apps/web/.next-build/`, so this introduces no untracked artefacts.
// Override with NEXT_DIST_DIR to point somewhere else.
const E2E_DIST_DIR = process.env['NEXT_DIST_DIR'] ?? '.next-build';

const WEB_SERVER = {
  build: {
    command: `pnpm build && pnpm next start -p ${E2E_WEB_PORT}`,
    // 10 minutes was not enough for a 25-package monorepo build when the machine
    // is also running a backend suite, and hitting it reports
    // "Process from config.webServer was not able to start" — which reads like a
    // build break rather than a slow one. A generous timeout costs nothing when the
    // build is fast; a tight one produces a misleading failure.
    timeout: 900_000,
  },
  dev: {
    command: `pnpm next dev -p ${E2E_WEB_PORT}`,
    timeout: 300_000,
  },
}[E2E_WEB_MODE] as { command: string; timeout: number };

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
    baseURL: E2E_WEB_ORIGIN,
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
      ...WEB_SERVER,
      url: `${E2E_WEB_ORIGIN}/login`,
      // Reuse only in dev mode. In build mode, silently adopting whatever
      // happens to be listening on the port would mean the run reports on a
      // server nobody rebuilt, over a distDir the build is about to overwrite.
      reuseExistingServer: E2E_WEB_MODE === 'dev' && !process.env['CI'],
      // No `cwd` override: `next` must resolve from apps/web. Setting it to the
      // repo root (as the API entry does) makes node look for
      // node_modules/next at the root, where it does not exist, and the server
      // fails with MODULE_NOT_FOUND before Playwright can report anything useful.
      env: {
        // Without this the rewrite falls back to NEXT_PUBLIC_API_URL from
        // apps/web/.env.local, which may point somewhere else entirely.
        INTERNAL_API_URL: E2E_API_ORIGIN,
        NEXT_PUBLIC_API_URL: E2E_API_ORIGIN,
        // A production build is not NODE_ENV=development, so the CSP
        // connect-src allowlist would omit the local API and every browser
        // fetch would be silently blocked. The login helper then fails at
        // waitForURL with no console-visible cause.
        ALLOW_LOCAL_API: 'true',
        NEXT_DIST_DIR: E2E_DIST_DIR,
      },
    },
  ],
});
