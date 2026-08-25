'use client';

import { useEffect, useRef, useState } from 'react';
import { HOW_IT_WORKS } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';

/**
 * The intelligence pipeline as a travel narrative: a sticky stage
 * indicator tracks the card you're reading. Pure IntersectionObserver —
 * no scroll-jacking, reduced-motion safe.
 */
export default function HowItWorks() {
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);

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
    <Section id="how-it-works" labelledBy="hiw-title" className="bg-surface-50/60">
      <Container>
        <SectionHeading
          id="hiw-title"
          eyebrow={HOW_IT_WORKS.eyebrow}
          title={HOW_IT_WORKS.title}
          intro={HOW_IT_WORKS.intro}
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[280px_1fr]">
          {/* Sticky stage indicator */}
          <div className="hidden lg:block">
            <div className="sticky top-28 landing-panel rounded-3xl p-6" aria-hidden="true">
              <p className="font-mono text-5xl font-semibold text-primary-400 tabular-nums">
                {stage.n}
              </p>
              <p className="mt-2 font-display text-xl font-bold text-text">{stage.name}</p>
              {/* progress rail */}
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
