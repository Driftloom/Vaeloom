'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
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

  // Intensity based on device
  const bgRange = isMobile ? -60 : -120;
  const bgScaleStart = 1.05;
  const bgScaleEnd = isMobile ? 1.02 : 1.0;
  const contentRange = isMobile ? -12 : -20;
  const sceneRange = isMobile ? -20 : -40;

  const backgroundYpx = useTransform(scrollYProgress, [0, 1], [0, bgRange]);
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [bgScaleStart, bgScaleEnd]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, contentRange]);
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, sceneRange]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0, 0.15]);

  // If reduced motion is preferred, disable transforms
  const bgY = shouldReduceMotion ? 0 : backgroundYpx;
  const bgScale = shouldReduceMotion ? 1 : backgroundScale;
  const fgY = shouldReduceMotion ? 0 : contentY;
  const fgSceneY = shouldReduceMotion ? 0 : sceneY;
  const opacity = shouldReduceMotion ? 1 : heroOpacity;

  return (
    <div ref={containerRef} className="relative h-[130vh] w-full">
      <motion.section
        style={{ opacity }}
        className="sticky top-0 flex h-screen w-full flex-col overflow-hidden pt-16"
        aria-labelledby="hero-title"
      >
        {/* Background: oversized 130% for parallax, GPU-friendly transform */}
        <motion.div
          style={{ y: bgY, scale: bgScale }}
          className="absolute inset-0 z-0 h-[130%] w-full will-change-transform"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-background" />
          <div className="absolute inset-0 landing-aurora" />
          <div className="landing-grid-bg absolute inset-0" />
        </motion.div>

        {/* Gradient overlay for readability, z-1 */}
        <motion.div
          style={{ opacity: shouldReduceMotion ? 0 : overlayOpacity }}
          className="absolute inset-0 z-[1] bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none"
          aria-hidden="true"
        />

        {/* Foreground content, z-10 */}
        <Container className="relative z-10 flex flex-1 flex-col justify-center">
          <div className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            {/* Text content with subtle parallax */}
            <motion.div style={{ y: fgY }} className="relative z-10 max-w-xl will-change-transform">
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
            </motion.div>

            {/* 3D scene with intermediate parallax for depth */}
            <motion.div
              style={{ y: fgSceneY }}
              className="relative h-[340px] sm:h-[420px] lg:h-[520px] will-change-transform"
              aria-hidden="true"
            >
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
            </motion.div>
          </div>
        </Container>
      </motion.section>
    </div>
  );
}
