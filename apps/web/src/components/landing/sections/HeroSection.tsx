'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { HERO } from '@/lib/landing/copy';
import { MemoryCoreScene } from '@/components/landing/3d/SceneShell';
import { StaticMemoryCore } from '@/components/landing/3d/StaticScenes';
import { useTheme } from '@/hooks/useTheme';

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
  const isLight = theme === 'light';

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
    <div ref={containerRef} id="hero" className="relative h-[130vh] w-full">
      <motion.section
        style={{ opacity, height: '100dvh' }}
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
        </motion.div>

        {/* Readability overlay — subtle, keeps heading legible without killing depth.
            Dark mode darkens; light mode lightens so dark text keeps WCAG AA contrast. */}
        <motion.div
          style={{ opacity: shouldReduceMotion ? 0 : overlayOpacity }}
          className={`absolute inset-0 z-[1] pointer-events-none ${
            isLight
              ? 'bg-gradient-to-b from-white/20 via-white/5 to-white/30'
              : 'bg-gradient-to-b from-black/20 via-black/5 to-black/30'
          }`}
          aria-hidden="true"
          suppressHydrationWarning
        />
        {/* Center wash behind text — low contrast area for typography.
            Inverted color only (alpha preserved) so each theme stays balanced. */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          suppressHydrationWarning
          style={{
            background: isLight
              ? 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(255,255,255,0.45) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(0,0,0,0.45) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* Foreground — heading as the hero unit, lifted above the core */}
        <motion.div
          style={{ y: fgY }}
          className="relative z-10 flex flex-1 flex-col items-center justify-start px-4 pt-[7vh] text-center will-change-transform sm:pt-[9vh] lg:pt-[11vh]"
        >
          <h1
            id="hero-title"
            className="mt-[1.2cm] max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl"
          >
            {HERO.titleA} <span className="landing-gradient-text">{HERO.titleB}</span>
          </h1>
        </motion.div>
      </motion.section>
    </div>
  );
}
