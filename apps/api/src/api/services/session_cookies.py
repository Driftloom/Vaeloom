"""HttpOnly session cookies (GAP-AUTH-01 / W2.1).

Why this module exists
----------------------
The browser client used to persist the access JWT and the refresh token in
``localStorage``. That makes both credentials readable by any JavaScript running
on the origin, so a single XSS payload exfiltrates a long-lived credential that
keeps working after the tab is closed and is not revocable by clearing storage.

The fix is to hand the credentials to the browser as ``HttpOnly`` cookies and
let the browser attach them automatically. JavaScript can then neither read nor
forge them, and ``document.cookie`` can never leak them.

Two cookie names are used rather than one so the refresh credential has a much
longer lifetime than the access credential and the two can be rotated
independently.

Cookie attributes
-----------------
``HttpOnly``  not readable from JavaScript. This is the entire point.
``Secure``    sent over HTTPS only. Omitted in local development because
              browsers reject ``Secure`` cookies on plain ``http://`` origins,
              which would make local login silently fail.
``SameSite``  ``Lax`` sends the cookie on top-level navigations but not on
              cross-site sub-requests, which blocks the classic cross-site POST
              CSRF. It is *not* the whole defence: ``middleware/csrf.py`` still
              requires a signed double-submit token on cookie-authenticated
              mutations, because ``Lax`` does not defend against a compromised
              or attacker-controlled sibling subdomain.
``Path=/``    the cookie applies to the whole origin, which is required because
              the API is reached through the Next.js rewrite at ``/api/v1/*``.

Dual-read rollout
-----------------
The body of a login response still carries the tokens, because the TypeScript
SDK, the CLI and the Playwright suites authenticate with ``Authorization:
Bearer`` and have no cookie jar to rely on. A browser client opts out of
receiving them by sending ``X-Auth-Mode: cookie``; the router then blanks the
body fields and sets the cookies instead. That keeps one endpoint serving both
consumers without the web bundle ever seeing a credential in a response body.
"""

from __future__ import annotations

import os

from fastapi import Request, Response

# Deliberately not "vaeloom.accessToken": the old mirror cookie was readable by
# JavaScript, so a name change makes stale copies from a previous deploy
# obviously stale rather than silently reused.
ACCESS_COOKIE = "vaeloom_at"
REFRESH_COOKIE = "vaeloom_rt"

COOKIE_PATH = "/"

# Sent by browser clients that want credentials in cookies only. Any client that
# omits it (SDK, CLI, tests) keeps receiving tokens in the response body.
AUTH_MODE_HEADER = "X-Auth-Mode"
AUTH_MODE_COOKIE = "cookie"


def wants_cookie_only(request: Request | None) -> bool:
    """True when the caller asked for cookie-only credentials.

    Unknown or absent header means "not a browser BFF client", which keeps the
    SDK and the test suite on the body-token path they already depend on.
    """
    if request is None:
        return False
    value = request.headers.get(AUTH_MODE_HEADER, "")
    return value.strip().lower() == AUTH_MODE_COOKIE


def cookies_are_secure() -> bool:
    """Whether to set the ``Secure`` attribute.

    Explicit ``AUTH_COOKIE_SECURE`` wins so a TLS-terminating deployment can
    force it on. Otherwise it follows ``service_environment``: local HTTP
    development must not set it, because the browser would drop the cookie and
    login would fail with no visible error.
    """
    override = os.environ.get("AUTH_COOKIE_SECURE")
    if override is not None:
        return override.strip().lower() in {"1", "true", "yes", "on"}
    from ..config import settings

    return str(getattr(settings, "service_environment", "local")).lower() not in {
        "local",
        "test",
        "development",
        "dev",
    }


def _max_age(ttl_seconds: int) -> int:
    return max(int(ttl_seconds), 1)


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    access_ttl: int,
    refresh_ttl: int,
) -> None:
    """Attach the access and refresh credentials as HttpOnly cookies."""
    secure = cookies_are_secure()
    common = {
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "path": COOKIE_PATH,
    }
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=_max_age(access_ttl),
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=_max_age(refresh_ttl),
        **common,
    )


def clear_auth_cookies(response: Response) -> None:
    """Expire both session cookies.

    The attributes must match the ones used when setting them or the browser
    keeps the original cookie, which is the classic reason "logout" appears to
    do nothing.
    """
    secure = cookies_are_secure()
    common = {
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "path": COOKIE_PATH,
    }
    response.delete_cookie(ACCESS_COOKIE, **common)
    response.delete_cookie(REFRESH_COOKIE, **common)


def read_access_cookie(request: Request) -> str | None:
    value = request.cookies.get(ACCESS_COOKIE)
    return value if value else None


def read_refresh_cookie(request: Request) -> str | None:
    value = request.cookies.get(REFRESH_COOKIE)
    return value if value else None


def has_explicit_credential(request: Request) -> bool:
    """True when the request authenticates with a header the browser will not
    attach on a cross-site request.

    ``Authorization`` and ``X-API-Key`` are set by the caller's own code, not by
    the browser's ambient credential handling, so a cross-site attacker cannot
    make a victim's browser include them. This is what distinguishes the SDK and
    CLI from a browser session.
    """
    if request.headers.get("Authorization"):
        return True
    if request.headers.get("X-API-Key"):
        return True
    return False


def reads_session_cookie(request: Request) -> bool:
    """True when the request arrived carrying a session cookie.

    This is the discriminator for CSRF on ``/auth/refresh``: a body token is
    explicit and therefore not forgeable, while a cookie is ambient and is. It
    deliberately answers only about the cookie, ignoring header credentials,
    because that is precisely the question being asked.
    """
    return bool(read_access_cookie(request) or read_refresh_cookie(request))


def is_cookie_authenticated(request: Request) -> bool:
    """True when the request is authenticated by the session cookie.

    A cookie is an *ambient* credential: the browser attaches it to any request
    to this origin, including one triggered by another site. Such a request is
    exactly what CSRF protection exists to challenge.
    """
    if has_explicit_credential(request):
        return False
    return reads_session_cookie(request)
