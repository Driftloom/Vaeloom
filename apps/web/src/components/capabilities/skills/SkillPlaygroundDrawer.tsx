'use client';

import React, { useState } from 'react';
import {
  Badge,
  Button,
  FormField,
  IconButton,
  Spinner,
  StatusDot,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import { capabilitiesApi } from '@/lib/api-client';
import type { SkillRow } from '../SkillsView';

interface SkillPlaygroundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSkill: SkillRow | null;
}

interface DiagnosticResult {
  status: string;
  latencyMs: number;
  syntaxValid: boolean;
  rulesChecked: number;
  violations: Array<{ rule: string; message: string; line?: number; severity: string }>;
  estimatedTokens: number;
  tokenBudget: number;
  withinBudget: boolean;
  triggerMatched: boolean;
  triggerDetail: string;
  flaggedMarkers: boolean;
  preview: string;
}

export const SkillPlaygroundDrawer: React.FC<SkillPlaygroundDrawerProps> = ({
  isOpen,
  onClose,
  selectedSkill,
}) => {
  const [testPrompt, setTestPrompt] = useState(
    'Please review my resume bullets and check for ATS formatting errors.',
  );
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  if (!isOpen || !selectedSkill) return null;

  const handleRunDiagnostic = async () => {
    setIsRunning(true);
    setTestError(null);
    const startMs = performance.now();
    try {
      if (selectedSkill.serverBacked) {
        const res = await capabilitiesApi.testCapability(selectedSkill.key, {
          sample_message: testPrompt,
          message: testPrompt,
        });

        const output = (res.output as Record<string, unknown>) || {};
        const diag: DiagnosticResult = {
          status: res.status || 'unknown',
          latencyMs: res.latencyMs || Math.round(performance.now() - startMs),
          syntaxValid: (output['syntaxValid'] ?? output['syntax_valid']) !== false,
          rulesChecked:
            typeof (output['rulesChecked'] ?? output['rules_checked']) === 'number'
              ? ((output['rulesChecked'] ?? output['rules_checked']) as number)
              : 8,
          violations: Array.isArray(output['violations'])
            ? (output['violations'] as DiagnosticResult['violations'])
            : [],
          estimatedTokens:
            typeof (output['estimatedTokens'] ?? output['estimated_tokens']) === 'number'
              ? ((output['estimatedTokens'] ?? output['estimated_tokens']) as number)
              : 0,
          tokenBudget:
            typeof (output['tokenBudget'] ?? output['token_budget']) === 'number'
              ? ((output['tokenBudget'] ?? output['token_budget']) as number)
              : 1500,
          withinBudget: (output['withinBudget'] ?? output['within_budget']) !== false,
          triggerMatched: (output['triggerMatched'] ?? output['trigger_matched']) === true,
          triggerDetail: String(output['triggerDetail'] ?? output['trigger_detail'] ?? ''),
          flaggedMarkers: (output['flaggedMarkers'] ?? output['flagged_markers']) === true,
          preview: String(output['preview'] ?? ''),
        };
        setDiagnostic(diag);
      } else {
        // For catalog/uninstalled skills, run draft validation and client-side trigger simulation
        const valRes = await capabilitiesApi.validateDraft({
          name: selectedSkill.item.name,
          category: 'skill',
          description: selectedSkill.item.description,
          config: {
            markdown_doc: selectedSkill.item.markdownDoc,
            required_scope: selectedSkill.item.requiredScope,
            tags: selectedSkill.item.tags,
            triggers: selectedSkill.item.triggers,
          },
        });

        const doc = selectedSkill.item.markdownDoc || '';
        const approxTokens = Math.ceil(doc.length / 4);
        const triggers = selectedSkill.item.triggers || [];
        const normMsg = testPrompt.toLowerCase().replace(/\s+/g, ' ');
        const matched =
          triggers.length === 0 || triggers.some((t) => normMsg.includes(t.toLowerCase()));

        setDiagnostic({
          status: valRes.status || 'success',
          latencyMs: Math.round(performance.now() - startMs),
          syntaxValid: valRes.status === 'success',
          rulesChecked: valRes.rulesChecked || 8,
          violations: (valRes.violations || []).map((v) => ({
            rule: v.rule,
            message: v.message,
            line: v.line ?? undefined,
            severity: v.severity,
          })),
          estimatedTokens: approxTokens,
          tokenBudget: 1500,
          withinBudget: approxTokens <= 1500,
          triggerMatched: matched,
          triggerDetail: matched
            ? triggers.length === 0
              ? 'Ambient skill (always active)'
              : 'Matched trigger phrase in prompt'
            : `Prompt did not contain any required trigger: [${triggers.join(', ')}]`,
          flaggedMarkers: false,
          preview: doc.slice(0, 300) + (doc.length > 300 ? '...' : ''),
        });
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Diagnostic execution failed');
      setDiagnostic(null);
    } finally {
      setIsRunning(false);
    }
  };

  const tokenPercentage = diagnostic
    ? Math.min(100, Math.round((diagnostic.estimatedTokens / diagnostic.tokenBudget) * 100))
    : 0;

  return (
    <div
      role="dialog"
      aria-label={`Skill Diagnostic Playground: ${selectedSkill.item.name}`}
      aria-modal="true"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[560px] bg-surface border-l border-border shadow-2xl flex flex-col focus:outline-none"
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
        <div className="min-w-0 pr-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-semibold text-text truncate">
              Skill Diagnostic Playground
            </h2>
          </div>
          <p className="text-2xs text-text-muted mt-0.5 font-mono truncate">
            {selectedSkill.item.name} &middot; scope: {selectedSkill.item.requiredScope || 'none'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close playground">
          Close
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 space-y-5">
        {/* Skill Identity Card */}
        <div className="rounded-xl border border-border bg-surface-hover/40 p-3 space-y-2 text-2xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">{selectedSkill.item.name}</span>
            <div className="flex items-center gap-1.5">
              <Badge variant={selectedSkill.installed ? 'success' : 'default'} size="sm">
                {selectedSkill.installed ? 'Installed' : 'Catalog'}
              </Badge>
              <Badge variant="info" size="sm">
                {selectedSkill.item.trustClass || 'community'}
              </Badge>
            </div>
          </div>
          <p className="text-text-secondary text-2xs leading-relaxed">
            {selectedSkill.item.description || 'No description provided.'}
          </p>
          <div className="pt-1 flex items-center gap-2 text-text-muted font-mono">
            <span>Triggers:</span>
            {selectedSkill.item.triggers && selectedSkill.item.triggers.length > 0 ? (
              <span className="text-primary truncate">
                {selectedSkill.item.triggers.join(', ')}
              </span>
            ) : (
              <span className="italic text-text-muted">Ambient / Always-on</span>
            )}
          </div>
        </div>

        {/* Input Form */}
        <div className="space-y-3">
          <FormField
            label="Simulated User Message / Intent"
            hint="Test if this prompt satisfies trigger containment and how the skill compiler compiles it."
          >
            {({ id }) => (
              <Textarea
                id={id}
                value={testPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setTestPrompt(e.target.value)
                }
                rows={4}
                className="font-mono text-xs leading-relaxed resize-y"
                placeholder="Enter a prompt to simulate agent execution..."
              />
            )}
          </FormField>

          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center"
            loading={isRunning}
            onClick={handleRunDiagnostic}
          >
            {isRunning ? 'Running Diagnostic...' : 'Execute Diagnostic Test'}
          </Button>
        </div>

        {/* Error alert */}
        {testError && (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger space-y-1"
          >
            <p className="font-semibold">Diagnostic Execution Error</p>
            <p className="text-2xs text-danger/80">{testError}</p>
          </div>
        )}

        {/* Diagnostic Output */}
        {diagnostic && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Diagnostic Telemetry
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono text-text-muted">
                  {diagnostic.latencyMs} ms
                </span>
                <Badge
                  variant={
                    diagnostic.status === 'success'
                      ? 'success'
                      : diagnostic.status === 'warning'
                        ? 'warning'
                        : 'error'
                  }
                  size="sm"
                >
                  {diagnostic.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Token Budget Gauge */}
            <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2">
              <div className="flex items-center justify-between text-2xs font-mono">
                <span className="text-text-muted">Token Consumption:</span>
                <span
                  className={diagnostic.withinBudget ? 'text-primary font-semibold' : 'text-danger'}
                >
                  {diagnostic.estimatedTokens} / {diagnostic.tokenBudget} tokens ({tokenPercentage}
                  %)
                </span>
              </div>
              <div className="h-2 w-full bg-surface-hover rounded-full overflow-hidden border border-border/50">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    diagnostic.withinBudget ? 'bg-primary' : 'bg-danger'
                  }`}
                  style={{ width: `${tokenPercentage}%` }}
                />
              </div>
              <p className="text-2xs text-text-muted">
                Skills are allocated a bounded slice (1,500 tokens) of the prompt window to protect
                memory and tool schemas.
              </p>
            </div>

            {/* Trigger Match Card */}
            <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5 text-2xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-mono">Trigger Matching:</span>
                <Badge variant={diagnostic.triggerMatched ? 'success' : 'default'} size="sm">
                  {diagnostic.triggerMatched ? 'TRIGGER FIRED' : 'NOT MATCHED'}
                </Badge>
              </div>
              <p className="text-text-secondary text-2xs font-mono">
                {diagnostic.triggerDetail ||
                  (diagnostic.triggerMatched
                    ? 'Prompt satisfied skill trigger patterns.'
                    : 'Prompt did not trigger this skill.')}
              </p>
            </div>

            {/* Syntax Rules Validation */}
            <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2 text-2xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-mono">Document Syntax:</span>
                <Badge variant={diagnostic.syntaxValid ? 'success' : 'error'} size="sm">
                  {diagnostic.syntaxValid ? 'PASSED' : 'VIOLATIONS FOUND'}
                </Badge>
              </div>
              <p className="text-text-secondary">
                {diagnostic.rulesChecked} validation rules checked (## Mission, ## Operating Rules,
                no unescaped placeholders).
              </p>
              {diagnostic.violations.length > 0 && (
                <ul className="mt-2 space-y-1 pl-2 border-l border-danger/40">
                  {diagnostic.violations.map((v, i) => (
                    <li key={i} className="text-danger text-2xs">
                      <span className="font-mono font-semibold">[{v.rule}]</span> {v.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quarantined Fence Preview */}
            <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2 text-2xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-mono">Quarantine Isolation:</span>
                <Badge variant={diagnostic.flaggedMarkers ? 'warning' : 'default'} size="sm">
                  {diagnostic.flaggedMarkers ? 'FLAGGED MARKERS' : 'SECURE FENCE'}
                </Badge>
              </div>
              <p className="text-text-muted text-2xs">
                Rendered preview of the quarantined prompt block injected into the reasoning loop:
              </p>
              <pre className="p-2.5 rounded bg-background border border-border/60 font-mono text-2xs text-text overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                {diagnostic.preview}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
