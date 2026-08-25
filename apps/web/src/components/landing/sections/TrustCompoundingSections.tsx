'use client';

import { motion, useReducedMotion } from 'motion/react';
import { COMPOUNDING, TRUST } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';

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
            className="flex h-56 items-end gap-3 sm:gap-6"
            role="img"
            aria-label="Memory density growing from day one to year one. Sparse at day one, connected by month one, strong by month six, deep by year one."
          >
            {COMPOUNDING.milestones.map((m, i) => (
              <div key={m.when} className="group flex flex-1 flex-col items-center gap-3">
                {/* bar */}
                <div className="relative flex h-44 w-full items-end overflow-hidden rounded-t-xl border border-border-subtle bg-surface-elevated/50">
                  <motion.div
                    className="landing-density-bar w-full"
                    initial={reduce ? false : { height: '4%' }}
                    whileInView={{ height: `${m.density}%` }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 1.1, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: `${m.density}%` }}
                  >
                    {/* nodes inside the "memory" */}
                    <div className="absolute inset-x-0 bottom-0 h-full">
                      {Array.from({ length: Math.round((m.density / 100) * 9) }).map((_, d) => (
                        <span
                          key={d}
                          className="absolute h-1 w-1 rounded-full bg-white/80"
                          style={{
                            left: `${15 + ((d * 37) % 70)}%`,
                            top: `${12 + ((d * 53) % 76)}%`,
                          }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </motion.div>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs font-semibold text-primary-300">{m.when}</p>
                  <p className="mt-1 hidden max-w-[160px] text-[11px] leading-snug text-text-muted group-hover:block lg:block">
                    {m.state}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-text-secondary">
            The moat isn’t the model. It’s your graph.
          </p>
        </div>
      </Container>
    </Section>
  );
}
