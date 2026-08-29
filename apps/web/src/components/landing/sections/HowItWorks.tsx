'use client';

import { useEffect, useRef, useState } from 'react';
import { HOW_IT_WORKS } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { StageSlot } from '@/components/landing/3d/SceneShell';

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
              <div className="stage-host relative h-full overflow-hidden rounded-3xl border border-border-subtle bg-black/40">
                <StageSlot beat="journey" className="absolute inset-0" />
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
