/**
 * End-to-end proof of the HttpOnly session migration, in a real browser.
 *
 * Run directly against a live stack (web on :3000 proxying to the API):
 *   node e2e/cookie-flow.browser.mjs
 *
 * Why a browser and not an API client: the entire point of the change is that
 * JavaScript can no longer read the credential. An API-level test cannot observe
 * `document.cookie` or `localStorage`, so it passes identically whether the
 * cookies are HttpOnly or not — which is exactly the regression this guards.
 *
 * Selectors are taken from the real markup. The auth inputs are wired to their
 * labels with `htmlFor`, so `#email` / `#password` / `#confirmPassword` are
 * stable; `input[type="email"]` does not match because the field renders as
 * `type="text"` with an email inputMode.
 */

import { chromium } from '@playwright/test';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const EMAIL = `browser.e2e.${Date.now()}@vaeloom.test`;
const PASSWORD = 'BrowserE2E12345!';

const results = [];
let failures = 0;

function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext();

// `next dev` compiles routes on first hit, and after a cache clear that can take
// well over the 30s default — a cold `/signup` compile was observed at 23s. The
// generous timeout is about the dev server, not about the test being slow.
context.setDefaultTimeout(120_000);
context.setDefaultNavigationTimeout(180_000);
const page = await context.newPage();

/**
 * Fill a React-controlled input and confirm the value survived.
 *
 * Filling before hydration completes is silently discarded: React takes over the
 * DOM on hydration and resets the field to its own (empty) state, the form then
 * submits as if it were blank, and the only symptom is a "field is required"
 * validation message with no network request. Re-reading the value and retrying
 * is what distinguishes that from a genuine validation failure.
 */
async function fillHydrated(locator, value, label) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    await locator.fill(value);
    await page.waitForTimeout(350);
    const current = await locator.inputValue();
    if (current === value) return;
    // Value was wiped, which means hydration just clobbered it. Wait for the
    // page to settle and try again.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600 * attempt);
  }
  throw new Error(`${label} never held its value; React hydration keeps resetting it`);
}

const consoleErrors = [];
const failedRequests = [];
/** Request URLs that never completed, so a console error can be attributed. */
const networkFailures = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
});
page.on('requestfailed', (r) => {
  networkFailures.push(`${r.failure()?.errorText ?? 'failed'}  ${r.url()}`);
});
page.on('response', (r) => {
  if (r.status() >= 500) failedRequests.push(`${r.status()} ${r.url().slice(0, 120)}`);
});

try {
  // ── 1. sign up through the real UI ────────────────────────────────────────
  await page.goto(`${WEB}/signup`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 120_000 });
  // Let the client bundle hydrate before typing, otherwise React discards the
  // values and the form submits blank.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);

  await fillHydrated(page.locator('#email'), EMAIL, '#email');
  await fillHydrated(page.locator('#password'), PASSWORD, '#password');

  const confirm = page.locator('#confirmPassword');
  if (await confirm.count()) await fillHydrated(confirm, PASSWORD, '#confirmPassword');

  const terms = page.locator('#termsAccepted');
  if (await terms.count()) await terms.check();

  // Record the signup response so a rejection is reported with its status
  // rather than surfacing only as "stayed on /signup".
  let signupStatus = null;
  page.on('response', (r) => {
    if (r.url().includes('/api/v1/auth/signup')) signupStatus = r.status();
  });

  await page.locator('button[type="submit"]').first().click();

  // Signup redirects client-side, so the URL change and the JavaScript that runs
  // on the new route can land after the POST resolves. Probing immediately after
  // the click reads the pre-navigation URL and then evaluates against a context
  // that is being torn down ("Execution context was destroyed"). Wait for the
  // navigation to actually land before touching the page.
  await page.waitForURL(/\/(workspace|onboarding)/, { timeout: 90_000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1500);

  check(
    'signup routes into the authenticated app',
    /\/(workspace|onboarding)/.test(page.url()),
    `landed on ${page.url().replace(WEB, '')}${signupStatus ? ` (signup ${signupStatus})` : ' (no signup request)'}`,
  );

  // ── 2. the credential must be unreadable from JavaScript ──────────────────
  // The assertion the migration exists for. A JS-readable cookie fails here even
  // though every functional check still passes.
  const jsProbe = await page.evaluate(() => ({
    lsKeys: Object.keys(localStorage),
    cookieNames: document.cookie
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .filter(Boolean),
    cookieBlob: document.cookie,
  }));

  const leaked = jsProbe.cookieNames.filter((n) => /vaeloom_(at|rt)/.test(n));
  check('no session cookie is visible to document.cookie', leaked.length === 0, `saw: ${leaked.join(',') || 'none'}`);
  check('cookie blob carries no access/refresh token', !/vaeloom_(at|rt)=/.test(jsProbe.cookieBlob));

  const tokenish = jsProbe.lsKeys.filter((k) => /accessToken|refreshToken/i.test(k));
  check('no token in localStorage', tokenish.length === 0, `saw: ${tokenish.join(',') || 'none'}`);

  const legacy = await page.evaluate(() => ({
    access: localStorage.getItem('vaeloom.accessToken'),
    refresh: localStorage.getItem('vaeloom.refreshToken'),
  }));
  check('legacy token keys purged', legacy.access === null && legacy.refresh === null);

  // ── 3. the HttpOnly cookies really were set ───────────────────────────────
  // Read from the browser context, which is permitted to see them.
  const ctxCookies = await context.cookies();
  const at = ctxCookies.find((c) => c.name === 'vaeloom_at');
  const rt = ctxCookies.find((c) => c.name === 'vaeloom_rt');
  check('vaeloom_at cookie set', Boolean(at));
  check('vaeloom_rt cookie set', Boolean(rt));
  check('vaeloom_at is HttpOnly', at?.httpOnly === true);
  check('vaeloom_rt is HttpOnly', rt?.httpOnly === true);
  check('cookies are SameSite=Lax', at?.sameSite === 'Lax' && rt?.sameSite === 'Lax');
  check('refresh cookie outlives the access cookie', (rt?.expires ?? 0) > (at?.expires ?? 0));

  // ── 4. the session authenticates on its own ───────────────────────────────
  // No Authorization header is possible from the browser now, so a 200 here
  // proves the cookie is genuinely doing the work.
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  });
  check('/auth/me via cookie only', me.status === 200, `status ${me.status}`);
  check('/auth/me returns the signed-up user', me.body?.user?.email === EMAIL, me.body?.user?.email ?? 'no email');

  // ── 5. a mutating call needs CSRF and succeeds with it ────────────────────
  const csrf = await page.evaluate(
    async () => (await (await fetch('/csrf-token', { credentials: 'include' })).json()).csrf_token,
  );

  const noCsrf = await page.evaluate(async () => {
    const res = await fetch('/api/v1/organizations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Mode': 'cookie' },
      body: JSON.stringify({ name: 'should-be-blocked' }),
    });
    return res.status;
  });
  check('cookie mutation without CSRF is refused', noCsrf === 403, `got ${noCsrf}`);

  const withCsrf = await page.evaluate(async (token) => {
    const res = await fetch('/api/v1/organizations', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Mode': 'cookie',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({ name: 'browser-e2e-org' }),
    });
    return res.status;
  }, csrf);
  check('cookie mutation with CSRF succeeds', withCsrf === 201 || withCsrf === 200, `got ${withCsrf}`);

  // ── 6. refresh rotates without a body token ───────────────────────────────
  const refreshed = await page.evaluate(async (token) => {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Mode': 'cookie',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({}),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }, csrf);
  check('refresh with cookie only and empty body', refreshed.status === 200, `got ${refreshed.status}`);
  check(
    'refresh response body carries no token',
    refreshed.body?.access_token === '' || refreshed.body?.access_token === undefined,
    `access_token=${JSON.stringify(refreshed.body?.access_token)}`,
  );

  const meAfter = await page.evaluate(
    async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status,
  );
  check('session survives the rotation', meAfter === 200, `got ${meAfter}`);

  // ── 7. a protected page renders for a signed-in user ──────────────────────
  await page.goto(`${WEB}/workspace`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  check('protected route does not bounce to /login', !/\/login/.test(page.url()), `url ${page.url().replace(WEB, '')}`);

  // ── 8. logout clears the session ──────────────────────────────────────────
  const out = await page.evaluate(async (token) => {
    const res = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Mode': 'cookie',
        'X-CSRF-Token': token,
      },
      body: '{}',
    });
    return res.status;
  }, csrf);
  check('logout succeeds', out === 204 || out === 200, `got ${out}`);

  const after = await context.cookies();
  const liveSession = after.filter((c) => ['vaeloom_at', 'vaeloom_rt'].includes(c.name) && c.value);
  check('session cookies cleared on logout', liveSession.length === 0, `still: ${liveSession.map((c) => c.name).join(',') || 'none'}`);

  const meOut = await page.evaluate(
    async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status,
  );
  check('/auth/me is 401 after logout', meOut === 401, `got ${meOut}`);

  // ── 9. a signed-out visitor is redirected away from protected routes ───────
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(`${WEB}/workspace`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await freshPage.waitForTimeout(2500);
  check('anonymous visitor is sent to /login', /\/login/.test(freshPage.url()), `url ${freshPage.url().replace(WEB, '')}`);
  await fresh.close();
} catch (err) {
  check('test run completed without throwing', false, String(err).slice(0, 300));
} finally {
  await browser.close();
}

check('no 5xx responses during the run', failedRequests.length === 0, failedRequests.join(' | '));

/**
 * Requests that are allowed to fail in a local sandbox.
 *
 * `analytics.vaeloom.app` is a placeholder in `apps/web/.env.local` pointing at a
 * host that does not exist, so the web-vitals beacon fails DNS on every page load
 * locally. It is a configuration placeholder, not a defect in the code under
 * test, so it is listed by host rather than filtered by console text: the
 * browser's "Failed to load resource" message does not include the URL, which is
 * exactly why the earlier text-based filter did not work.
 *
 * Everything else that failed to load fails the run, so a real network problem
 * cannot hide behind the exemption.
 */
const KNOWN_PLACEHOLDER_HOSTS = [/analytics\.vaeloom\.app/i, /localhost:3000\/favicon/i];
const unexpectedNetworkFailures = networkFailures.filter(
  (f) => !KNOWN_PLACEHOLDER_HOSTS.some((re) => re.test(f)),
);

/**
 * `ERR_ABORTED` means the browser cancelled a request in flight, not that it
 * failed. Navigating away mid-request produces them routinely - the RSC
 * prefetches Next fires on every route change, and the logout call races the
 * final navigation. They are reported separately rather than mixed in with real
 * failures, because treating "cancelled" as "broken" would make the check
 * useless.
 */
const cancelledRequests = unexpectedNetworkFailures.filter((f) => f.includes('ERR_ABORTED'));
const hardFailures = unexpectedNetworkFailures.filter((f) => !f.includes('ERR_ABORTED'));

check(
  'no unexpected failed requests',
  hardFailures.length === 0,
  hardFailures.slice(0, 3).join(' | '),
);
if (cancelledRequests.length) {
  console.log(`note: ${cancelledRequests.length} request(s) cancelled by navigation (ERR_ABORTED), not failures`);
}

/**
 * Console errors split by whether they bear on what this suite proves.
 *
 * `fail` covers anything that would mean the session migration is broken, or that
 * the app threw. `report` covers framework-level warnings that are real but
 * pre-existing and unrelated to authentication — currently a React missing-`key`
 * warning somewhere under the workspace layout. That one is a genuine code
 * quality defect and is surfaced with its count rather than quietly dropped, but
 * it should not decide whether the HttpOnly session migration works.
 *
 * Treating them the same would mean either a permanently red gate for an
 * unrelated fix, or a blanket "ignore console errors" that would also swallow a
 * real regression. Reporting keeps both honest.
 */
const FRAMEWORK_WARNINGS = [/unique "key" prop/i];

const flowErrors = consoleErrors.filter((e) => {
  if (/favicon/i.test(e)) return false;
  if (FRAMEWORK_WARNINGS.some((re) => re.test(e))) return false;
  // A bare "Failed to load resource" is the browser reporting a request that
  // already appears in `networkFailures`. When every such request was an
  // accepted placeholder (the analytics beacon) there is nothing left to explain,
  // so the console echo is dropped. If any hard failure exists, the resource
  // errors are kept so they cannot hide behind the exemption.
  if (hardFailures.length === 0 && /Failed to load resource/i.test(e)) return false;
  return true;
});
const frameworkWarnings = consoleErrors.filter((e) => FRAMEWORK_WARNINGS.some((re) => re.test(e)));

check('no console errors affecting the session flow', flowErrors.length === 0, flowErrors.slice(0, 3).join(' | '));
if (frameworkWarnings.length) {
  console.log(
    `note: ${frameworkWarnings.length} pre-existing React warning(s) (missing list "key") reported, not gated here - see EXECUTION-LOG.md`,
  );
}

console.log(`\n${results.length - failures}/${results.length} checks passed`);
if (failures) {
  console.log('\nFailures:');
  for (const r of results.filter((x) => !x.pass)) console.log(`  - ${r.name} ${r.detail}`);
}
process.exit(failures ? 1 : 0);
