'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NAV_LINKS } from '@/lib/landing/copy';
import { Container, LogoMark } from '@/components/landing/shared/LandingKit';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile sheet on anchor navigation.
  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [open]);

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
            <Link
              href="/login"
              className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-xl bg-action px-4 text-sm font-semibold text-action-fg shadow-glow transition-all hover:bg-action-hover hover:shadow-glow-lg"
            >
              Get started
            </Link>
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
            <li>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-base font-medium text-text-secondary hover:bg-surface-hover hover:text-text"
              >
                Sign in
              </Link>
            </li>
          </ul>
        </Container>
      </div>
    </header>
  );
}
