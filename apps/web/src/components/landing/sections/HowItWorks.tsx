'use client';

import { useEffect, useRef, useState } from 'react';
import { HOW_IT_WORKS } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { JourneyScene, useSceneAvailable } from '@/components/landing/3d/SceneShell';
import { useTheme } from '@/hooks/useTheme';

/**
 * The intelligence pipeline as a travel narrative. On capable devices a
 * scroll-scrubbed camera flies through nine 3D stations; the sticky rail
 * remains for reduced-motion / low-tier / no-WebGL. Pure IntersectionObserver
 * + scroll math — no scroll-jacking.
 */
export default function HowItWorks() {
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const sceneAvailable = useSceneAvailable();
  const { theme } = useTheme();

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset['idx']);
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        }
      },
      { rootMargin: '-40% 0px -50% 0px' },
    );
    cardRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Scroll progress across the section -> journey camera (no re-renders).
  useEffect(() => {
    if (!sceneAvailable) return;
    let raf = 0;
    const update = (): void => {
      raf = requestAnimationFrame(update);
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh * 0.5;
      const p = total > 0 ? (-rect.top + vh * 0.5) / total : 0;
      progressRef.current = Math.min(1, Math.max(0, p));
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [sceneAvailable]);

  const stage = HOW_IT_WORKS.stages[activeIdx] ?? HOW_IT_WORKS.stages[0]!;

  return (
    <Section
      id="how-it-works"
      labelledBy="hiw-title"
      className="bg-surface-50/60"
      // section ref for scroll math
      innerRef={sectionRef}
    >
      <Container>
        <SectionHeading
          id="hiw-title"
          eyebrow={HOW_IT_WORKS.eyebrow}
          title={HOW_IT_WORKS.title}
          intro={HOW_IT_WORKS.intro}
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[380px_1fr]">
          {/* Sticky journey visual / rail */}
          <div className="hidden lg:block">
            <div className="sticky top-28 h-[520px]">
              {sceneAvailable ? (
                <div className="relative h-full overflow-hidden rounded-3xl border border-border-subtle bg-black/40">
                  <JourneyScene theme={theme} progressRef={progressRef} />
                  <div className="pointer-events-none absolute bottom-5 left-5 right-5">
                    <p className="font-mono text-5xl font-semibold text-primary-400 tabular-nums">
                      {stage.n}
                    </p>
                    <p className="mt-1 font-display text-xl font-bold text-text">{stage.name}</p>
                  </div>
                  <p className="sr-only">
                    Scroll-driven visualization of the nine-stage Vaeloom pipeline. Stage {stage.n}:{' '}
                    {stage.name}.
                  </p>
                </div>
              ) : (
                <div className="sticky top-28 landing-panel rounded-3xl p-6" aria-hidden="true">
                  <p className="font-mono text-5xl font-semibold text-primary-400 tabular-nums">
                    {stage.n}
                  </p>
                  <p className="mt-2 font-display text-xl font-bold text-text">{stage.name}</p>
                  <ol className="mt-6 space-y-1.5">
                    {HOW_IT_WORKS.stages.map((s, i) => (
                      <li key={s.n} className="flex items-center gap-2">
                        <span
                          className={`h-1 rounded-full transition-all duration-500 ${
                            i === activeIdx ? 'w-8 bg-primary-400' : 'w-3 bg-border'
                          }`}
                        />
                        <span
                          className={`text-xs transition-colors ${
                            i === activeIdx ? 'font-semibold text-text' : 'text-text-dim'
                          }`}
                        >
                          {s.name}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Stage cards */}
          <ol className="space-y-4">
            {HOW_IT_WORKS.stages.map((s, i) => (
              <li
                key={s.n}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-idx={i}
                className={`rounded-2xl border p-5 transition-all duration-300 sm:p-6 ${
                  i === activeIdx
                    ? 'border-primary-500/40 bg-surface-elevated shadow-glow lg:scale-[1.01]'
                    : 'border-border-subtle bg-background/60 opacity-90'
                }`}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm font-semibold text-primary-400 sm:hidden lg:inline">
                    {s.n}
                  </span>
                  <h3 className="text-lg font-bold text-text">{s.name}</h3>
                </div>
                <p className="mt-2 max-w-2xl pl-0 text-sm leading-relaxed text-text-secondary sm:pl-9">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <Reveal className="mx-auto mt-12 max-w-2xl text-center">
          <p className="font-display text-lg italic text-text-secondary">
            “One file in, one application out — and every stage writes into the same memory.”
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
