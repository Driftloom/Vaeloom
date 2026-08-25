'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { HERO, HERO_SOURCES } from '@/lib/landing/copy';
import { ButtonLink, Icon, PillBadge } from '@/components/landing/shared/LandingKit';
import { MemoryCoreScene } from '@/components/landing/3d/SceneShell';
import { StaticMemoryCore } from '@/components/landing/3d/StaticScenes';
import { useTheme } from '@/hooks/useTheme';

const CHIP_POS_IMMERSIVE = [
  'left-[4%] top-[18%]',
  'right-[6%] top-[22%]',
  'left-[8%] bottom-[24%]',
  'right-[10%] bottom-[18%]',
  'left-[42%] top-[8%]',
  'left-[18%] top-[52%]',
  'right-[18%] top-[52%]',
] as const;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export default function HeroSection() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const bgRange = isMobile ? -60 : -120;
  const bgScaleStart = 1.05;
  const bgScaleEnd = isMobile ? 1.02 : 1.0;
  const contentRange = isMobile ? -10 : -18;

  const backgroundY = useTransform(scrollYProgress, [0, 1], [0, bgRange]);
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [bgScaleStart, bgScaleEnd]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, contentRange]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0, 0.12]);

  const bgY = shouldReduceMotion ? 0 : backgroundY;
  const bgScale = shouldReduceMotion ? 1 : backgroundScale;
  const fgY = shouldReduceMotion ? 0 : contentY;
  const opacity = shouldReduceMotion ? 1 : heroOpacity;

  return (
    <div ref={containerRef} className="relative h-[130vh] w-full">
      <motion.section
        style={{ opacity }}
        className="sticky top-0 flex h-screen w-full flex-col overflow-hidden"
        aria-labelledby="hero-title"
      >
        {/* Full-viewport 3D environment — the hero IS the 3D world */}
        <motion.div
          style={{ y: bgY, scale: bgScale }}
          className="absolute inset-0 z-0 w-full h-[130%] top-[-15%] will-change-transform"
          aria-hidden="true"
        >
          {/* Base */}
          <div className="absolute inset-0 bg-background" />
          {/* 3D scene — covers entire hero, not a side card */}
          <div className="absolute inset-0">
            <MemoryCoreScene theme={theme} fallback={<StaticMemoryCore />} />
          </div>
          {/* Atmospheric grid — very subtle, provides scale */}
          <div className="landing-grid-bg absolute inset-0 opacity-60" />
          {/* Aurora — soft, not competing with text */}
          <div className="absolute inset-0 landing-aurora opacity-80" />
          {/* Chips distributed across the full environment */}
          <ul className="pointer-events-none absolute inset-0 hidden sm:block">
            {HERO_SOURCES.map((src, i) => (
              <li key={src.id} className={`absolute ${CHIP_POS_IMMERSIVE[i]}`}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-background/60 px-2.5 py-1 text-[11px] font-medium text-text-secondary backdrop-blur-md">
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
        </motion.div>

        {/* Readability overlay — subtle, keeps heading legible without killing depth */}
        <motion.div
          style={{ opacity: shouldReduceMotion ? 0 : overlayOpacity }}
          className="absolute inset-0 z-[1] bg-gradient-to-b from-black/20 via-black/5 to-black/30 pointer-events-none"
          aria-hidden="true"
        />
        {/* Center wash behind text — low contrast area for typography */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(0,0,0,0.45) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* Foreground — centered, integrated into the 3D world */}
        <motion.div
          style={{ y: fgY }}
          className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center will-change-transform"
        >
          <PillBadge dot>{HERO.eyebrow}</PillBadge>
          <h1
            id="hero-title"
            className="mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl"
          >
            {HERO.titleA} <span className="landing-gradient-text">{HERO.titleB}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {HERO.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        </motion.div>
      </motion.section>
    </div>
  );
}
