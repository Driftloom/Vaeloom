'use client';

import { useState } from 'react';
import { MEMORY } from '@/lib/landing/copy';
import {
  Container,
  GlassCard,
  Reveal,
  Section,
  SectionHeading,
} from '@/components/landing/shared/LandingKit';
import { KnowledgeGraphScene, type GraphSelection } from '@/components/landing/3d/SceneShell';
import { StaticGraph } from '@/components/landing/3d/StaticScenes';
import { useTheme } from '@/hooks/useTheme';

/** Keyboard-operable curated nodes — indices match the canvas graph. */
const CURATED_NODES = [
  { index: 0, label: 'React', row: 0 },
  { index: 8, label: 'Campus Placement Portal', row: 1 },
  { index: 14, label: 'Infosys', row: 2 },
] as const;

type TooltipState =
  | { kind: 'curated'; row: number }
  | { kind: 'node'; label: string; typeName: string; connections: number }
  | null;

export default function MemorySection() {
  const { theme } = useTheme();
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const handleSelection = (sel: GraphSelection): void => {
    if (!sel) return;
    const curated = CURATED_NODES.find((c) => c.index === sel.index);
    if (curated) setTooltip({ kind: 'curated', row: curated.row });
    else
      setTooltip({
        kind: 'node',
        label: sel.info.label,
        typeName: sel.info.type,
        connections: sel.info.connections,
      });
  };

  return (
    <Section id="memory" labelledBy="memory-title">
      <Container>
        <SectionHeading
          id="memory-title"
          eyebrow={MEMORY.eyebrow}
          title={MEMORY.title}
          intro={MEMORY.intro}
        />

        {/* Interactive memory surface */}
        <Reveal className="mt-12">
          <div className="landing-panel relative overflow-hidden rounded-3xl p-4 sm:p-6">
            <div className="relative h-[360px] sm:h-[440px] lg:h-[500px]">
              <KnowledgeGraphScene
                theme={theme}
                fallback={<StaticGraph />}
                onSelectionChange={handleSelection}
              />
              {/* hover/read-out card */}
              {tooltip ? (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-80">
                  <div className="rounded-xl border border-border-subtle bg-background/90 p-4 shadow-elevated backdrop-blur-md">
                    {tooltip.kind === 'curated' ? (
                      (() => {
                        const r = MEMORY.interactions[tooltip.row]!;
                        return (
                          <dl className="space-y-2 text-xs leading-relaxed">
                            <div className="flex items-center justify-between gap-3">
                              <dt className="font-mono uppercase tracking-wider text-text-muted">
                                Node
                              </dt>
                              <dd className="text-right font-semibold text-text">{r.node}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="font-mono uppercase tracking-wider text-text-muted">
                                Relation
                              </dt>
                              <dd className="text-right text-text-secondary">{r.relation}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="font-mono uppercase tracking-wider text-text-muted">
                                Source
                              </dt>
                              <dd className="text-right text-text-secondary">{r.source}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt className="font-mono uppercase tracking-wider text-text-muted">
                                Confidence
                              </dt>
                              <dd className="text-right font-semibold text-success">
                                {r.confidence}
                              </dd>
                            </div>
                            <div className="border-t border-border-subtle pt-2 text-text-secondary">
                              {r.output}
                            </div>
                          </dl>
                        );
                      })()
                    ) : (
                      <dl className="space-y-2 text-xs leading-relaxed">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="font-mono uppercase tracking-wider text-text-muted">
                            Node
                          </dt>
                          <dd className="font-semibold text-text">{tooltip.label}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="font-mono uppercase tracking-wider text-text-muted">
                            Type
                          </dt>
                          <dd className="capitalize text-text-secondary">{tooltip.typeName}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="font-mono uppercase tracking-wider text-text-muted">
                            Linked memories
                          </dt>
                          <dd className="font-semibold text-primary-300">{tooltip.connections}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>
              ) : null}

              {/* sr-only narrative so the story never depends on 3D */}
              <p className="sr-only">
                Interactive knowledge graph. Nodes represent people, skills, projects,
                organizations, certificates, and events connected by typed relationships. Hover or
                focus a node to see its relationship, source, and confidence.
              </p>
            </div>

            {/* keyboard controls + legend */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-4">
              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="mr-1 text-xs font-medium text-text-muted">Inspect:</legend>
                {CURATED_NODES.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    onClick={() => setTooltip({ kind: 'curated', row: c.row })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      tooltip?.kind === 'curated' && tooltip.row === c.row
                        ? 'border-primary-400 bg-surface-active text-text'
                        : 'border-border-subtle text-text-secondary hover:border-primary-500/40 hover:text-text'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </fieldset>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Node types">
                {MEMORY.legend.map((l) => (
                  <li
                    key={l.type}
                    className="flex items-center gap-1.5 text-[11px] text-text-muted"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: l.color }}
                      aria-hidden="true"
                    />
                    {l.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Six memory types + four pillars */}
        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-xl font-bold text-text">
              Six kinds of structured memory
            </h3>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {MEMORY.types.map((t) => (
                <li
                  key={t.name}
                  className="rounded-xl border border-border-subtle bg-background/60 p-4"
                >
                  <p className="text-sm font-semibold text-text">{t.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">{t.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-text">One retrieval engine</h3>
            <ul className="mt-6 space-y-3">
              {MEMORY.pillars.map((p) => (
                <li key={p.name}>
                  <GlassCard className="p-4" hover={false}>
                    <p className="text-sm font-semibold text-accent-400">{p.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">{p.body}</p>
                  </GlassCard>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
