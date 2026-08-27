'use client';

import { useRef, useState } from 'react';
import { PREVIEW } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { StaticGraph } from '@/components/landing/3d/StaticScenes';

/**
 * Faithful HTML/CSS recreations of real Vaeloom surfaces, built from the
 * app's own tokens and layout patterns (sidebar groups, stat cards,
 * provenance chips, match rows). Not screenshots — live DOM.
 */

function AppChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border-subtle bg-background shadow-elevated"
      aria-label={`${title} preview`}
    >
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-elevated px-4 py-2.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-400 font-display text-[10px] font-bold text-white"
          aria-hidden="true"
        >
          V
        </span>
        <span className="text-xs font-semibold text-text">vaeloom</span>
        <span className="ml-1 rounded-md bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
          {title}
        </span>
      </div>
      <div className="flex">
        {/* mini sidebar */}
        <nav
          className="hidden w-32 shrink-0 flex-col gap-0.5 border-r border-border-subtle bg-surface-elevated/50 p-2 sm:flex"
          aria-hidden="true"
        >
          {[
            'Dashboard',
            'Workspace',
            'Memory Graph',
            'Resume',
            'Jobs',
            'Chat',
            'Schedule',
            'Connectors',
            'History',
            'Settings',
          ].map((item, i) => (
            <span
              key={item}
              className={`rounded-md px-2 py-1.5 text-[10px] font-medium ${
                (title === 'Dashboard' && i === 0) ||
                (title === 'Memory Graph' && i === 2) ||
                (title === 'Resume' && i === 3) ||
                (title === 'Jobs' && i === 4)
                  ? 'bg-surface-active text-text'
                  : 'text-text-muted'
              }`}
            >
              {item}
            </span>
          ))}
        </nav>
        <div className="min-h-[280px] flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="space-y-3">
      <p className="font-display text-sm font-bold text-text">Good morning, Aarav</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: 'Memories', v: '1,284' },
          { k: 'Suggestions', v: '5 pending' },
          { k: 'Deadlines', v: '2 this week' },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-lg border border-border-subtle bg-surface-elevated p-2.5"
          >
            <p className="truncate font-mono text-[9px] uppercase tracking-wider text-text-muted">
              {s.k}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-text">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
            Today’s digest · 6:00 AM
          </p>
          <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-success-fg">
            classified
          </span>
        </div>
        <ul className="mt-2 space-y-1.5 text-[11px] text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-warning" /> Interview invite — response
            suggested by tomorrow
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-info" /> 12 career-opportunity mails → 2
            shortlisted
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-text-dim" /> 41 newsletters archived silently
          </li>
        </ul>
      </div>
    </div>
  );
}

function GraphPreview() {
  return (
    <div className="relative">
      <div className="mx-auto max-h-64 max-w-64 opacity-90">
        <StaticGraph />
      </div>
      <div className="absolute bottom-1 right-1 flex gap-1" aria-hidden="true">
        {['person', 'skill', 'project'].map((t) => (
          <span
            key={t}
            className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[8px] capitalize text-text-muted backdrop-blur"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResumePreview() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="font-display text-xs font-bold text-text">Aarav Sharma — Resume v12</p>
        <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-success-fg">
          ATS 82%
        </span>
      </div>
      {[
        { t: 'Frontend Engineer · Zeta Systems', src: 'offer-letter.pdf' },
        { t: 'Lead · Campus Placement Portal', src: 'GitHub' },
        { t: 'ML Specialization · Coursera', src: 'certificate.pdf' },
      ].map((e) => (
        <div
          key={e.t}
          className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-2.5 py-2"
        >
          <p className="truncate text-[11px] font-medium text-text">{e.t}</p>
          <span className="shrink-0 font-mono text-[9px] text-primary-300">↳ {e.src}</span>
        </div>
      ))}
      <div className="rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-2">
        <p className="text-[10px] leading-snug text-warning-fg">
          Gap question: “Which year did you lead the SIH team? Confidence below threshold.”
        </p>
      </div>
    </div>
  );
}

function JobsPreview() {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
        Radar results · ranked against memory
      </p>
      {[
        {
          r: 'Frontend Engineer @ Zeta',
          fit: 92,
          why: 'React + TS overlap; design-system experience cited in 3 memories',
        },
        {
          r: 'SDE Intern @ Streamline',
          fit: 78,
          why: 'Node.js matches; missing SQL keyword flagged for resume',
        },
        {
          r: 'Full-stack @ Kite Labs',
          fit: 64,
          why: 'Deferred last month — will not resurface unless asked',
        },
      ].map((j) => (
        <div key={j.r} className="rounded-lg border border-border-subtle bg-surface-elevated p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold text-text">{j.r}</p>
            <span
              className={`shrink-0 font-mono text-[10px] font-bold ${j.fit >= 80 ? 'text-success' : j.fit >= 70 ? 'text-info' : 'text-text-muted'}`}
            >
              {j.fit}%
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-text-muted">{j.why}</p>
        </div>
      ))}
    </div>
  );
}

const TAB_VIEWS: Record<string, { title: string; view: React.ReactNode }> = {
  dashboard: { title: 'dashboard', view: <DashboardPreview /> },
  graph: { title: 'memory-graph', view: <GraphPreview /> },
  resume: { title: 'resume', view: <ResumePreview /> },
  jobs: { title: 'jobs-internships', view: <JobsPreview /> },
};

export default function ProductPreview() {
  const [tab, setTab] = useState('dashboard');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const idx = PREVIEW.tabs.findIndex((t) => t.id === tab);
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % PREVIEW.tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (idx - 1 + PREVIEW.tabs.length) % PREVIEW.tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = PREVIEW.tabs.length - 1;
    else return;
    e.preventDefault();
    const id = PREVIEW.tabs[next]!.id;
    setTab(id);
    tabRefs.current[next]?.focus();
  };

  return (
    <Section labelledBy="preview-title">
      <Container>
        <SectionHeading
          id="preview-title"
          eyebrow={PREVIEW.eyebrow}
          title={PREVIEW.title}
          intro={PREVIEW.intro}
        />
        <Reveal className="mt-12">
          <div
            role="tablist"
            aria-label="Product surfaces"
            onKeyDown={onTabKeyDown}
            className="mb-4 flex flex-wrap justify-center gap-1.5"
          >
            {PREVIEW.tabs.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? 'bg-action text-action-fg shadow-glow'
                    : 'border border-border-subtle text-text-secondary hover:border-primary-500/40 hover:text-text'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mx-auto max-w-3xl">
            <AppChrome title={TAB_VIEWS[tab]!.title}>{TAB_VIEWS[tab]!.view}</AppChrome>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
