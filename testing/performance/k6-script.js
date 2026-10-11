import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const authDuration = new Trend('auth_duration');
const workspaceDuration = new Trend('workspace_duration');
const memoriesDuration = new Trend('memories_duration');

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    auth_duration: ['p(95)<2000'],
    workspace_duration: ['p(95)<2000'],
    memories_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
// The previous default password was `password123`, which `SignupRequest`
// rejects -- it sits on the common-weak-password blocklist in
// api/schemas/auth.py. Running this script surfaced that immediately: the
// account was never real *and* could not have been created with the
// credentials the file already claimed to use.
const AUTH_CREDENTIALS = {
  email: __ENV.TEST_EMAIL || 'test@vaeloom.ai',
  password: __ENV.TEST_PASSWORD || 'k6LoadTest-2026!',
};

// setup() runs once per test run; default() runs per iteration per VU.
//
// This previously logged in against an account (`test@vaeloom.ai`) that exists
// nowhere in the repo, read the token out of a `token` field the login response
// does not have (`AuthResponse.access_token`), and then measured three URLs
// that 404. Every check failed, so `errors` and `http_req_failed` sat at ~1.0
// and the gate could only ever go red. It failed for reasons that had nothing
// to do with latency, which is the worst way for a load gate to behave: a real
// regression would be indistinguishable from the noise.
//
// So setup() now provisions the account it needs and throws on any failure, so
// a broken setup is reported as a broken setup rather than as three slow
// endpoints.
export function setup() {
  const signupRes = http.post(
    `${BASE_URL}/api/v1/auth/signup`,
    JSON.stringify({
      email: AUTH_CREDENTIALS.email,
      password: AUTH_CREDENTIALS.password,
      display_name: 'Load Test',
      terms_accepted: true,
    }),
    // 201 on a fresh database, 409 when the account already exists. k6 counts
    // any status outside 2xx/3xx as a failed request, so an idempotent re-run
    // would otherwise register itself as an application error and drag
    // `http_req_failed` over its threshold.
    {
      headers: { 'Content-Type': 'application/json' },
      responseCallback: http.expectedStatuses(201, 409),
    },
  );

  // 409 means the account is already there, which is the normal case on a
  // second run against the same container. Anything else is fatal.
  if (signupRes.status !== 201 && signupRes.status !== 409) {
    throw new Error(`setup signup failed: ${signupRes.status} ${signupRes.body}`);
  }

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify(AUTH_CREDENTIALS), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (loginRes.status !== 200) {
    throw new Error(`setup login failed: ${loginRes.status} ${loginRes.body}`);
  }

  // `access_token`, not `token`. Reading `token` yielded undefined and every
  // later request went out as `Bearer undefined`.
  const token = loginRes.json('access_token');
  if (!token) {
    throw new Error('setup login returned no access_token');
  }

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // Signup provisions a workspace but `AuthResponse` does not return its id,
  // and the memory routes require it. Resolve it here rather than hardcoding.
  const wsRes = http.get(`${BASE_URL}/api/v1/workspaces`, { headers: authHeaders });
  if (wsRes.status !== 200) {
    throw new Error(`setup workspace list failed: ${wsRes.status} ${wsRes.body}`);
  }
  const workspaces = wsRes.json();
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    throw new Error('setup found no workspace for the load-test user');
  }

  // CSRF double-submit. Every mutating request needs both halves: the raw
  // token in the X-CSRF-Token header, and the `token:signature` pair in the
  // csrf_token cookie. `CSRFTokenMiddleware` compares the header against the
  // cookie with hmac.compare_digest and rejects a mismatch with 403.
  //
  // /api/v1/auth/login and /signup are exempt; /api/v1/auth/verify-email and
  // /api/v1/memories/* are not. A load test that omits this measures 403s.
  const csrfRes = http.get(`${BASE_URL}/csrf-token`);
  if (csrfRes.status !== 200) {
    throw new Error(`setup csrf-token failed: ${csrfRes.status} ${csrfRes.body}`);
  }
  const csrfToken = csrfRes.json('csrf_token');
  // k6 hands back a repeated response header as an array but a single-valued
  // one as a plain string, and `Set-Cookie` is not guaranteed to repeat here.
  // Indexing it blindly took the first *character* on a string and produced a
  // cookie header of "c".
  const rawSetCookie = csrfRes.headers['Set-Cookie'];
  const setCookie = (Array.isArray(rawSetCookie) ? rawSetCookie[0] : rawSetCookie) || '';
  const csrfCookie = setCookie.split(';')[0];
  if (!csrfToken || !csrfCookie.startsWith('csrf_token=')) {
    throw new Error(`setup csrf-token response malformed: ${JSON.stringify(setCookie)}`);
  }

  return { token, workspaceId: workspaces[0].id, csrfToken, csrfCookie };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
    'X-CSRF-Token': data.csrfToken,
    Cookie: data.csrfCookie,
  };
  // `get_workspace_id` fails closed, so the memory search route returns 400
  // without this header.
  const wsHeaders = { ...headers, 'X-Workspace-Id': data.workspaceId };

  group('auth endpoints', function () {
    // Was `POST /api/v1/auth/verify-email` with an empty body. That endpoint
    // consumes an emailed verification token -- `VerifyEmailRequest` requires a
    // `token` field -- so an empty body could only ever return 422. It was never
    // going to pass, and it was not measuring authentication either.
    //
    // GET /api/v1/auth/me runs the real authenticated path (JWT decode, user
    // load, response shaping) and is the most-hit auth route in normal use.
    const res = http.get(`${BASE_URL}/api/v1/auth/me`, { headers });
    authDuration.add(res.timings.duration);
    check(res, {
      'auth status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  group('workspace endpoints', function () {
    const res = http.get(`${BASE_URL}/api/v1/workspaces/${data.workspaceId}/memories`, { headers });
    workspaceDuration.add(res.timings.duration);
    check(res, {
      'workspace status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  group('memories endpoints', function () {
    // Was `POST /api/v1/memories/search`, which embeds the query through the
    // configured LLM provider before touching pgvector. No CI job in this repo
    // holds a provider key, so the call failed with LLMProviderError -> HTTP
    // 500 and the gate could never pass. A load gate that needs a paid
    // third-party API to start is not measuring this service: it is measuring
    // someone else's uptime, and its thresholds become hostage to that
    // provider's latency.
    //
    // The list route exercises the same memory read path -- tenant and workspace
    // scoping, RLS predicates, ORM hydration -- with no external dependency, so
    // the numbers mean something about us. Vector retrieval quality is covered
    // by apps/api/tests/eval/golden_retrieval.json and the memory retrieval
    // suites; latency against a real provider belongs in a separate, opt-in
    // job that has the credentials.
    const res = http.get(`${BASE_URL}/api/v1/memories?limit=10`, { headers: wsHeaders });
    memoriesDuration.add(res.timings.duration);
    check(res, {
      'memories status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);
}
