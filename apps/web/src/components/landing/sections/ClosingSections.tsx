'use client';

import Link from 'next/link';
import { ENTERPRISE, FINAL_CTA, FOOTER } from '@/lib/landing/copy';
import {
  ButtonLink,
  Container,
  LogoMark,
  PillBadge,
  Reveal,
  Section,
  SectionHeading,
} from '@/components/landing/shared/LandingKit';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { CtaCoreScene, useSceneAvailable } from '@/components/landing/3d/SceneShell';
import { useTheme } from '@/hooks/useTheme';

/* ------------------------------- Enterprise -------------------------------- */

export function EnterpriseSection() {
  return (
    <Section id="enterprise" labelledBy="enterprise-title" className="bg-surface-50/60">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <PillBadge>{ENTERPRISE.badge}</PillBadge>
        </div>
        <SectionHeading
          id="enterprise-title"
          eyebrow={ENTERPRISE.eyebrow}
          title={ENTERPRISE.title}
          intro={ENTERPRISE.intro}
          align="center"
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Shipping today */}
          <Reveal>
            <div className="h-full rounded-2xl border border-success/25 bg-background/70 p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-success-fg">
                In the product today
              </p>
              <ul className="mt-5 space-y-4">
                {ENTERPRISE.shipped.map((s) => (
                  <li key={s.name}>
                    <p className="text-sm font-bold text-text">{s.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{s.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Vision */}
          <Reveal delay={0.12}>
            <div className="h-full rounded-2xl border border-primary-500/30 bg-surface-elevated p-6 shadow-glow">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-400">
                Platform direction
              </p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {ENTERPRISE.vision.map((v) => (
                  <li
                    key={v.name}
                    className="rounded-xl border border-border-subtle bg-background/60 p-4"
                  >
                    <p className="text-sm font-bold text-text">{v.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{v.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------- Final CTA -------------------------------- */

export function FinalCTA() {
  const sceneAvailable = useSceneAvailable();
  const { theme } = useTheme();
  return (
    <Section labelledBy="cta-title" className="overflow-hidden !py-24 sm:!py-32">
      <div className="landing-grid-bg absolute inset-0" aria-hidden="true" />
      {sceneAvailable ? (
        <div className="absolute inset-0 opacity-70" aria-hidden="true">
          <CtaCoreScene theme={theme} />
        </div>
      ) : (
        <div
          className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[110px]"
          style={{ background: 'rgb(var(--landing-glow-a))' }}
          aria-hidden="true"
        />
      )}
      <Container className="relative text-center">
        <Reveal>
          <LogoMark size="lg" />
          <h2
            id="cta-title"
            className="mx-auto mt-8 max-w-3xl font-display text-3xl font-bold tracking-tight text-text sm:text-5xl sm:leading-[1.12]"
          >
            {FINAL_CTA.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-text-secondary sm:text-lg">
            {FINAL_CTA.subtitle}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={FINAL_CTA.primary.href}>{FINAL_CTA.primary.label}</ButtonLink>
            <ButtonLink href={FINAL_CTA.secondary.href} variant="secondary">
              {FINAL_CTA.secondary.label}
            </ButtonLink>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------------------------- Footer --------------------------------- */

export function LandingFooter() {
  return (
    <footer
      className="border-t border-border-subtle bg-surface-50/40"
      aria-labelledby="footer-heading"
    >
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5" aria-label="Vaeloom home">
              <LogoMark />
              <span className="font-display text-lg font-bold tracking-tight text-text">
                Vaeloom
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-muted">{FOOTER.blurb}</p>
            <div className="mt-5">
              <ThemeToggle />
            </div>
          </div>
          {FOOTER.columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('/') ? (
                      <Link
                        href={l.href}
                        className="text-sm text-text-secondary transition-colors hover:text-text"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        className="text-sm text-text-secondary transition-colors hover:text-text"
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-text-dim">© {new Date().getFullYear()} Vaeloom.</p>
          <p className="font-mono text-[11px] text-text-dim">
            Passive by default · active on request
          </p>
        </div>
      </Container>
    </footer>
  );
}
