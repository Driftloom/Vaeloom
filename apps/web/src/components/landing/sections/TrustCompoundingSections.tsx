'use client';

import { motion, useReducedMotion } from 'motion/react';
import { COMPOUNDING, TRUST } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { StageSlot } from '@/components/landing/3d/SceneShell';

/* --------------------------------- Trust ---------------------------------- */

const STATE_STYLE: Record<string, { label: string; cls: string }> = {
  always: { label: 'Default', cls: 'bg-success/10 text-success-fg' },
  grant: { label: 'Explicit grant', cls: 'bg-info/10 text-info-fg' },
  approval: { label: 'Approval-gated', cls: 'bg-warning/10 text-warning-fg' },
  earned: { label: 'Earned · revocable', cls: 'bg-primary-500/10 text-primary-300' },
  log: { label: 'Append-only', cls: 'bg-surface-elevated text-text-secondary' },
};

export function TrustSection() {
  return (
    <Section id="trust" labelledBy="trust-title" className="bg-surface-50/60">
      <Container>
        <SectionHeading
          id="trust-title"
          eyebrow={TRUST.eyebrow}
          title={TRUST.title}
          intro={TRUST.intro}
        />
        <Reveal className="mx-auto mt-12 max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-background/70">
            {TRUST.rows.map((r) => (
              <div
                key={r.axis}
                className="flex flex-col gap-1.5 border-b border-border-subtle p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
              >
                <p className="w-40 shrink-0 text-sm font-bold text-text">{r.axis}</p>
                <p className="flex-1 text-xs leading-relaxed text-text-secondary">{r.mvp}</p>
                <span
                  className={`inline-flex w-fit shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                    STATE_STYLE[r.state]?.cls ?? 'bg-surface-elevated text-text-secondary'
                  }`}
                >
                  {STATE_STYLE[r.state]?.label ?? r.state}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
        <p className="mt-8 text-center font-display text-lg italic text-text-secondary">
          “{TRUST.quote}”
        </p>
        <Reveal className="mx-auto mt-12 max-w-4xl">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.facts.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-border-subtle bg-background/60 p-5"
              >
                <p className="text-sm font-semibold text-text">{f.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ------------------------------ Compounding -------------------------------- */

export function CompoundingSection() {
  const reduce = useReducedMotion();

  return (
    <Section labelledBy="compounding-title" className="overflow-hidden">
      <div className="landing-grid-bg absolute inset-0" aria-hidden="true" />
      <Container className="relative">
        <SectionHeading
          id="compounding-title"
          eyebrow={COMPOUNDING.eyebrow}
          title={COMPOUNDING.title}
          intro={COMPOUNDING.intro}
        />

        <div className="mx-auto mt-16 max-w-4xl">
          <div
            className="stage-host relative h-[300px] overflow-hidden rounded-3xl border border-border-subtle bg-black/40 sm:h-[360px]"
            role="img"
            aria-label="Memory lattice assembling as you scroll — sparse at day one, dense by year one. Scroll to grow the memory."
          >
            <StageSlot beat="growth" className="absolute inset-0" />
            <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center font-mono text-[11px] uppercase tracking-widest text-text-muted">
              scroll to compound
            </p>
            <p className="sr-only">
              Interactive visualization: memory density grows as you scroll, from a sparse lattice
              on day one to a dense personal intelligence by year one.
            </p>
          </div>
          <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COMPOUNDING.milestones.map((m) => (
              <li key={m.when} className="text-center">
                <p className="font-mono text-xs font-semibold text-primary-300">{m.when}</p>
                <p className="mt-1 text-[11px] leading-snug text-text-muted">{m.state}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-sm text-text-secondary">
            The moat isn’t the model. It’s your graph.
          </p>
        </div>
      </Container>
    </Section>
  );
}
