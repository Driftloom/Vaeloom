import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

const loginErrorRate = new Rate('login_errors');
const wsErrorRate = new Rate('workspace_errors');
const memoryErrorRate = new Rate('memory_errors');
const edgeErrorRate = new Rate('edge_errors');

const loginLatency = new Trend('login_latency');
const wsLatency = new Trend('workspace_latency');
const memoryLatency = new Trend('memory_latency');
const edgeLatency = new Trend('edge_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    login_errors: ['rate<0.01'],
    workspace_errors: ['rate<0.01'],
    memory_errors: ['rate<0.01'],
    edge_errors: ['rate<0.01'],
  },
};

function getAuthToken() {
  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || 'loadtest@vaeloom.test',
    password: __ENV.TEST_PASSWORD || 'LoadTest1234!',
  });
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 201 || res.status === 200) {
    return res.json().access_token;
  }
  const signupRes = http.post(`${BASE_URL}/api/v1/auth/signup`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return signupRes.json().access_token;
}

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default function () {
  group('Authentication', function () {
    const payload = JSON.stringify({
      email: `load-${__VU}@vaeloom.test`,
      password: 'LoadTest1234!',
    });
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    loginLatency.add(res.timings.duration);
    loginErrorRate.add(res.status !== 200 && res.status !== 201);
    check(res, {
      'login status is 2xx': (r) => r.status === 200 || r.status === 201,
      'login returns access_token': (r) => r.json('access_token') !== undefined,
    });
  });

  const token = getAuthToken();
  const headers = authHeaders(token);

  group('List Workspaces', function () {
    const res = http.get(`${BASE_URL}/api/v1/workspaces`, { headers });
    wsLatency.add(res.timings.duration);
    wsErrorRate.add(res.status !== 200);
    check(res, {
      'workspaces status is 200': (r) => r.status === 200,
      'workspaces returns array': (r) => Array.isArray(r.json()),
    });
  });

  group('List Memories', function () {
    const res = http.get(`${BASE_URL}/api/v1/memories`, { headers });
    memoryLatency.add(res.timings.duration);
    memoryErrorRate.add(res.status !== 200);
    check(res, {
      'memories status is 200': (r) => r.status === 200,
      'memories has data': (r) => r.json('memories') !== undefined,
    });
  });

  group('List Edges (Knowledge Graph)', function () {
    const res = http.get(`${BASE_URL}/api/v1/knowledge-graph/edges`, { headers });
    edgeLatency.add(res.timings.duration);
    edgeErrorRate.add(res.status === 200 || res.status === 404);
    check(res, {
      'edges status is acceptable': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(1);
}
