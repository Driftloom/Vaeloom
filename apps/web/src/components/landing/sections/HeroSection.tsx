'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { HERO } from '@/lib/landing/copy';
import { StageSlot } from '@/components/landing/3d/SceneShell';
import { ButtonLink, Icon } from '@/components/landing/shared/LandingKit';

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
  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);

  const bgY = shouldReduceMotion ? 0 : backgroundY;
  const bgScale = shouldReduceMotion ? 1 : backgroundScale;
  const fgY = shouldReduceMotion ? 0 : contentY;
  const opacity = shouldReduceMotion ? 1 : heroOpacity;

  // Where the 3D scene sits inside the frame.
  //
  // Mobile drops it to the lower half so the core never sits behind the heading.
  // Light mode needs the same move at EVERY width (top: 38%) for particle legibility.
  // Driven via CSS class `.hero-scene-placement` so SSR and client HTML match identically.

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
          <div className="hero-scene-placement absolute inset-0">
            <StageSlot beat="hero" className="absolute inset-0" />
          </div>
          <div className="landing-grid-bg absolute inset-0 opacity-60" />
          <div className="absolute inset-0 landing-aurora opacity-80" />
        </motion.div>

        <motion.div
          style={{ opacity: shouldReduceMotion ? 0 : overlayOpacity }}
          className="hero-overlay-gradient absolute inset-0 z-[1] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="hero-center-wash absolute inset-0 z-[1] pointer-events-none"
          aria-hidden="true"
        />

        <motion.div
          style={{ y: fgY }}
          className="relative z-10 flex flex-1 flex-col items-center justify-start px-4 pt-[6vh] text-center will-change-transform sm:pt-[8vh] lg:pt-[9vh]"
        >
          {/*
            Light mode gets a soft copy plate — a knockout that guarantees the
            type is legible no matter what the scene is doing. Dark mode needs
            none: there the scene glows BEHIND the type, which is the whole
            reason the dark hero works.

            The plate is a SIBLING of the copy, not its wrapper. That is the
            whole trick and it is easy to get backwards. `.hero-copy` is the
            positioning context, so `.hero-copy-plate` can be an oversized
            absolutely positioned ellipse (see globals.css) without disturbing
            the copy's own layout. Applied to the wrapper instead, the plate's
            own `left/right: -20rem` sizes the box to viewport + 40rem, which
            drags the headline, subtitle and primary CTA off-screen and makes
            the CTA row's `w-full` resolve against a 1015px containing block —
            the 448px-wide buttons on a 375px phone.

            Sizing the knockout is a geometry constraint rather than a taste
            call, which is why it lives in CSS:

              - a flat white fill shows its rectangle against the field;
              - an element-sized radial gradient still shows one, because an
                ellipse large enough to cover a copy block is always larger than
                its own box, and gets clipped by it;
              - `backdrop-blur` is worse still: a backdrop filter is clipped to
                the border box with NO falloff, so the blur runs to the edge and
                stops dead there.

            So the ellipse is deliberately much larger than the copy
            (`inset: -13rem -20rem`) and sized with `closest-side`, which puts
            the transparent stop exactly at its own edge in every direction.
            The paint therefore reaches zero before its bounds and there is no
            edge left to see.

            The scene's own density does the rest — see the light-mode weight in
            3d/vanilla/particleField.ts. The plate only has to finish the job on
            the last few marks, not fight several thousand of them.
          */}
          <div className="hero-copy relative flex flex-col items-center px-6 py-8 sm:px-12 sm:py-10">
            <div className="hero-copy-plate" aria-hidden="true" />

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
              className="mt-6 hidden items-center gap-2 text-xs font-medium text-text-secondary sm:flex"
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
