'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { FAQ } from '@/lib/landing/copy';
import { Container, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { StageSlot } from '@/components/landing/3d/SceneShell';

/**
 * Scroll entrance that survives a missing observer.
 *
 * `LandingKit.Reveal` serialises `initial={{ opacity: 0, y: 24 }}` into the SSR
 * HTML and only clears it from `whileInView`. Wrapping the FAQ in it meant all
 * nine answers shipped at `opacity: 0` and stayed there until an
 * IntersectionObserver fired — so with JS disabled, blocked by an extension, or
 * just slow, the entire FAQ was permanently invisible. Reference content has to
 * be readable without JS, so this variant renders the children untouched on
 * the server and through the first client render, and only opts into the
 * animation once mounted. The first render matches the server's HTML exactly,
 * so there is no hydration mismatch to warn about — note the order of the
 * guard: `mounted` is tested first, so `useReducedMotion` (which reads
 * matchMedia, and therefore has no server answer) can never influence the
 * first client render. Swapping the two conditions reintroduces the mismatch.
 */
function RevealRow({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => setMounted(true), []);

  if (!mounted || reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function FAQSection() {
  return (
    <Section id="faq" labelledBy="faq-title" className="relative">
      {/* The quietest beat on the page: this section is pure reading, so the
          scene stays a faint horizon and nothing competes with the answers. */}
      <StageSlot beat="faq" className="absolute inset-0 opacity-40" />
      <Container>
        {/* Left-aligned on purpose: nine stacked Q&As are a reading column, and
            a centred heading over them reads as a template. `align="left"`
            drops SectionHeading's implicit `mx-auto`, so the centred measure
            is restored here at the same width as the list below. */}
        <div className="mx-auto max-w-3xl">
          <SectionHeading id="faq-title" align="left" eyebrow={FAQ.eyebrow} title={FAQ.title} />
        </div>
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border-subtle">
          {FAQ.items.map((item, i) => (
            <RevealRow key={item.q} delay={Math.min(i * 0.04, 0.24)}>
              {/*
                <details>/<summary> is native disclosure and already carries
                expanded/collapsed semantics — adding aria-expanded here would
                only duplicate state the browser owns, and can drift from it.

                Padding belongs on the <summary>, not the <details>. With it
                on the wrapper the pressable area was only the summary's own
                content height — the 7px icon — about 28px, with 20px of dead
                space above and below that ignored taps. The bottom padding
                moves to the answer so the open state keeps its rhythm.
              */}
              <details className="group">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-5 text-left">
                  <span className="text-sm font-semibold text-text sm:text-base">{item.q}</span>
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-text-secondary transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 pb-5 text-sm leading-relaxed text-text-secondary">{item.a}</p>
              </details>
            </RevealRow>
          ))}
        </div>
      </Container>
    </Section>
  );
}
