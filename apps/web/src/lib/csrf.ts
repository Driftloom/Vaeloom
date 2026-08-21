const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';

export const CSRF_HEADER = 'X-CSRF-Token';

let cachedToken: string | null = null;
let inflight: Promise<string | null> | null = null;

export function isMutatingMethod(method: string | undefined): boolean {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

/**
 * Fetches a fresh CSRF token from the backend. The backend also sets an
 * HttpOnly `csrf_token` cookie on the same response, which is sent along
 * with mutating requests via `credentials: 'include'`.
 */
export async function getCsrfToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (cachedToken) return cachedToken;
  if (!inflight) {
    inflight = fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { csrf_token?: string };
        cachedToken = data.csrf_token ?? null;
        return cachedToken;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Invalidates the cached token (e.g. after a 403 CSRF rejection). */
export function resetCsrfToken(): void {
  cachedToken = null;
}
