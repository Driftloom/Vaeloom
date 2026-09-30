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
import { StageSlot, useStageSelection } from '@/components/landing/3d/SceneShell';

/**
 * Keyboard-operable curated nodes — `index` is the curated id the WebGL
 * graph resolves (see `CURATED` in knowledgeGraphScene), `row` indexes
 * MEMORY.interactions for the read-out.
 */
const CURATED_NODES = [
  { index: 0, label: 'React', row: 0 },
  { index: 8, label: 'Campus Placement Portal', row: 1 },
  { index: 14, label: 'Infosys', row: 2 },
] as const;

export default function MemorySection() {
  /** Index into MEMORY.interactions, or null when nothing is inspected. */
  const [inspected, setInspected] = useState<number | null>(null);
  const selectNode = useStageSelection('memory');

  const inspect = (index: number, row: number): void => {
    setInspected(row);
    selectNode(String(index));
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
          {/*
            The width cap is a framing fix, not a layout preference. The node
            cloud projects to roughly 1.8:1 (landscape) under the memory beat
            camera, but an uncapped panel at max-w-7xl hands the slot a
            1166x500 frame — 2.33:1 — so the graph filled ~36% of the width
            against ~47% of the height and read as an island adrift in dead
            space. Narrowing the panel to 960px gives the slot 912x500, 1.82:1,
            which matches the subject instead of boxing it. Capping the panel
            rather than trimming the height keeps the section's vertical
            rhythm, and it only binds above 1024px — every smaller breakpoint
            was already narrower than the cap and is untouched.
          */}
          <div className="landing-panel relative mx-auto w-full max-w-[960px] overflow-hidden rounded-3xl p-4 sm:p-6">
            <div className="relative h-[360px] sm:h-[440px] lg:h-[500px]">
              <StageSlot beat="memory" className="absolute inset-0" />
              {/* selected-node read-out card */}
              {inspected !== null ? (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-80">
                  <div className="rounded-xl border border-border-subtle bg-background/90 p-4 shadow-elevated backdrop-blur-md">
                    <dl className="space-y-2 text-xs leading-relaxed">
                      {(() => {
                        const r = MEMORY.interactions[inspected]!;
                        return (
                          <>
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
                          </>
                        );
                      })()}
                    </dl>
                  </div>
                </div>
              ) : null}

              {/* sr-only narrative so the story never depends on 3D */}
              <p className="sr-only">
                Interactive knowledge graph. Nodes represent people, skills, projects,
                organizations, certificates, and events, connected by typed relationships. The graph
                itself is not directly operable — it has no pointer picking. Use the three Inspect
                buttons below to select a node, which highlights it in the graph and reports its
                relationship, source, and confidence.
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
                    aria-pressed={inspected === c.row}
                    onClick={() => inspect(c.index, c.row)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      inspected === c.row
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
                  <li key={l.type} className="flex items-center gap-1.5 text-xs text-text-muted">
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
