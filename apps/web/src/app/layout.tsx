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
import { ErrorTrackingBoundary } from '../lib/error-tracking-boundary';
import { WebVitals } from '../lib/web-vitals-client';
import { ToastProvider } from '../components/shared/Toast';
import { SkipLink } from '../components/shared/SkipLink';
import { AuthProvider } from '../hooks/useAuth';
import { SWRProvider } from '../components/providers/SWRProvider';

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
    default: 'Vaeloom | Your second brain for education and career',
    template: '%s | Vaeloom',
  },
  description:
    'A memory-first personal intelligence system for education and career. Connect your files, email, and code; Vaeloom builds a knowledge graph of your work, keeps a living master resume, surfaces matched roles, and organizes your workspace. Agents suggest — you approve.',
  keywords: [
    'second brain',
    'education',
    'career',
    'knowledge graph',
    'AI agents',
    'resume builder',
    'job search',
    'memory system',
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
    title: 'Vaeloom | Your second brain for education and career',
    description:
      'A memory-first personal intelligence system for education and career. Connect your work; Vaeloom builds a knowledge graph, keeps a living resume, and surfaces matched roles. Agents suggest — you approve.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Vaeloom — Your second brain for education and career',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vaeloom | Your second brain for education and career',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Pre-paint theme resolution — prevents flash of wrong theme. The
            brand default is dark; stored user choice or OS light preference
            is applied before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(t);}catch(e){}})();`,
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
      <body className="antialiased min-h-screen bg-background text-text">
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
                    <main id="main-content" tabIndex={-1} className="focus:outline-none">
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
