import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/workspace'];
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/',
  '/forgot-password',
  '/status',
  '/terms',
  '/privacy',
  '/manifest.json',
  '/favicon.ico',
];

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
  const token = request.cookies.get('vaeloom.accessToken')?.value;

  const isAuthenticated = isTokenValid(token);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublicExact = PUBLIC_PATHS.some((p) => pathname === p);

  // If user arrives on /session-expired, clear session cookies cleanly and do not redirect
  if (pathname === '/session-expired') {
    const response = NextResponse.next();
    response.cookies.delete('vaeloom.accessToken');
    response.cookies.delete('vaeloom.refreshToken');
    return response;
  }

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    if (token) {
      redirectResponse.cookies.delete('vaeloom.accessToken');
      redirectResponse.cookies.delete('vaeloom.refreshToken');
    }
    return redirectResponse;
  }

  // Redirect authenticated users away from auth pages only if token is actually valid
  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/workspace', request.url));
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vaeloom.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: https://vaeloom.app",
      `connect-src 'self' https://*.supabase.co https://accounts.google.com https://*.algolia.net https://*.algolianet.com${
        process.env.NODE_ENV === 'development' ||
        process.env['ALLOW_LOCAL_API'] === 'true' ||
        request.nextUrl.hostname === 'localhost' ||
        request.nextUrl.hostname === '127.0.0.1'
          ? ' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000'
          : ' https://vaeloom.app'
      }`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|icon-192.png|icon-512.png).*)',
  ],
};
