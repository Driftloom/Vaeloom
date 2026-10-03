'use client';

import React, { useMemo, useState } from 'react';
import { Badge, Button, FormField, Textarea } from '@vaeloom/ui-kit';
import type { SkillRow } from '../SkillsView';

interface TriggerSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows?: SkillRow[];
  installedSkills?: SkillRow[];
  onSelectSkill?: (key: string) => void;
}

export const TriggerSimulatorModal: React.FC<TriggerSimulatorModalProps> = ({
  isOpen,
  onClose,
  rows = [],
  installedSkills: propInstalledSkills,
  onSelectSkill,
}) => {
  const [candidateQuery, setCandidateQuery] = useState(
    'Please review my resume for ATS compliance and help me tailor it.',
  );

  const installedSkills = useMemo(() => {
    if (propInstalledSkills && Array.isArray(propInstalledSkills)) {
      return propInstalledSkills;
    }
    return (rows || []).filter((r) => r && r.installed);
  }, [rows, propInstalledSkills]);

  // Evaluate matching skills using the same containment rule as backend _trigger_state
  const matchResults = useMemo(() => {
    const query = candidateQuery.trim().toLowerCase();
    if (!query) return [];

    return installedSkills.map((row) => {
      const triggers = row.item.triggers || [];
      const matchedTriggers = triggers.filter((t) => {
        const normT = t.trim().toLowerCase();
        return normT && query.includes(normT);
      });

      const isAmbient = triggers.length === 0;
      const isMatched = matchedTriggers.length > 0 || isAmbient;

      return {
        row,
        isMatched,
        matchedTriggers,
        isAmbient,
        enabled: row.item.enabled,
      };
    });
  }, [installedSkills, candidateQuery]);

  const activeMatches = matchResults.filter((m) => m.isMatched && m.enabled);
  const disabledMatches = matchResults.filter((m) => m.isMatched && !m.enabled);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Skill Trigger & Intent Simulator"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-surface shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
              <span>Skill Trigger & Intent Simulator</span>
              <Badge variant="default" size="sm">
                Router
              </Badge>
            </h2>
            <p className="text-2xs text-text-muted mt-0.5">
              Simulate which installed workspace skills will be injected into an agent or chat run.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 space-y-4">
          <FormField
            label="Simulated User Message / Intent"
            hint="Type a real-world user query or prompt to test trigger containment matching."
          >
            {({ id }) => (
              <Textarea
                id={id}
                value={candidateQuery}
                onChange={(e) => setCandidateQuery(e.target.value)}
                rows={3}
                className="font-mono text-xs leading-relaxed resize-y"
                placeholder="e.g. Audit my resume bullets for ATS keywords..."
              />
            )}
          </FormField>

          {/* Quick Pre-set Prompts */}
          <div className="flex items-center gap-1.5 flex-wrap text-2xs text-text-muted">
            <span className="font-mono">Quick test:</span>
            {[
              'Audit my resume for ATS',
              'Check accessibility WCAG AA',
              'Help me with career pathing',
              'Find jobs in San Francisco',
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCandidateQuery(preset)}
                className="px-2 py-0.5 rounded bg-surface-hover hover:bg-primary/10 hover:text-primary border border-border text-2xs transition-colors font-mono"
              >
                &ldquo;{preset}&rdquo;
              </button>
            ))}
          </div>

          {/* Results Summary */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-border/50 text-2xs font-mono">
              <span className="text-text-muted">Active Injections:</span>
              <span className="text-primary font-bold">
                {activeMatches.length} skills will fire
              </span>
            </div>

            {/* List of matched active skills */}
            {activeMatches.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted italic bg-surface-hover/30 rounded-xl my-2">
                No active skills matched this prompt.
              </div>
            ) : (
              <ul className="divide-y divide-border/50 my-2">
                {activeMatches.map(({ row, matchedTriggers, isAmbient }) => (
                  <li
                    key={row.key}
                    className="py-2.5 flex items-start justify-between gap-3 hover:bg-surface-hover/50 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="font-semibold text-xs text-text">{row.item.name}</span>
                        <Badge variant="success" size="sm">
                          {isAmbient ? 'Ambient' : 'Trigger Hit'}
                        </Badge>
                      </div>
                      <p className="text-2xs text-text-muted mt-0.5 truncate max-w-md">
                        {row.item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-2xs font-mono text-primary">
                        {isAmbient ? (
                          <span className="text-text-muted italic">Always-on (no triggers)</span>
                        ) : (
                          <span>Matched triggers: &ldquo;{matchedTriggers.join(', ')}&rdquo;</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onSelectSkill?.(row.key);
                        onClose();
                      }}
                    >
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* List of matched disabled skills */}
            {disabledMatches.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <span className="text-2xs font-mono text-warning">
                  Matched but Disabled ({disabledMatches.length}):
                </span>
                <ul className="divide-y divide-border/50 mt-1">
                  {disabledMatches.map(({ row, matchedTriggers }) => (
                    <li
                      key={row.key}
                      className="py-2 flex items-center justify-between text-2xs text-text-muted px-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                        <span>{row.item.name}</span>
                        <Badge variant="warning" size="sm">
                          Disabled
                        </Badge>
                      </div>
                      <span className="font-mono text-2xs">
                        Matched: {matchedTriggers.join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-surface-hover border-t border-border shrink-0 flex items-center justify-between text-2xs text-text-muted font-mono">
          <span>Simulation evaluates whitespace-collapsed substring containment.</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
