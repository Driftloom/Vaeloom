'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_LINKS } from '@/lib/landing/copy';
import { Container, LogoMark } from '@/components/landing/shared/LandingKit';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { clearRefreshToken, clearToken, hasSession } from '@/lib/api';

export default function LandingNav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Check auth status
    const updateAuth = () => {
      setHasToken(hasSession());
    };
    updateAuth();
    window.addEventListener('vaeloom.auth_token_set', updateAuth);

    // Pre-warm routes
    router.prefetch('/login');
    router.prefetch('/signup');
    router.prefetch('/workspace');

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('vaeloom.auth_token_set', updateAuth);
    };
  }, [router]);

  // Close the mobile sheet on anchor navigation.
  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [open]);

  const handleNavigate = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (navigatingTo) return;
    setNavigatingTo(path);
    router.push(path);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    clearToken();
    clearRefreshToken();
    setHasToken(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-border-subtle bg-background/80 backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <Container>
        <nav aria-label="Primary" className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Vaeloom home">
            <LogoMark />
            <span className="font-display text-lg font-bold tracking-tight text-text">Vaeloom</span>
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {hasToken ? (
              <>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text sm:inline-flex"
                >
                  Sign out
                </button>
                <Link
                  href="/workspace"
                  onClick={handleNavigate('/workspace')}
                  prefetch={true}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-action px-4 text-sm font-semibold text-action-fg shadow-glow transition-all hover:bg-action-hover hover:shadow-glow-lg"
                >
                  {navigatingTo === '/workspace' ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-action-fg border-t-transparent" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <span>Go to Workspace</span>
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={handleNavigate('/login')}
                  prefetch={true}
                  className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text sm:inline-flex"
                >
                  {navigatingTo === '/login' ? (
                    <span className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Sign in...</span>
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </Link>
                <Link
                  href="/signup"
                  onClick={handleNavigate('/signup')}
                  prefetch={true}
                  className="inline-flex h-9 items-center rounded-xl bg-action px-4 text-sm font-semibold text-action-fg shadow-glow transition-all hover:bg-action-hover hover:shadow-glow-lg"
                >
                  {navigatingTo === '/signup' ? (
                    <span className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-action-fg border-t-transparent" />
                      <span>Loading...</span>
                    </span>
                  ) : (
                    'Get started'
                  )}
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="landing-mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle text-text-secondary lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </nav>
      </Container>

      {/* Mobile sheet */}
      <div
        id="landing-mobile-menu"
        hidden={!open}
        className="border-b border-border-subtle bg-background/95 backdrop-blur-xl lg:hidden"
      >
        <Container className="py-4">
          <ul className="space-y-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-base font-medium text-text-secondary hover:bg-surface-hover hover:text-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
            {hasToken ? (
              <>
                <li className="pt-2">
                  <Link
                    href="/workspace"
                    onClick={(e) => {
                      setOpen(false);
                      handleNavigate('/workspace')(e);
                    }}
                    className="flex h-10 w-full items-center justify-center rounded-xl bg-action px-4 text-sm font-semibold text-action-fg shadow-glow"
                  >
                    Go to Workspace
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full text-left rounded-lg px-3 py-2.5 text-base font-medium text-text-secondary hover:bg-surface-hover hover:text-text"
                  >
                    Sign out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="pt-2">
                  <Link
                    href="/signup"
                    onClick={(e) => {
                      setOpen(false);
                      handleNavigate('/signup')(e);
                    }}
                    className="flex h-10 w-full items-center justify-center rounded-xl bg-action px-4 text-sm font-semibold text-action-fg shadow-glow"
                  >
                    Get started
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    onClick={(e) => {
                      setOpen(false);
                      handleNavigate('/login')(e);
                    }}
                    className="block rounded-lg px-3 py-2.5 text-base font-medium text-text-secondary hover:bg-surface-hover hover:text-text"
                  >
                    Sign in
                  </Link>
                </li>
              </>
            )}
          </ul>
        </Container>
      </div>
    </header>
  );
}
