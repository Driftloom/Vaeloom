import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const authDuration = new Trend('auth_duration');
const workspaceDuration = new Trend('workspace_duration');
const searchDuration = new Trend('search_duration');

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
    search_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const AUTH_CREDENTIALS = {
  email: __ENV.TEST_EMAIL || 'test@vaeloom.ai',
  password: __ENV.TEST_PASSWORD || 'password123',
};

export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify(AUTH_CREDENTIALS), {
    headers: { 'Content-Type': 'application/json' },
  });
  const token = loginRes.json('token');
  check(loginRes, { 'setup login successful': (r) => r.status === 200 });
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  group('auth endpoints', function () {
    const res = http.post(`${BASE_URL}/api/v1/auth/verify`, JSON.stringify({}), {
      headers,
    });
    authDuration.add(res.timings.duration);
    check(res, {
      'auth status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  group('workspace endpoints', function () {
    const res = http.get(`${BASE_URL}/api/v1/workspace/memories`, { headers });
    workspaceDuration.add(res.timings.duration);
    check(res, {
      'workspace status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  group('search endpoints', function () {
    const searchPayload = {
      query: 'test search query',
      limit: 10,
    };
    const res = http.post(`${BASE_URL}/api/v1/search`, JSON.stringify(searchPayload), {
      headers,
    });
    searchDuration.add(res.timings.duration);
    check(res, {
      'search status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);
}
