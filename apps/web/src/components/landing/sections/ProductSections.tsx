'use client';

import { DIFFERENCE, PRINCIPLES } from '@/lib/landing/copy';
import {
  Container,
  Icon,
  Reveal,
  Section,
  SectionHeading,
} from '@/components/landing/shared/LandingKit';
import { StageSlot } from '@/components/landing/3d/SceneShell';

export function PrinciplesStrip() {
  return (
    <Section id="product" labelledBy="principles-title" className="relative">
      <StageSlot beat="principles" className="absolute inset-0 opacity-30" />
      <Container>
        {/* This section had no heading at all, so its first heading was the
            per-item <h3> — an h1->h3 skip — and `aria-labelledby` pointed at
            an id that existed nowhere in the repo. */}
        <SectionHeading
          id="principles-title"
          eyebrow="The guarantees"
          title="Five rules the system never breaks."
          align="left"
        />
        {/*
          Rendered as a ruled two-column list, not a five-across card grid.

          The old markup was the canonical AI feature cell repeated five times:
          N equal rounded panels, each with an icon, a bold title and one
          sentence — five `landing-panel`s, so five stacked `backdrop-filter:
          blur(14px)` layers bought zero legibility over the copy they wrapped.
          Worse, the layout said "here are five features" when the content is
          five commitments the product does not break; a grid of tiles flattens
          a guarantee into a feature.

          Rules read as rules: numbered, ruled, and set in a measure a human
          can scan. The 3D behind it is a wash at 30%, so the panel treatment
          is dropped rather than kept for decoration.
        */}
        <ol className="mt-12 max-w-3xl divide-y divide-border-subtle border-y border-border-subtle">
          {PRINCIPLES.map((p, i) => (
            <li
              key={p.title}
              className="grid grid-cols-[2.5rem_1fr] gap-x-4 py-5 sm:grid-cols-[3rem_1fr]"
            >
              <span
                className="font-mono text-xs font-semibold tabular-nums text-primary-400"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-text">{p.title}</h3>
                {/* Was `hidden sm:block`, which deleted this section's entire
                    substance on phones — the five rules went unstated on the
                    most common viewport. */}
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{p.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

export function ProductDifference() {
  return (
    <Section labelledBy="difference-title" className="relative overflow-hidden">
      <StageSlot beat="difference" className="absolute inset-0 opacity-30" />
      <Container>
        <SectionHeading
          id="difference-title"
          eyebrow={DIFFERENCE.eyebrow}
          title={DIFFERENCE.title}
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-[0.8fr_auto_1.2fr] md:items-stretch">
          {/* Chatbot side — visually subdued, still AA-readable */}
          <Reveal>
            <div className="h-full rounded-2xl border border-border-subtle bg-surface-50 p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-text-secondary">
                {DIFFERENCE.chatbot.label}
              </h3>
              <ol className="mt-5 space-y-3">
                {DIFFERENCE.chatbot.steps.map((s) => (
                  <li key={s} className="flex items-center gap-3 text-sm text-text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-text-dim" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-6 border-t border-border-subtle pt-4 text-xs leading-relaxed text-text-secondary">
                {DIFFERENCE.chatbot.verdict}
              </p>
            </div>
          </Reveal>

          {/* Divider */}
          <div className="hidden items-center md:flex" aria-hidden="true">
            <svg
              width="72"
              height="24"
              viewBox="0 0 72 24"
              fill="none"
              stroke="currentColor"
              className="text-primary-400"
            >
              <path
                d="M2 12h56m0 0l-7-7m7 7l-7 7"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Vaeloom side */}
          <Reveal delay={0.15}>
            <div className="landing-panel h-full rounded-2xl p-6 shadow-glow">
              <h3 className="font-mono text-xs uppercase tracking-widest text-accent-400">
                {DIFFERENCE.vaeloom.label}
              </h3>
              <ol
                className="relative mt-5 space-y-3 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-gradient-to-b before:from-primary-400 before:to-transparent"
                aria-label="The compounding loop"
              >
                {DIFFERENCE.vaeloom.steps.map((s) => (
                  <li
                    key={s}
                    className="relative flex items-center gap-3 pl-6 text-sm font-medium text-text"
                  >
                    <span
                      className="absolute left-0 h-[11px] w-[11px] rounded-full border-2 border-background bg-primary-400"
                      aria-hidden="true"
                    />
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-6 border-t border-border-subtle pt-4 text-xs leading-relaxed text-text-secondary">
                {DIFFERENCE.vaeloom.verdict}
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
