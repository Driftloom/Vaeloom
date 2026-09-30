'use client';

import { CAREER, CONNECTORS, ORGANIZATION, RESUME, SCHEDULER } from '@/lib/landing/copy';
import {
  Container,
  GlassCard,
  Icon,
  Reveal,
  Section,
  SectionHeading,
} from '@/components/landing/shared/LandingKit';
import { StageSlot } from '@/components/landing/3d/SceneShell';

/* ------------------------------ Connectors ------------------------------ */

export function ConnectorSection() {
  return (
    <Section id="connectors" labelledBy="connectors-title">
      <Container>
        <SectionHeading
          id="connectors-title"
          eyebrow={CONNECTORS.eyebrow}
          title={CONNECTORS.title}
          intro={CONNECTORS.intro}
        />
        <Reveal className="mt-12">
          {/* Streams: sources -> ingestion -> memory */}
          <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1.2fr_auto_1fr]">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Connectable sources">
              {CONNECTORS.items.map((c) => (
                <li
                  key={c.name}
                  className="rounded-xl border border-border-subtle bg-surface-elevated p-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon name={c.icon} className="h-4 w-4 text-primary-300" />
                    <p className="text-xs font-semibold text-text">{c.name}</p>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-text-muted">{c.scope}</p>
                </li>
              ))}
            </ul>

            <svg
              width="56"
              height="24"
              viewBox="0 0 56 24"
              fill="none"
              stroke="currentColor"
              className="mx-auto hidden rotate-0 text-primary-400 md:block"
              aria-hidden="true"
            >
              <path
                d="M2 12h40m0 0l-6-6m6 6l-6 6"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="landing-flow-line"
              />
            </svg>

            <div
              className="relative h-56 overflow-hidden rounded-2xl border border-border-subtle bg-surface-900/85 md:h-60"
              role="img"
              aria-label="Six connector sources streaming into one ingestion core"
            >
              <StageSlot beat="connectors" className="absolute inset-0" />
              {/* The floating name chips that used to live here are gone. They
                  claimed to label the ring sources but were pinned to static
                  percentages while the ring rotates continuously, so they
                  pointed at the wrong sources by up to 78% of the frame. They
                  also carried the same six names as real DOM in the list to
                  the left, and their 10px `text-text-secondary` on a light
                  chip over this dark frame measured 3.15:1 — a contrast
                  failure that axe never saw, because `role="img"` makes every
                  descendant presentational. Decoration that lies about the
                  3D is worse than no decoration. */}
              {/*
                  `text-white/45` was too faint here: 10px over this dark
                  frame measured 3.61:1, below the 4.5:1 floor for normal
                  text. /70 measures ~6.3:1.
                */}
              <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center font-mono text-2xs uppercase tracking-widest text-white/70">
                six sources, one ingestion core
              </p>
            </div>

            <svg
              width="56"
              height="24"
              viewBox="0 0 56 24"
              fill="none"
              stroke="currentColor"
              className="mx-auto hidden text-accent-400 md:block"
              aria-hidden="true"
            >
              <path
                d="M2 12h40m0 0l-6-6m6 6l-6 6"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="landing-flow-line"
              />
            </svg>

            <div className="rounded-xl border border-border-strong bg-gradient-to-br from-primary-600/20 to-transparent p-4 text-center shadow-glow-lg">
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                Destination
              </p>
              <p className="mt-1 font-display text-sm font-bold text-text">One memory</p>
              <p className="mt-1 text-xs text-text-secondary">
                graph + vectors + structured records
              </p>
            </div>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-text-muted">
            <Icon name="lock" className="h-3.5 w-3.5" />
            {CONNECTORS.note}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ----------------------------- Organization ------------------------------ */

export function OrganizationSection() {
  return (
    <Section labelledBy="org-title" className="relative landing-band">
      <StageSlot beat="organization" className="absolute inset-0 opacity-30" />
      <Container>
        <SectionHeading
          id="org-title"
          eyebrow={ORGANIZATION.eyebrow}
          title={ORGANIZATION.title}
          intro={ORGANIZATION.intro}
        />
        <ol className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ORGANIZATION.flow.map((f, i) => (
            <li key={f.step} className="h-full">
              <Reveal delay={i * 0.06} className="h-full">
                <div className="h-full rounded-2xl border border-border-subtle bg-background/70 p-5">
                  <span className="font-mono text-xs font-semibold text-primary-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-text">{f.step}</h3>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-text-muted">
                    {f.detail}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-center text-xs text-text-muted">
          Archive, never delete — every action logged with enough detail to undo it.
        </p>
      </Container>
    </Section>
  );
}

/* -------------------------------- Resume --------------------------------- */

export function ResumeSection() {
  return (
    <Section id="resume" labelledBy="resume-title" className="relative">
      <StageSlot beat="resume" className="absolute inset-0 opacity-30" />
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <SectionHeading
              id="resume-title"
              align="left"
              eyebrow={RESUME.eyebrow}
              title={RESUME.title}
              intro={RESUME.intro}
            />
            <ul className="mt-8 space-y-4">
              {RESUME.points.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    // Accent, not success. These bullets assert that a feature
                    // exists; none of them reports a state that completed. Green
                    // is reserved in this file for a grounded source citation,
                    // and reusing it for marketing claims spent the signal.
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary-400"
                    aria-hidden="true"
                  >
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-text">{p.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-1.5" aria-label="Export templates">
              {RESUME.templates.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border-subtle bg-surface-elevated px-2 py-1 font-mono text-2xs text-text-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Evidence -> resume artifact */}
          <Reveal delay={0.1}>
            <GlassCard className="overflow-hidden !p-0" hover={false} tilt>
              <div className="border-b border-border-subtle px-5 py-3">
                <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                  Master resume · assembled from memory
                </p>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                {[
                  {
                    role: 'Frontend Engineer',
                    org: 'Zeta Systems',
                    src: 'offer-letter.pdf',
                    bullets: [
                      'Shipped design system used by 4 squads',
                      'Cut LCP 38% via route-level code splitting',
                    ],
                  },
                  {
                    role: 'Project Lead',
                    org: 'Campus Placement Portal',
                    src: 'GitHub · commit history',
                    bullets: [
                      'Led 4-person team to SIH 2025 finals',
                      'Built React + Node placement workflow',
                    ],
                  },
                  {
                    role: 'Machine Learning',
                    org: 'Coursera Specialization',
                    src: 'certificate.pdf',
                    bullets: ['Supervised learning, embeddings, eval'],
                  },
                ].map((entry) => (
                  <div
                    key={entry.role}
                    className="rounded-xl border border-border-subtle bg-background/60 p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-text">
                        {entry.role} · <span className="text-text-secondary">{entry.org}</span>
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-2xs text-success-fg">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="h-3 w-3"
                          aria-hidden="true"
                        >
                          <path d="M9 12l2 2 4-4" />
                        </svg>
                        {entry.src}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {entry.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-xs text-text-secondary">
                          <span
                            className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-400"
                            aria-hidden="true"
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-center font-mono text-2xs text-text-dim">
                  confidence &lt; 80% → asks you a specific question · never fabricates
                </p>
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------- Career ---------------------------------- */

export function CareerSection() {
  return (
    <Section id="career" labelledBy="career-title" className="relative landing-band">
      {/* Was 45%, compensating for scene-side opacities that are now fixed:
          careerScene floors its cards at 0.4 base and its presence at
          `0.55 + lp * 0.45`, so the wash no longer has to carry visibility.
          At 45% this section read measurably brighter than its opacity-30
          neighbours on both passes, and the mismatch was the only thing the
          eye caught scrolling through. */}
      <StageSlot beat="career" className="absolute inset-0 opacity-30" />
      <Container>
        {/* `align="left"` drops SectionHeading's implicit `mx-auto`, so the
            measure column is supplied here — at the same width as the list
            below, or a left-aligned heading and a centred list disagree about
            where the left edge is. */}
        <div className="mx-auto max-w-5xl">
          <SectionHeading
            id="career-title"
            align="left"
            eyebrow={CAREER.eyebrow}
            title={CAREER.title}
          />
        </div>
        <ol className="mx-auto mt-12 max-w-5xl space-y-2">
          {CAREER.stages.map((s, i) => (
            <li key={s.name}>
              <Reveal delay={i * 0.05}>
                {/* No hover border and no `group`: there is no destination to
                    go to, and nothing in here was going to respond to a
                    `group-hover:` either. The lift on hover announced a
                    click that does not exist. */}
                <div className="relative flex items-start gap-4 rounded-2xl border border-border-subtle bg-background/70 p-4 sm:p-5">
                  <div className="flex flex-col items-center self-stretch" aria-hidden="true">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary-500/30 bg-surface-elevated font-mono text-xs font-bold text-primary-300">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {i < CAREER.stages.length - 1 ? (
                      <span className="mt-1 w-px flex-1 bg-gradient-to-b from-primary-400/50 to-transparent" />
                    ) : null}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text">{s.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
        {/* Not `text-success`. This is a standing privacy guarantee, not an OK
            state, and the same file uses green for a verified source citation —
            two different meanings on one page. A lock reads as the guarantee
            it is, and matches how CONNECTORS.note is set. */}
        <p className="mx-auto mt-8 flex max-w-5xl items-start gap-2 text-xs leading-relaxed text-text-secondary">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {CAREER.note}
        </p>
      </Container>
    </Section>
  );
}

/* ------------------------------- Scheduler -------------------------------- */

export function SchedulerSection() {
  return (
    <Section id="scheduler" labelledBy="sched-title" className="relative">
      <StageSlot beat="scheduler" className="absolute inset-0 opacity-30" />
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <SectionHeading
              id="sched-title"
              align="left"
              eyebrow={SCHEDULER.eyebrow}
              title={SCHEDULER.title}
            />
            <ul className="mt-8 space-y-4">
              {SCHEDULER.points.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="mt-0.5 h-4 w-4 shrink-0 text-info"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" strokeLinecap="round" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-text">{p.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Email -> extracted intelligence */}
          <Reveal delay={0.1}>
            <GlassCard className="!p-0 overflow-hidden" hover={false} tilt>
              <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-3.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 font-display text-xs font-bold text-white"
                  aria-hidden="true"
                >
                  C
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{SCHEDULER.email.from}</p>
                  <p className="truncate text-xs text-text-secondary">{SCHEDULER.email.subject}</p>
                </div>
              </div>
              <p className="px-5 py-3 text-xs italic leading-relaxed text-text-muted">
                {SCHEDULER.email.snippet}
              </p>
              <div className="space-y-2 border-t border-border-subtle bg-surface-elevated/60 px-5 py-4">
                <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
                  Vaeloom extracted
                </p>
                {SCHEDULER.email.extracted.map((e, i) => (
                  <div
                    key={e.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-background/70 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-text-muted">{e.label}</span>
                    <span
                      className={`text-xs font-semibold ${i === 2 ? 'text-warning' : 'text-text'}`}
                    >
                      {e.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-xs text-text-muted">Action</span>
                  <span className="rounded-md bg-action px-2.5 py-1 text-xs font-semibold text-action-fg">
                    Awaiting your approval
                  </span>
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
