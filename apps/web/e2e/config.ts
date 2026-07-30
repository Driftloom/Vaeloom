export const config = {
  baseUrl: process.env['BASE_URL'] ?? 'http://localhost:3000',
  apiUrl: process.env['API_URL'] ?? 'http://localhost:8000',
  timeouts: {
    navigation: 15000,
    element: 10000,
    assertion: 5000,
    api: 10000,
  },
  auth: {
    testEmail: 'smoke@vaeloom.test',
    testPassword: 'SmokeTest1234!',
    testDisplayName: 'Smoke Tester',
  },
} as const;

export function apiUrl(path: string): string {
  return `${config.apiUrl}/api/v1${path}`;
}
