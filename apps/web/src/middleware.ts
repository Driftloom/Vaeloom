import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/workspace'];

/**
 * Lightweight client-side expiration check for UX routing only.
 * Cryptographic token verification is strictly enforced by the backend on every request.
 */
function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    const payloadPart = parts[1];
    if (parts.length !== 3 || !payloadPart) return false;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    const parsed = JSON.parse(jsonPayload);
    if (parsed.exp && Date.now() >= parsed.exp * 1000) {
      return false; // Token is expired
    }
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token =
    request.cookies.get('vaeloom_at')?.value || request.cookies.get('vaeloom.accessToken')?.value;

  const isAuthenticated = isTokenValid(token);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // If user arrives on /session-expired, clear session cookies cleanly and do not redirect
  if (pathname === '/session-expired') {
    const response = NextResponse.next();
    response.cookies.delete('vaeloom.accessToken');
    response.cookies.delete('vaeloom.refreshToken');
    response.cookies.delete('vaeloom_at');
    response.cookies.delete('vaeloom_rt');
    return response;
  }

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.cookies.delete('vaeloom.accessToken');
    redirectResponse.cookies.delete('vaeloom.refreshToken');
    redirectResponse.cookies.delete('vaeloom_at');
    redirectResponse.cookies.delete('vaeloom_rt');
    return redirectResponse;
  }

  // Redirect authenticated users away from auth pages only if token is actually valid
  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/workspace', request.url));
  }

  // E2 — per-request CSP nonce. A fresh, unpredictable nonce is minted for every
  // request so production `script-src` can drop 'unsafe-inline' entirely: only
  // scripts Next.js stamps with this nonce (its own runtime/page chunks) and the
  // author-controlled inline scripts that read it from `x-nonce` may execute.
  // Because the nonce is per-request, pages must render dynamically (see
  // `export const dynamic = 'force-dynamic'` in app/layout.tsx) — a build-time
  // prerendered page would bake inline scripts with no matching nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // DevEx footgun note: `connect-src` below only includes the local API
  // (http://localhost:8000 + ws://, plus 127.0.0.1) when this dev allowlist
  // matches: NODE_ENV === 'development', ALLOW_LOCAL_API === 'true', or the
  // request hostname is localhost/127.0.0.1. Production builds omit local
  // origins entirely — if browser fetches to localhost:8000 are SILENTLY
  // blocked (CSP console error, no response), check how the frontend was
  // started (dev server vs production build) and set ALLOW_LOCAL_API=true if
  // needed. Do not confuse with backend CSRF 403s, which hint at
  // `GET /csrf-token` in the response body.
  const isDevCsp =
    process.env.NODE_ENV === 'development' ||
    request.nextUrl.hostname === 'localhost' ||
    request.nextUrl.hostname === '127.0.0.1';
  const allowLocalApi =
    process.env.NODE_ENV === 'development' ||
    process.env['ALLOW_LOCAL_API'] === 'true' ||
    request.nextUrl.hostname === 'localhost' ||
    request.nextUrl.hostname === '127.0.0.1';

  // Production enables a script ONLY via the per-request nonce ('strict-dynamic'
  // lets the bundler load its own chunked scripts transitively). Dev keeps
  // 'unsafe-inline' + 'unsafe-eval' for the Next HMR runtime and is exercised
  // here as well so local and prod CSP share one code path.
  const scriptSrc = isDevCsp
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https://vaeloom.app`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://vaeloom.app`;

  // style-src keeps 'unsafe-inline': inline `style=""` attributes (React/Tailwind
  // runtime styles) cannot carry a nonce, and E2 targets scripts only.
  const cspValue = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://vaeloom.app https://*.supabase.co https://*.googleusercontent.com https://*.githubusercontent.com https://*.slack.com",
    `connect-src 'self' https://*.supabase.co https://accounts.google.com https://*.algolia.net https://*.algolianet.com https://analytics.vaeloom.app https://vaeloom.app${
      allowLocalApi
        ? ' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000'
        : ''
    }`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Hand the nonce + the concrete CSP to the renderer (Next.js parses this
  // request header and applies the nonce to the scripts it emits), and set the
  // same CSP on the response for the browser.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspValue);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set('Content-Security-Policy', cspValue);

  // Only enforce HSTS in production for real domain names (never on localhost/127.0.0.1,
  // which forces browsers like Edge/Chrome into ERR_SSL_PROTOCOL_ERROR on local HTTP dev).
  if (
    process.env.NODE_ENV === 'production' &&
    request.nextUrl.hostname !== 'localhost' &&
    request.nextUrl.hostname !== '127.0.0.1'
  ) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|icon-192.png|icon-512.png).*)',
  ],
};
