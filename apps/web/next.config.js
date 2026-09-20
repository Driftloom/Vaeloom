/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const cspConnectSrc =
  process.env.NODE_ENV === 'development' || process.env.ALLOW_LOCAL_API === 'true'
    ? "'self' http://localhost:8000 ws://localhost:8000 http://127.0.0.1:8000 ws://127.0.0.1:8000 https://*.supabase.co https://accounts.google.com https://*.algolia.net https://*.algolianet.com https://analytics.vaeloom.app"
    : "'self' https://vaeloom.app https://*.supabase.co https://accounts.google.com https://*.algolia.net https://*.algolianet.com https://analytics.vaeloom.app";

const nextConfig = {
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vaeloom.app",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: https://vaeloom.app",
              `connect-src ${cspConnectSrc}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const apiTarget =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const target = apiTarget.replace('localhost', '127.0.0.1');
    return [
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
  },
  async redirects() {
    return [];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
