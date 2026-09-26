/**
 * Session storage must never hold a credential (GAP-AUTH-01).
 *
 * This file exists because the previous implementation was easy to reintroduce.
 * `setToken(token)` looked like a harmless state setter, so a later refactor
 * could plausibly restore `localStorage.setItem(TOKEN_KEY, token)` and every
 * other test would still pass. These assertions are deliberately blunt: they
 * search every storage surface for the secret value itself, so a regression is
 * caught no matter which key or API is used.
 *
 * @jest-environment jsdom
 */

const SECRET_ACCESS = 'header.payload.signature-access-secret';
const SECRET_REFRESH = 'refresh-secret-value-do-not-store';

describe('session storage holds no credential', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.resetModules();
  });

  /** Every place a value could hide that survives a page load. */
  function storageDump(): string {
    const ls: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      ls.push(`${key}=${window.localStorage.getItem(key)}`);
    }
    const ss: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      ss.push(`${key}=${window.sessionStorage.getItem(key)}`);
    }
    return [...ls, ...ss].join('\n');
  }

  it('does not persist the access token to any storage', async () => {
    const api = await import('@/lib/api');

    api.setToken(SECRET_ACCESS);

    expect(storageDump()).not.toContain(SECRET_ACCESS);
    expect(window.localStorage.length + window.sessionStorage.length).toBeGreaterThan(0);
  });

  it('does not persist the refresh token to any storage', async () => {
    const api = await import('@/lib/api');

    api.setRefreshToken(SECRET_REFRESH);
    api.setToken(SECRET_ACCESS);

    expect(storageDump()).not.toContain(SECRET_REFRESH);
  });

  it('never writes the token into document.cookie', async () => {
    const api = await import('@/lib/api');

    api.setToken(SECRET_ACCESS);

    // A cookie without HttpOnly is readable by any script on the origin, so
    // mirroring the JWT there is the same vulnerability under a different key.
    expect(document.cookie).not.toContain(SECRET_ACCESS);
  });

  it('getToken() returns null so no Authorization header can be built', async () => {
    const api = await import('@/lib/api');

    api.setToken(SECRET_ACCESS);

    // Returning a placeholder would produce `Authorization: Bearer <placeholder>`,
    // which fails closed but as a confusing 401 rather than relying on the cookie.
    expect(api.getToken()).toBeNull();
    expect(api.getRefreshToken()).toBeNull();
  });

  it('still records a non-secret session marker', async () => {
    const api = await import('@/lib/api');

    expect(api.hasSession()).toBe(false);
    api.setToken(SECRET_ACCESS);
    expect(api.hasSession()).toBe(true);

    // The marker itself must be inert: no token material, just a flag.
    const dump = storageDump();
    expect(dump).toContain('vaeloom.session');
    expect(dump).not.toContain(SECRET_ACCESS);
  });

  it('clearToken removes the marker and dispatches the event', async () => {
    const api = await import('@/lib/api');
    const onCleared = jest.fn();
    window.addEventListener('vaeloom.auth_token_cleared', onCleared);

    api.setToken(SECRET_ACCESS);
    expect(api.hasSession()).toBe(true);

    api.clearToken();
    expect(api.hasSession()).toBe(false);
    expect(onCleared).toHaveBeenCalled();

    window.removeEventListener('vaeloom.auth_token_cleared', onCleared);
  });

  it('purges tokens left behind by a pre-migration build', async () => {
    // A user signed in before this change still has a live access and refresh
    // token in localStorage. Nothing else would ever remove them, which would
    // leave the vulnerability in place for exactly the longest-signed-in users.
    window.localStorage.setItem('vaeloom.accessToken', SECRET_ACCESS);
    window.localStorage.setItem('vaeloom.refreshToken', SECRET_REFRESH);

    await import('@/lib/api');

    expect(window.localStorage.getItem('vaeloom.accessToken')).toBeNull();
    expect(window.localStorage.getItem('vaeloom.refreshToken')).toBeNull();
    expect(storageDump()).not.toContain(SECRET_ACCESS);
    expect(storageDump()).not.toContain(SECRET_REFRESH);
  });

  it('survives a storage-partition failure without throwing', async () => {
    // Private browsing and partitioned third-party contexts can make
    // localStorage throw on write. The cookie is what authenticates, so a
    // failure to record the marker must not break the app.
    const api = await import('@/lib/api');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new DOMException('denied', 'SecurityError');
    };

    try {
      expect(() => api.setToken(SECRET_ACCESS)).not.toThrow();
      expect(api.hasSession()).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
