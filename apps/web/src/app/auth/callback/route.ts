import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Supabase OAuth Server Route Handler (App Router official pattern).
 *
 * Handles the OAuth code exchange server-side via Next.js Route Handler.
 * Running server-side prevents React 18/19 StrictMode double-invocation,
 * eliminates client hydration race conditions, and guarantees that the
 * PKCE code verifier cookie is read reliably from the incoming request.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') ?? searchParams.get('next');

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl =
      process.env['NEXT_PUBLIC_SUPABASE_URL'] || 'https://yygakxcttyaeunvkeybx.supabase.co';
    const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignore in Route Handler if already writing to response
          }
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.session) {
      const accessToken = data.session.access_token;
      const refreshToken = data.session.refresh_token;

      // Determine destination workspace
      let targetPath = '/workspace';
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//') && redirect !== '/') {
        targetPath = redirect;
      } else {
        try {
          const backendUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000';
          const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          console.info('[auth/callback] /api/v1/auth/me status:', meRes.status);
          if (meRes.ok) {
            const meData = await meRes.json();
            // Log the shape of the response, never its contents. The body
            // carries user PII and workspace identifiers.
            const ws = meData.workspaces;
            const workspaceCount = Array.isArray(ws) ? ws.length : 0;
            console.info('[auth/callback] /api/v1/auth/me ok, workspace count:', workspaceCount);
            if (workspaceCount > 0 && ws[0]?.id) {
              targetPath = `/workspace/${ws[0].id}`;
            }
          } else {
            // Record the failure class and size only. The body is an
            // upstream error payload and must not be logged verbatim.
            const errText = await meRes.text();
            console.error(
              '[auth/callback] /api/v1/auth/me rejected:',
              meRes.status,
              'bodyBytes:',
              errText.length,
            );
          }
        } catch (fetchErr) {
          console.error('[auth/callback] /api/v1/auth/me call failed:', fetchErr);
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const baseUrl = isLocalEnv ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

      const destination = targetPath.startsWith('/')
        ? `${baseUrl}${targetPath}`
        : `${baseUrl}/${targetPath}`;
      const response = NextResponse.redirect(destination);

      // Set cookies for frontend
      response.cookies.set('vaeloom.accessToken', accessToken, {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
      });
      if (refreshToken) {
        response.cookies.set('vaeloom.refreshToken', refreshToken, {
          path: '/',
          maxAge: 86400 * 30,
          sameSite: 'lax',
        });
      }

      return response;
    } else {
      // error?.message from the provider is a failure description, not a
      // credential. It is logged without the code or any token material.
      console.error('[auth/callback] exchangeCodeForSession failed:', error?.message);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
