'use client';

import { useRef, useState } from 'react';
import { AGENTS } from '@/lib/landing/copy';
import { Container, Reveal, Section, SectionHeading } from '@/components/landing/shared/LandingKit';
import { StaticOrbit } from '@/components/landing/3d/StaticScenes';
import { AGENT_HUES } from '@/components/landing/3d/scene-utils';
import { StageSlot } from '@/components/landing/3d/SceneShell';

export default function AgentSection() {
  const [selectedId, setSelectedId] = useState(AGENTS.list[0]!.id);
  const selected = AGENTS.list.find((a) => a.id === selectedId) ?? AGENTS.list[0]!;
  const activeIndex = Math.max(
    0,
    AGENTS.list.findIndex((a) => a.id === selectedId),
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const idx = AGENTS.list.findIndex((a) => a.id === selectedId);
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % AGENTS.list.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (idx - 1 + AGENTS.list.length) % AGENTS.list.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = AGENTS.list.length - 1;
    else return;
    e.preventDefault();
    const id = AGENTS.list[next]!.id;
    setSelectedId(id);
    tabRefs.current[next]?.focus();
  };

  return (
    <Section id="agents" labelledBy="agents-title" className="bg-surface-50/60">
      <Container>
        <SectionHeading
          id="agents-title"
          eyebrow={AGENTS.eyebrow}
          title={AGENTS.title}
          intro={AGENTS.intro}
        />

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
          {/* Orbit visual */}
          <Reveal>
            <div className="landing-panel relative rounded-3xl p-4 sm:p-6">
              <div
                className="relative mx-auto aspect-square w-full max-w-[480px]"
                role="img"
                aria-label={`${selected.name} selected. Eight specialist agents orbiting the shared memory core.`}
              >
                <StageSlot
                  beat="agents"
                  className="absolute inset-0"
                  fallback={
                    <StaticOrbit
                      labels={AGENTS.list.map(({ id, name }) => ({
                        id,
                        name: name.replace(' Agent', ''),
                      }))}
                      activeIndex={activeIndex}
                      colors={AGENT_HUES}
                    />
                  }
                />
              </div>
              {/* keyboard tablist — drives the same selection */}
              <div
                role="tablist"
                aria-label="Select an agent"
                onKeyDown={onTabKeyDown}
                className="mt-2 flex flex-wrap justify-center gap-1.5 border-t border-border-subtle pt-4"
              >
                {AGENTS.list.map((a, i) => (
                  <button
                    key={a.id}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    role="tab"
                    type="button"
                    aria-selected={a.id === selectedId}
                    tabIndex={a.id === selectedId ? 0 : -1}
                    onClick={() => setSelectedId(a.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      a.id === selectedId
                        ? 'bg-surface-active text-text shadow-glow'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text'
                    }`}
                  >
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ background: AGENT_HUES[a.id] }}
                      aria-hidden="true"
                    />
                    {a.name.replace(' Agent', '')}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Agent dossier */}
          <Reveal delay={0.1}>
            <div
              role="tabpanel"
              aria-label={`${selected.name} details`}
              className="landing-panel rounded-3xl p-6 sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: AGENT_HUES[selected.id] }}
                  aria-hidden="true"
                />
                <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                  {selected.role}
                </p>
              </div>
              <h3 className="mt-2 font-display text-2xl font-bold text-text">{selected.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">{selected.body}</p>

              <dl className="mt-6 space-y-4 border-t border-border-subtle pt-5">
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                    Autonomy
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-success">{selected.autonomy}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                    Operates with
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5">
                    {selected.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-border-subtle bg-surface-elevated px-2 py-1 text-xs text-text-secondary"
                      >
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                    Shared memory access
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      className="h-4 w-4 text-primary-400"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path
                        d="M12 3v6m0 6v6M3 12h6m6 0h6"
                        strokeLinecap="round"
                        strokeDasharray="2 3"
                      />
                    </svg>
                    Reads and writes the one knowledge graph — context shared across every agent.
                  </dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-text-muted">
          {AGENTS.footnote}
        </p>
      </Container>
    </Section>
  );
}
