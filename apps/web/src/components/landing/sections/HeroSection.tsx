'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { HERO } from '@/lib/landing/copy';
import { StageSlot } from '@/components/landing/3d/SceneShell';
import { ButtonLink, Icon } from '@/components/landing/shared/LandingKit';
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
  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);

  const bgY = shouldReduceMotion ? 0 : backgroundY;
  const bgScale = shouldReduceMotion ? 1 : backgroundScale;
  const fgY = shouldReduceMotion ? 0 : contentY;
  const opacity = shouldReduceMotion ? 1 : heroOpacity;

  // Where the 3D scene sits inside the frame.
  //
  // Mobile already drops it to the lower half so the core never sits behind
  // the heading. Light mode needs the same move at EVERY width, for a
  // different reason: the hero's particle streams radiate outward from a core
  // that sits dead centre — which is exactly where the copy block is. On dark
  // that reads as atmosphere behind the type; on white it reads as confetti on
  // top of it. So the trigger is the theme that has the legibility problem,
  // not the viewport.
  const scenePlacement = isLight ? 'top-[38%]' : 'max-md:top-1/2';

  return (
    <div ref={containerRef} id="hero" className="relative h-[130vh] w-full">
      <motion.section
        style={{ opacity, height: '100dvh' }}
        className="sticky top-0 flex h-screen w-full flex-col overflow-hidden"
        aria-labelledby="hero-title"
      >
        <motion.div
          style={{ y: bgY, scale: bgScale }}
          className="absolute inset-0 z-0 w-full h-[130%] top-[-15%] will-change-transform"
          aria-hidden="true"
        >
          <div className={`absolute inset-0 ${scenePlacement}`}>
            <StageSlot beat="hero" className="absolute inset-0" />
          </div>
          <div className="landing-grid-bg absolute inset-0 opacity-60" />
          <div className="absolute inset-0 landing-aurora opacity-80" />
        </motion.div>

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
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          suppressHydrationWarning
          style={{
            // Center wash behind the copy. Light mode needs more of it than dark:
            // on white the scene's mid-value particles sit ON TOP of dark text
            // rather than glowing behind it, so the type needs a real knockout
            // to stay readable. Centre tracks the copy block (h1 + subtitle +
            // CTAs), which sits slightly above the viewport midpoint.
            background: isLight
              ? 'radial-gradient(ellipse 78% 58% at 50% 40%, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.28) 55%, transparent 78%)'
              : 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(0,0,0,0.45) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <motion.div
          style={{ y: fgY }}
          className="relative z-10 flex flex-1 flex-col items-center justify-start px-4 pt-[6vh] text-center will-change-transform sm:pt-[8vh] lg:pt-[9vh]"
        >
          {/*
            Light mode gets a soft copy plate. A stronger wash gradient was
            tried first and is not enough: the hero scene scatters thousands
            of discrete particles across the whole viewport, and on white each
            one survives a 60%-white overlay as a visible mark. Dark mode
            needs no plate because the scene glows BEHIND the type instead of
            sitting on top of it. The plate is a legibility guarantee, not
            decoration — it is why the two themes read at different weights.

            Built as a radial gradient rather than a flat fill so it has no
            visible edge. A solid panel showed its rectangle against the
            particle field and read as an accidental box.
          */}
          <div
            className={
              isLight
                ? 'flex flex-col items-center bg-[radial-gradient(ellipse_64%_52%_at_50%_33%,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.92)_52%,rgba(255,255,255,0.62)_78%,rgba(255,255,255,0)_100%)] px-6 py-8 backdrop-blur-md sm:px-12 sm:py-10'
                : 'flex flex-col items-center'
            }
          >
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="landing-eyebrow mb-6"
            >
              Persistent memory · Approval-gated action
            </motion.p>

            <motion.h1
              id="hero-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl"
            >
              {HERO.titleA} <span className="landing-gradient-text">{HERO.titleB}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32 }}
              className="mt-5 max-w-2xl text-balance text-[15px] leading-relaxed text-text-secondary sm:mt-6 sm:text-lg"
            >
              {HERO.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.44 }}
              className="mt-7 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-9 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center"
            >
              <ButtonLink href={HERO.primary.href} variant="primary" size="lg" magnetic>
                {HERO.primary.label}
              </ButtonLink>
              <ButtonLink href={HERO.secondary.href} variant="secondary" size="lg">
                {HERO.secondary.label}
              </ButtonLink>
            </motion.div>

            {/* Proof line. Hidden on the smallest screens: on a short viewport the
                sticky hero is overflow-hidden, and the CTA pair outranks this. */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.56 }}
              className="mt-6 hidden items-center gap-2 text-xs font-medium text-text-muted sm:flex"
            >
              <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
              {HERO.assurance}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          style={{ opacity: shouldReduceMotion ? 0 : scrollHintOpacity }}
          className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-medium tracking-widest text-text-muted uppercase">
              Scroll
            </span>
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [0, 6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="h-8 w-px bg-gradient-to-b from-transparent via-text-muted to-transparent"
            />
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
}
