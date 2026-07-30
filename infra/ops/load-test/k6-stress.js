import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

const errorRate = new Rate('all_errors');
const healthLatency = new Trend('health_latency');
const loginLatency = new Trend('login_latency');
const memoryLatency = new Trend('memory_latency');
const searchLatency = new Trend('search_latency');

export const options = {
  stages: [
    { duration: '2m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    all_errors: ['rate<0.05'],
  },
};

function getAuthToken() {
  const payload = JSON.stringify({
    email: `stress-${__VU}@vaeloom.test`,
    password: 'StressTest1234!',
  });
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 200 || res.status === 201) {
    return res.json().access_token;
  }
  const signupRes = http.post(`${BASE_URL}/api/v1/auth/signup`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return signupRes.json().access_token;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default function () {
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/health`);
    healthLatency.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, {
      'health status is 200': (r) => r.status === 200,
    });
  });

  group('Login', function () {
    const payload = JSON.stringify({
      email: `stress-${__VU}@vaeloom.test`,
      password: 'StressTest1234!',
    });
    const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    loginLatency.add(res.timings.duration);
    errorRate.add(res.status !== 200 && res.status !== 201);
    check(res, {
      'login status is 2xx': (r) => r.status === 200 || r.status === 201,
    });
  });

  const token = getAuthToken();
  const headers = authHeaders(token);

  group('List Memories', function () {
    const res = http.get(`${BASE_URL}/api/v1/memories`, { headers });
    memoryLatency.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, {
      'memories status is 200': (r) => r.status === 200,
      'memories has data': (r) => r.json('memories') !== undefined,
    });
  });

  group('Search', function () {
    const res = http.post(
      `${BASE_URL}/api/v1/search`,
      JSON.stringify({ query: 'test', sources: ['memories'], limit: 10 }),
      { headers },
    );
    searchLatency.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, {
      'search status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
