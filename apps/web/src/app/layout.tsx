import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import '../styles/globals.css';
import { ThemeProvider } from '../hooks/useTheme';
import {
  KeyboardShortcutProvider,
  KeyboardShortcutsModal,
  KeyboardShortcutListener,
  ShortcutsInitializer,
} from '../hooks/useKeyboardShortcuts';
import { ErrorTrackingBoundary } from '../lib/error-tracking-boundary';
import { WebVitals } from '../lib/web-vitals-client';
import { ToastProvider } from '../components/shared/Toast';
import { SkipLink } from '../components/shared/SkipLink';
import { AuthProvider } from '../hooks/useAuth';
import { SWRProvider } from '../components/providers/SWRProvider';

/**
 * Every route renders per request so the CSP nonce minted in `middleware.ts`
 * matches the scripts in the HTML.
 *
 * `middleware.ts` sets `script-src 'self' 'nonce-…' 'strict-dynamic'` in production.
 * A browser that sees a nonce **ignores `'self'` and `'unsafe-inline'` for
 * `script-src`** — that is what `strict-dynamic` means. So only scripts carrying
 * the request's nonce may execute. A statically prerendered page bakes its script
 * tags at build time, when no request nonce exists, so none of them carry one and
 * the browser blocks every one.
 *
 * The failure is silent and looks like a network fault: React never hydrates, so
 * `onSubmit` handlers never attach, native form submission takes over, and the app
 * appears to hang on `page.waitForURL`. It only appears in a production build —
 * `next dev` renders per request, so the nonce matches and dev stays green. That
 * is how an app-wide hydration failure reached a green test suite: the Playwright
 * specs assert against a production build (commit fc223467), and every one of them
 * timed out at login.
 *
 * Dropping `strict-dynamic` would also "fix" it and re-open the hole CSP was added
 * to close, so the renderer is made dynamic instead — the requirement
 * `middleware.ts` already documents at its own nonce comment.
 */
export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://vaeloom.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vaeloom | Your memory system for education and career',
    template: '%s | Vaeloom',
  },
  description:
    'A memory-first personal intelligence system for education and career. Connect your files, email, and code; Vaeloom builds a knowledge graph of your work, keeps a living master resume, surfaces matched roles, and organizes your workspace. Agents suggest — you approve.',
  keywords: [
    'memory system',
    'persistent memory',
    'education',
    'career',
    'knowledge graph',
    'AI agents',
    'resume builder',
    'job search',
    'students',
    'Vaeloom',
  ],
  authors: [{ name: 'Vaeloom' }],
  creator: 'Vaeloom',
  publisher: 'Vaeloom',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Vaeloom',
    title: 'Vaeloom | Your memory system for education and career',
    description:
      'A memory-first personal intelligence system for education and career. Connect your work; Vaeloom builds a knowledge graph, keeps a living resume, and surfaces matched roles. Agents suggest — you approve.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Vaeloom — Your memory system for education and career',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vaeloom | Your memory system for education and career',
    description:
      'A memory-first personal intelligence system for education and career. Connect your work; Vaeloom builds a knowledge graph and keeps a living resume. Agents suggest — you approve.',
    images: [`${siteUrl}/og-image.png`],
    creator: '@vaeloom',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Next.js stamps its own runtime and page chunks with the nonce it finds in the
  // `Content-Security-Policy` request header, but a hand-written inline `<script>`
  // is not covered by that pass. Under `strict-dynamic` an inline script without
  // the nonce is blocked, which for this script means the theme flash it exists to
  // prevent comes back — silently, and only in production.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Pre-paint theme resolution — prevents flash of wrong theme. The
            brand default is dark; stored user choice or OS light preference
            is applied before first paint. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'&&t!=='high-contrast'){if(window.matchMedia('(prefers-contrast: more)').matches){t='high-contrast';}else{t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}}var r=document.documentElement;r.classList.remove('light','dark','high-contrast');r.classList.add(t);r.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        <meta name="application-name" content="Vaeloom" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vaeloom" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="antialiased h-full min-h-screen bg-background text-text">
        <ErrorTrackingBoundary>
          <SWRProvider>
            <AuthProvider>
              <ThemeProvider>
                <ToastProvider>
                  <KeyboardShortcutProvider>
                    <ShortcutsInitializer />
                    <KeyboardShortcutListener />
                    <KeyboardShortcutsModal />
                    <WebVitals />
                    <SkipLink />
                    <main
                      id="main-content"
                      tabIndex={-1}
                      className="focus:outline-none min-h-0 h-full w-full"
                    >
                      {children}
                    </main>
                  </KeyboardShortcutProvider>
                </ToastProvider>
              </ThemeProvider>
            </AuthProvider>
          </SWRProvider>
        </ErrorTrackingBoundary>
      </body>
    </html>
  );
}
