'use client';

import { useEffect, useRef } from 'react';
import { HERO, HERO_SOURCES } from '@/lib/landing/copy';
import { ButtonLink, Container, Icon, PillBadge } from '@/components/landing/shared/LandingKit';
import { MemoryCoreScene } from '@/components/landing/3d/SceneShell';
import { StaticMemoryCore } from '@/components/landing/3d/StaticScenes';
import { useTheme } from '@/hooks/useTheme';

/** Chip positions mirror the five stream origins in MemoryCoreCanvas. */
const CHIP_POS = [
  'left-[6%] top-[16%]',
  'right-[4%] top-[30%]',
  'left-[10%] bottom-[18%]',
  'right-[12%] bottom-[10%]',
  'left-[38%] top-[4%]',
] as const;

export default function HeroSection() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const bg = bgRef.current;
    if (!container || !bg) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const vh = window.innerHeight;
        const total = rect.height - vh;
        const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        const max = bg.offsetHeight - vh;
        bg.style.transform = `translateY(-${progress * max * 0.5}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-[140vh] w-full">
      <section
        className="sticky top-0 flex h-screen w-full flex-col overflow-hidden pt-16"
        aria-labelledby="hero-title"
      >
        <div
          ref={bgRef}
          className="absolute inset-0 z-0 h-[130%] w-full will-change-transform"
          aria-hidden="true"
        >
          <div className="absolute inset-0 landing-aurora" />
          <div className="landing-grid-bg absolute inset-0" />
        </div>
        <Container className="relative z-10 flex flex-1 flex-col justify-center">
          <div className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            {/* Copy — paints immediately; never waits on WebGL */}
            <div className="relative z-10 max-w-xl">
              <PillBadge dot>{HERO.eyebrow}</PillBadge>
              <h1
                id="hero-title"
                className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl"
              >
                {HERO.titleA} <span className="landing-gradient-text">{HERO.titleB}</span>
              </h1>
              <p className="mt-6 text-base leading-relaxed text-text-secondary sm:text-lg">
                {HERO.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href={HERO.primaryCta.href}>
                  {HERO.primaryCta.label}
                  <Icon name="arrow" className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href={HERO.secondaryCta.href} variant="secondary">
                  {HERO.secondaryCta.label}
                </ButtonLink>
              </div>
              <p className="mt-6 text-xs font-medium tracking-wide text-text-muted sm:text-sm">
                {HERO.credibility}
              </p>
            </div>

            {/* Living memory core */}
            <div className="relative h-[340px] sm:h-[420px] lg:h-[520px]" aria-hidden="true">
              <MemoryCoreScene theme={theme} fallback={<StaticMemoryCore />} />
              <ul className="pointer-events-none absolute inset-0">
                {HERO_SOURCES.map((src, i) => (
                  <li key={src.id} className={`absolute ${CHIP_POS[i]}`}>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-background/70 px-2.5 py-1 text-[11px] font-medium text-text-secondary backdrop-blur-sm">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: ['#22d3ee', '#818cf8', '#e879f9', '#22d3ee', '#818cf8'][i],
                        }}
                      />
                      {src.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
