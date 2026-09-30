'use client';

import { PROBLEM } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { StageSlot } from '@/components/landing/3d/SceneShell';

export default function ProblemSection() {
  return (
    <Section id="problem" labelledBy="problem-title" className="relative">
      <StageSlot beat="problem" className="absolute inset-0 opacity-40" />
      <Container>
        <SectionHeading
          id="problem-title"
          eyebrow={PROBLEM.eyebrow}
          title={PROBLEM.title}
          intro={PROBLEM.intro}
        />

        {/*
          This was a 4-up grid of bordered panels — number, bold title, one
          sentence — which is the same cell as ORGANIZATION's flow and TRUST's
          facts, so the four problems read as four features rather than as one
          escalating argument. It is now a single ruled reading surface with
          hanging ordinals and display-scale titles, so the section has a shape
          of its own and the problems visibly accumulate instead of sitting side
          by side as peers of equal weight. The panel is kept as one scrim
          because the text sits over a 3D wash; only the internal grid changed.
        */}
        <ol className="mx-auto mt-12 max-w-3xl divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-background/70 px-5 sm:px-7">
          {PROBLEM.steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.06}>
                <div className="grid gap-2 py-7 sm:grid-cols-[3.25rem_1fr] sm:gap-6">
                  {/* Decorative: the <ol> already announces position, and
                      "01" read aloud on its own is noise. */}
                  <span
                    className="font-mono text-xs font-semibold tabular-nums text-text-dim"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold tracking-tight text-text sm:text-2xl">
                      {s.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                      {s.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* The turn, not another feature: same measure, same left edge, so it
            reads as the conclusion of the four rows above it. */}
        <Reveal className="mx-auto mt-10 max-w-3xl">
          <p className="border-t border-border-subtle pt-8 font-display text-xl italic leading-snug text-text sm:text-2xl">
            {PROBLEM.resolution}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
