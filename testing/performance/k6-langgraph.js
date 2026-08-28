import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const agentDuration = new Trend('agent_duration');
const agentError = new Rate('agent_errors');
const duplicateRate = new Rate('duplicate_rejected');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 10 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2500'],
    http_req_failed: ['rate<0.01'],
    agent_errors: ['rate<0.01'],
    agent_duration: ['p(95)<2500'],
    duplicate_rejected: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

function randomId() {
  return Math.random().toString(36).substring(2, 15);
}

function getCsrfToken() {
  const res = http.get(`${BASE_URL}/csrf-token`);
  try {
    const body = res.json();
    return body.csrf_token || body.csrfToken || '';
  } catch {
    return '';
  }
}

export function setup() {
  const email = `k6-langgraph-${randomId()}@example.com`;
  const csrf = getCsrfToken();
  const signup = http.post(
    `${BASE_URL}/api/v1/auth/signup`,
    JSON.stringify({ email, password: 'TestPass123!', name: 'k6-lg' }),
    { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } },
  );
  let token = signup.json('access_token') || signup.json('token');
  if (signup.status !== 201 && signup.status !== 200) {
    const login = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email, password: 'TestPass123!' }),
      { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } },
    );
    token = login.json('access_token') || login.json('token');
  }
  const wsRes = http.post(
    `${BASE_URL}/api/v1/workspaces`,
    JSON.stringify({ name: `k6-lg-ws-${randomId()}` }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-CSRF-Token': csrf,
      },
    },
  );
  let workspaceId = wsRes.json('id') || wsRes.json('workspace_id') || wsRes.json('workspaceId');
  if (!workspaceId) {
    const list = http.get(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    try {
      const arr = list.json();
      if (Array.isArray(arr) && arr.length > 0) workspaceId = arr[0].id;
      else if (arr.workspaces && arr.workspaces.length > 0) workspaceId = arr.workspaces[0].id;
    } catch {}
  }
  return { token, workspaceId, csrf };
}

export default function (data) {
  const csrf = getCsrfToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
    'X-CSRF-Token': csrf,
  };
  const workspaceId = data.workspaceId;
  if (!workspaceId) {
    agentError.add(1);
    return;
  }
  const requestId = randomId() + '-' + randomId();
  const wid = `durable_run:${workspaceId}:${requestId}`; // will be prefixed with user_id in handler, but we check via response
  // Messages covering routing branches
  const messages = [
    'organize my files',
    'help with my resume ats score for software engineer',
    'search my documents for project plan',
    'schedule a meeting tomorrow with team',
    'research github repos for vaeloom',
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];
  const start = http.post(
    `${BASE_URL}/api/v1/temporal/workflows/durable-agent`,
    JSON.stringify({ workspace_id: workspaceId, agent_id: 'memory', request_id: requestId, input: { message: msg } }),
    { headers },
  );
  const okA = check(start, {
    'agent start 200': (r) => r.status === 200 || r.status === 201 || r.status === 202,
  });
  agentError.add(okA ? 0 : 1);
  if (okA) agentDuration.add(start.timings.duration);
  let workflowId = '';
  try {
    const j = start.json();
    workflowId = j.workflow_id || j.workflowId || '';
  } catch {}
  sleep(0.8);
  if (workflowId) {
    const q = http.get(`${BASE_URL}/api/v1/temporal/workflows/${encodeURIComponent(workflowId)}`, {
      headers,
    });
    const okQ = check(q, { 'agent query 200': (r) => r.status === 200 });
    agentError.add(okQ ? 0 : 1);
  }
  // duplicate with same request_id should be already_started
  const dup = http.post(
    `${BASE_URL}/api/v1/temporal/workflows/durable-agent`,
    JSON.stringify({ workspace_id: workspaceId, agent_id: 'memory', request_id: requestId, input: { message: msg } }),
    { headers },
  );
  let dupOk = false;
  try {
    const j = dup.json();
    dupOk = (j && j.status === 'already_started') || dup.status === 409 || (j && j.workflow_id && dup.status === 200 && j.status === 'already_started');
  } catch {}
  if (!dupOk && dup.status === 500) {
    try {
      const body = dup.body || '';
      if (body.toLowerCase().includes('already') && body.toLowerCase().includes('started')) dupOk = true;
    } catch {}
  }
  check(dup, { 'duplicate handled': () => dupOk });
  duplicateRate.add(dupOk ? 0 : 1);
  sleep(0.5);
}
