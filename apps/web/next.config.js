/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // `next dev` and `next build` share `.next` by default, so running a
  // production build while a dev server is up overwrites the dev server's
  // output (BUILD_ID / export-marker.json replace the dev manifests) and every
  // route then fails with a bare 500. Set NEXT_DIST_DIR to build somewhere else;
  // `pnpm build:isolated` does this. The default stays `.next` so CI, Docker
  // (apps/web/Dockerfile copies .next/standalone) and `next start` are unchanged.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: [
    '@supabase/ssr',
    '@supabase/supabase-js',
    '@supabase/auth-js',
    '@opentelemetry/api',
  ],
  output: process.env.CI === 'true' && process.platform !== 'win32' ? 'standalone' : undefined,
  transpilePackages: ['@vaeloom/shared-types', '@vaeloom/ui-kit'],
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 1080, 1920],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'vaeloom.app' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: '**.slack.com' },
    ],
  },
  async headers() {
    // CSP is set per-request in src/middleware.ts, not here. A nonce-based
    // Content-Security-Policy (E2) must mint a fresh nonce on every request, and
    // a build-time static `headers()` value cannot. It also has to be the single
    // CSP authority: two CSP headers are enforced together (the stricter result
    // wins), so a leftover static `unsafe-inline` policy here would neither
    // weaken nor help the nonce policy — it would just be dead, misleading
    // config. Non-HTML routes (excluded by the middleware matcher) don't need
    // CSP anyway.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Note: Content-Security-Policy and Strict-Transport-Security are set
          // dynamically in src/middleware.ts (nonce per request; HSTS only for
          // real domains so `next start` on localhost does not poison browser
          // HSTS caches / trigger ERR_SSL_PROTOCOL_ERROR).
        ],
      },
    ];
  },
  async rewrites() {
    // No port-specific special-casing here. An earlier revision ignored
    // INTERNAL_API_URL whenever it contained "8020", which silently sent API
    // traffic somewhere the operator had not chosen for anyone running on that
    // port. Whatever port the operator sets is the port that gets used.
    const rawTarget =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const target = rawTarget.replace('localhost', '127.0.0.1');
    const rules = [
      {
        source: '/api/v1/:path*',
        destination: `${target}/api/v1/:path*`,
      },
      {
        source: '/csrf-token',
        destination: `${target}/csrf-token`,
      },
      {
        source: '/health/:path*',
        destination: `${target}/health/:path*`,
      },
    ];
    return {
      beforeFiles: rules,
      afterFiles: rules,
      fallback: rules,
    };
  },
  async redirects() {
    return [];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
