'use client';

import React, { useMemo, useState } from 'react';
import { Badge, Button, FormField, Modal, StatusDot, Textarea } from '@vaeloom/ui-kit';
import type { SkillRow } from '../SkillsView';
import { matchTriggerHits } from './trigger-matcher';

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

  // Evaluate matching skills with the shared token-set matcher, mirroring
  // backend `_trigger_hits`: every word of a declared phrase must appear
  // somewhere in the message; order and adjacency do not matter.
  const matchResults = useMemo(() => {
    if (!candidateQuery.trim()) return [];

    return installedSkills.map((row) => {
      const triggers = row.item.triggers || [];
      const matchedTriggers = matchTriggerHits(triggers, candidateQuery);

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Skill Trigger & Intent Simulator" size="xl">
      <div className="space-y-4">
        <div className="flex items-center gap-2 -mt-1">
          <Badge variant="default" size="sm">
            Router
          </Badge>
          <p className="text-2xs text-text-muted">
            Simulate which installed workspace skills will be injected into an agent or chat run.
          </p>
        </div>

        <FormField
          label="Simulated User Message / Intent"
          hint="Type a real-world user query or prompt to see which skills' triggers match it."
        >
          {({ id }: { id: string }) => (
            <Textarea
              id={id}
              value={candidateQuery}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setCandidateQuery(e.target.value)
              }
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
              className="px-2 py-0.5 rounded bg-surface-hover hover:bg-primary/10 hover:text-primary border border-border text-2xs transition-colors font-mono cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              &ldquo;{preset}&rdquo;
            </button>
          ))}
        </div>

        {/* Results Summary */}
        <div className="pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-2xs font-mono">
            <span className="text-text-muted">Active Injections:</span>
            <span className="text-primary font-bold">{activeMatches.length} skills will fire</span>
          </div>

          {/* List of matched active skills */}
          {activeMatches.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-muted italic bg-surface-elevated rounded-container my-2">
              {installedSkills.length === 0
                ? 'No installed skills to simulate. Install a skill first to see it activate.'
                : 'No active skills matched this prompt.'}
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle my-2">
              {activeMatches.map(({ row, matchedTriggers, isAmbient }) => (
                <li
                  key={row.key}
                  className="py-2.5 flex items-start justify-between gap-3 hover:bg-surface-hover px-2 rounded-card transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status="active" size="sm" />
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
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <span className="text-2xs font-mono text-warning">
                Matched but Disabled ({disabledMatches.length}):
              </span>
              <ul className="divide-y divide-border-subtle mt-1">
                {disabledMatches.map(({ row, matchedTriggers }) => (
                  <li
                    key={row.key}
                    className="py-2 flex items-center justify-between text-2xs text-text-muted px-2"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status="warning" size="sm" />
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

        <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-3 text-2xs text-text-muted font-mono">
          <span>
            Simulation uses token-set matching: every word of a declared trigger must appear
            somewhere in the message, in any order.
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
