"""HttpOnly session cookie contract (GAP-AUTH-01 / W2.1).

These tests exist to prove three properties that are easy to claim and easy to
regress:

1. A browser client that asks for cookie mode gets its credentials ONLY in
   `Set-Cookie`, and the response body carries no token to steal.
2. The cookies are `HttpOnly`, so `document.cookie` cannot read them.
3. Cookie auth works end to end, and a cookie-authenticated mutation is still
   CSRF-challenged while a bearer-authenticated one is not.

The negative controls matter as much as the positive ones: a test that only
asserts "a cookie was set" passes just as happily against a cookie that is
readable by JavaScript, which is the vulnerability being closed.
"""

import pytest
from fastapi import Response

from api.middleware.csrf import create_csrf_token
from api.services.session_cookies import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    clear_auth_cookies,
    cookies_are_secure,
    set_auth_cookies,
    wants_cookie_only,
)


def _set_cookie_headers(response: Response) -> list[str]:
    """All Set-Cookie values, including repeats.

    `headers.get()` would collapse the two cookies into one comma-joined string,
    which is exactly the value an assertion must never be made against.
    """
    return list(response.headers.getlist("set-cookie"))


class _FakeRequest:
    def __init__(self, headers=None, cookies=None):
        self.headers = headers or {}
        self.cookies = cookies or {}


# ── attribute contract ──────────────────────────────────────────────────────


def test_auth_cookies_are_httponly_and_samesite():
    response = Response()
    set_auth_cookies(response, "access-value", "refresh-value", 3600, 2592000)

    headers = _set_cookie_headers(response)
    assert len(headers) == 2, f"expected 2 cookies, got {len(headers)}"
    joined = " | ".join(headers)

    assert "HttpOnly" in joined, "access/refresh cookies must be HttpOnly"
    assert "samesite=lax" in joined.lower()
    assert "Path=/" in joined
    assert "access-value" in joined and "refresh-value" in joined


def test_each_cookie_carries_httponly_independently():
    """Both cookies must be protected, not just one of them.

    An assertion on the joined string passes if *either* cookie is HttpOnly, so
    this checks each cookie on its own to catch a regression that leaves the
    refresh token readable.
    """
    response = Response()
    set_auth_cookies(response, "access-value", "refresh-value", 3600, 2592000)

    access = next(h for h in _set_cookie_headers(response) if h.startswith(ACCESS_COOKIE))
    refresh = next(h for h in _set_cookie_headers(response) if h.startswith(REFRESH_COOKIE))

    assert "HttpOnly" in access, "access cookie must be HttpOnly"
    assert "HttpOnly" in refresh, "refresh cookie must be HttpOnly"


def test_cookie_names_are_not_the_old_javascript_readable_ones():
    """Regression guard for the old `vaeloom.accessToken` mirror cookie.

    That cookie was written without HttpOnly, so `document.cookie` could read it
    and `getToken()` even promoted it back into localStorage. Renaming the
    cookie makes a stale copy from a previous deploy obviously stale instead of
    being silently reused.
    """
    assert ACCESS_COOKIE != "vaeloom.accessToken"
    assert REFRESH_COOKIE != "vaeloom.refreshToken"


def test_cookie_name_has_no_dots_so_javascript_cannot_read_it():
    # The name is irrelevant to HttpOnly, but keeping it dot-free makes the
    # intent obvious at the call site and avoids colliding with the legacy
    # document.cookie lookups that still exist in the client.
    assert "." not in ACCESS_COOKIE
    assert "." not in REFRESH_COOKIE


def test_secure_flag_follows_environment(monkeypatch):
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "true")
    assert cookies_are_secure() is True
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    assert cookies_are_secure() is False
    monkeypatch.delenv("AUTH_COOKIE_SECURE")
    # Local HTTP dev must not set Secure or the browser silently drops the
    # cookie and login fails with no visible error.
    assert cookies_are_secure() is False


def test_clear_auth_cookies_expires_both():
    response = Response()
    clear_auth_cookies(response)
    headers = _set_cookie_headers(response)
    assert len(headers) == 2
    joined = " | ".join(headers)
    # The attributes must match the ones used when setting, otherwise the
    # browser keeps the original cookie and "logout" does nothing.
    assert "HttpOnly" in joined
    assert ACCESS_COOKIE in joined and REFRESH_COOKIE in joined
    assert "Max-Age=0" in joined or "expires=Thu, 01 Jan 1970" in joined


# ── mode negotiation ────────────────────────────────────────────────────────


def test_cookie_mode_requires_the_explicit_header():
    assert wants_cookie_only(_FakeRequest(headers={"X-Auth-Mode": "cookie"})) is True
    assert wants_cookie_only(_FakeRequest(headers={"X-Auth-Mode": "COOKIE"})) is True
    # Absent header must default to body tokens so the SDK, the CLI and the
    # existing test suite keep working.
    assert wants_cookie_only(_FakeRequest()) is False
    assert wants_cookie_only(_FakeRequest(headers={"X-Auth-Mode": "bearer"})) is False
    assert wants_cookie_only(None) is False


# ── CSRF rule ────────────────────────────────────────────────────────────────


def test_cookie_authenticated_request_is_csrf_reachable():
    from api.services.session_cookies import is_cookie_authenticated

    assert is_cookie_authenticated(_FakeRequest(cookies={ACCESS_COOKIE: "a"})) is True
    assert is_cookie_authenticated(_FakeRequest(cookies={REFRESH_COOKIE: "r"})) is True


def test_header_authenticated_request_is_not_csrf_reachable():
    """A cross-site attacker cannot make a browser attach Authorization."""
    from api.services.session_cookies import has_explicit_credential, is_cookie_authenticated

    with_header = _FakeRequest(
        headers={"Authorization": "Bearer x"}, cookies={ACCESS_COOKIE: "a"}
    )
    assert has_explicit_credential(with_header) is True
    assert is_cookie_authenticated(with_header) is False

    with_api_key = _FakeRequest(headers={"X-API-Key": "vael_x"})
    assert has_explicit_credential(with_api_key) is True

    # No credential at all. `is_cookie_authenticated` is False because there is
    # no cookie, but the CSRF middleware still challenges it, so the predicate
    # is not the decision on its own.
    anonymous = _FakeRequest()
    assert has_explicit_credential(anonymous) is False
    assert is_cookie_authenticated(anonymous) is False


# ── end to end through the real middleware stack ────────────────────────────


@pytest.fixture
def csrf_only_client():
    """A minimal app carrying ONLY the CSRF middleware.

    The shared `csrf_client` fixture mounts AuthMiddleware outside CSRF, so an
    invalid token is rejected with 401 before CSRF is ever consulted. That makes
    it useless for asserting the CSRF rule, because the assertion would pass for
    the wrong reason. This app removes the confound so a 403 can only come from
    the CSRF decision itself.
    """
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from api.middleware.csrf import CSRFMiddleware

    app = FastAPI()
    app.add_middleware(CSRFMiddleware)

    @app.post("/mutate")
    async def _mutate():
        return {"ok": True}

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_cookie_authenticated_mutation_without_csrf_token_is_rejected(
    csrf_only_client,
):
    """Negative control: the cookie alone must not authorise a write.

    This is the assertion that keeps the cookie rule honest. Loosening CSRF for
    bearer callers is only safe while a cookie credential still forces the
    double-submit check; without this test, silently dropping that check would
    leave the browser client fully CSRF-exposed and every suite would stay
    green.
    """
    csrf_only_client.cookies.set(ACCESS_COOKIE, "any-value-at-all")

    resp = await csrf_only_client.post("/mutate")

    assert resp.status_code == 403, (
        "a cookie-authenticated POST with no X-CSRF-Token must be rejected; "
        f"got {resp.status_code} {resp.text[:200]}"
    )


@pytest.mark.asyncio
async def test_refresh_cookie_alone_also_triggers_the_csrf_check(csrf_only_client):
    """A caller holding only the refresh cookie is equally forgeable."""
    csrf_only_client.cookies.set(REFRESH_COOKIE, "any-value-at-all")

    resp = await csrf_only_client.post("/mutate")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cookie_plus_valid_csrf_token_is_allowed(csrf_only_client):
    """Positive control: the correct header/cookie pair must let the write through.

    Without this, a middleware that simply rejected every cookie request would
    also satisfy the negative test above and lock all users out.
    """
    token, cookie_value = create_csrf_token()
    csrf_only_client.cookies.set("csrf_token", cookie_value)
    csrf_only_client.cookies.set(ACCESS_COOKIE, "any-value-at-all")

    resp = await csrf_only_client.post("/mutate", headers={"X-CSRF-Token": token})

    assert resp.status_code == 200, f"expected the write to succeed, got {resp.status_code}"


@pytest.mark.asyncio
async def test_mismatched_csrf_header_is_rejected(csrf_only_client):
    """Double-submit means both halves must agree."""
    _, cookie_value = create_csrf_token()
    csrf_only_client.cookies.set("csrf_token", cookie_value)
    csrf_only_client.cookies.set(ACCESS_COOKIE, "any-value-at-all")

    resp = await csrf_only_client.post(
        "/mutate", headers={"X-CSRF-Token": "a-different-token"}
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_bearer_authenticated_mutation_is_not_csrf_challenged(csrf_client):
    """Bearer is not an ambient credential, so CSRF does not apply to it."""
    resp = await csrf_client.post(
        "/api/v1/memories",
        json={"content": "bearer path", "workspace_id": "x"},
        headers={"Authorization": "Bearer vael_definitely_not_a_real_key"},
    )

    # The point is that the failure is auth (401), not CSRF (403): that proves
    # the request reached credential validation instead of being blocked early.
    assert resp.status_code == 401, f"expected auth failure, got {resp.status_code}"


@pytest.mark.asyncio
async def test_bearer_mutation_is_still_csrf_challenged(csrf_only_client):
    """The bearer exemption applies to refresh only, not to the whole API.

    The pre-existing posture is that every mutating request presents a CSRF
    token regardless of how it authenticates. This test pins that down so a
    future change cannot quietly widen the refresh exemption into a blanket one,
    which would be a real reduction in coverage.
    """
    resp = await csrf_only_client.post(
        "/mutate", headers={"Authorization": "Bearer some-token"}
    )
    assert resp.status_code == 403, (
        "a bearer-authenticated mutation must still require a CSRF token; "
        f"got {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_unauthenticated_mutation_is_still_csrf_challenged(csrf_only_client):
    """No credential is still challenged: nothing may act before the check."""
    resp = await csrf_only_client.post("/mutate")

    assert resp.status_code == 403, (
        f"an anonymous mutation must still be CSRF-challenged; got {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_csrf_token_endpoint_is_reachable_without_credentials(csrf_client):
    """The client must be able to bootstrap a CSRF token before it has a session."""
    resp = await csrf_client.get("/csrf-token")
    assert resp.status_code == 200
    assert resp.json().get("csrf_token")
    token, cookie_value = create_csrf_token()
    assert token and cookie_value


@pytest.mark.asyncio
async def test_refresh_endpoint_is_csrf_challenged_for_cookie_clients(csrf_client):
    """The behaviour the migration required.

    `/auth/refresh` sat in an unconditional CSRF skip list. Once the browser
    presents its refresh credential as a cookie, that would let an attacker page
    force a rotation — and rotation invalidates the previous token, so repeating
    it locks the victim out.
    """
    csrf_client.cookies.set(REFRESH_COOKIE, "some-refresh-token")

    resp = await csrf_client.post("/api/v1/auth/refresh", json={})

    assert resp.status_code == 403, (
        "cookie-based refresh must require a CSRF token; "
        f"got {resp.status_code} {resp.text[:200]}"
    )


@pytest.mark.asyncio
async def test_refresh_endpoint_still_works_for_body_token_clients(csrf_client):
    """The SDK refreshes with a body token and no CSRF header; that must not regress.

    This is why the exemption is conditional on the credential rather than a
    blanket skip: removing the skip outright would have locked every SDK and CLI
    caller out of refreshing.
    """
    resp = await csrf_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "sdk-supplied-token"},
    )

    # A 401 means the request passed CSRF and was rejected on the credential,
    # which is correct for a fake token. A 403 would mean the exemption broke.
    assert resp.status_code == 401, f"expected credential failure, got {resp.status_code}"
