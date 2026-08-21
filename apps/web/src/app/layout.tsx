import type { Metadata } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import '../styles/globals.css';
import { ThemeProvider } from '../hooks/useTheme';
import {
  KeyboardShortcutProvider,
  KeyboardShortcutsModal,
  KeyboardShortcutListener,
  ShortcutsInitializer,
} from '../hooks/useKeyboardShortcuts';
import { I18nProvider } from '../i18n';
import { ErrorTrackingBoundary } from '../lib/error-tracking-boundary';
import { WebVitals } from '../lib/web-vitals-client';
import { ToastProvider } from '../components/shared/Toast';
import { SkipLink } from '../components/shared/SkipLink';

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
    default: 'Vaeloom | Enterprise AI operating system',
    template: '%s | Vaeloom',
  },
  description:
    'Memory-first enterprise intelligence platform. Connect your data, deploy AI agents, and automate workflows securely.',
  keywords: [
    'AI',
    'enterprise',
    'knowledge graph',
    'AI agents',
    'workflow automation',
    'memory platform',
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
    title: 'Vaeloom | Enterprise AI operating system',
    description:
      'Memory-first enterprise intelligence platform. Connect your data, deploy AI agents, and automate workflows.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Vaeloom — Enterprise AI operating system',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vaeloom | Enterprise AI operating system',
    description:
      'Memory-first enterprise intelligence platform. Connect your data, deploy AI agents, and automate workflows.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <head>
        <meta name="application-name" content="Vaeloom" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vaeloom" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body className="antialiased min-h-screen bg-background text-text">
        <ErrorTrackingBoundary>
          <ThemeProvider>
            <I18nProvider>
              <ToastProvider>
                <KeyboardShortcutProvider>
                  <ShortcutsInitializer />
                  <KeyboardShortcutListener />
                  <KeyboardShortcutsModal />
                  <WebVitals />
                  <SkipLink />
                  <main id="main-content" tabIndex={-1} className="focus:outline-none">
                    {children}
                  </main>
                </KeyboardShortcutProvider>
              </ToastProvider>
            </I18nProvider>
          </ThemeProvider>
        </ErrorTrackingBoundary>
      </body>
    </html>
  );
}
