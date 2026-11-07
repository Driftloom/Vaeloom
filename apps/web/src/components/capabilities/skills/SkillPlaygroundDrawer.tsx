'use client';

import React, { useState } from 'react';
import {
  Badge,
  Button,
  FormField,
  MessageIcon,
  MIN_TOUCH_TARGET,
  StatusDot,
  Textarea,
  XIcon,
  ZapIcon,
  useFocusTrap,
} from '@vaeloom/ui-kit';
import { capabilitiesApi } from '@/lib/api-client';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import type { SkillRow } from '../SkillsView';
import { getAgentForSkill } from './SkillIntegrationBar';
import { matchTriggerHits } from './trigger-matcher';

interface SkillPlaygroundDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSkill: SkillRow | null;
  workspaceId?: string;
  onInstall?: (key: string) => void;
}

interface DiagnosticResult {
  status: string;
  latencyMs: number;
  syntaxValid: boolean;
  rulesChecked: number;
  violations: Array<{ rule: string; message: string; line?: number; severity: string }>;
  estimatedTokens: number;
  tokenBudget: number | null;
  withinBudget: boolean | null;
  triggerMatched: boolean;
  triggerDetail: string;
  flaggedMarkers: boolean;
  preview: string;
}

export const SkillPlaygroundDrawer: React.FC<SkillPlaygroundDrawerProps> = ({
  isOpen,
  onClose,
  selectedSkill,
  workspaceId,
  onInstall,
}) => {
  const router = useSafeRouter();
  // Declared aria-modal="true" while trapping nothing, so Tab walked out of the
  // drawer into the page behind it.
  const drawerRef = useFocusTrap(isOpen, onClose);
  const [testPrompt, setTestPrompt] = useState(
    'Please review my resume bullets and check for ATS formatting errors.',
  );
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  if (!isOpen || !selectedSkill) return null;

  const handleLaunchInChat = () => {
    if (!workspaceId) return;
    const query = new URLSearchParams({ prompt: testPrompt });
    const agent = getAgentForSkill(selectedSkill.item.name);
    if (agent) query.set('agent', agent.id);
    query.set('skill', selectedSkill.slug || selectedSkill.item.name);
    router.push(`/workspace/${workspaceId}/chat?${query.toString()}`);
  };

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
        const estimatedTokens =
          typeof (output['estimatedTokens'] ?? output['estimated_tokens']) === 'number'
            ? ((output['estimatedTokens'] ?? output['estimated_tokens']) as number)
            : 0;
        const rawBudget = output['tokenBudget'] ?? output['token_budget'];
        const tokenBudget = typeof rawBudget === 'number' ? rawBudget : null;
        const rawWithin = output['withinBudget'] ?? output['within_budget'];
        const withinBudget =
          tokenBudget === null
            ? null
            : typeof rawWithin === 'boolean'
              ? rawWithin
              : estimatedTokens <= tokenBudget;
        const diag: DiagnosticResult = {
          status: res.status || 'unknown',
          latencyMs: res.latencyMs || Math.round(performance.now() - startMs),
          syntaxValid: (output['syntaxValid'] ?? output['syntax_valid']) !== false,
          rulesChecked:
            typeof (output['rulesChecked'] ?? output['rules_checked']) === 'number'
              ? ((output['rulesChecked'] ?? output['rules_checked']) as number)
              : 8,
          violations: Array.isArray(output['violations'])
            ? (output['violations'] as Array<{
                rule: string;
                message: string;
                line?: number;
                severity: string;
              }>)
            : [],
          estimatedTokens,
          tokenBudget,
          withinBudget,
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
        const matchedTriggers = matchTriggerHits(triggers, testPrompt);
        const isAmbient = triggers.length === 0;
        const matched = matchedTriggers.length > 0 || isAmbient;

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
          // Draft validation is a client-side simulation and the endpoint does
          // not report the runtime directive budget; never invent one here.
          tokenBudget: null,
          withinBudget: null,
          triggerMatched: matched,
          triggerDetail: matched
            ? isAmbient
              ? 'Ambient skill (always active)'
              : `Matched triggers: ${matchedTriggers.join(', ')}`
            : `No declared trigger matched (all words of one phrase must appear): [${triggers.join(', ')}]`,
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

  const tokenPercentage =
    diagnostic && diagnostic.tokenBudget !== null
      ? Math.min(100, Math.round((diagnostic.estimatedTokens / diagnostic.tokenBudget) * 100))
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overscroll-contain">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-label={`Skill Diagnostic Playground: ${selectedSkill.item.name}`}
        aria-modal="true"
        tabIndex={-1}
        className="relative z-10 h-full w-full sm:max-w-md lg:max-w-xl bg-surface border-l border-border shadow-elevation-modal flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <StatusDot status="idle" size="md" pulse />
              <h2 className="text-sm font-semibold text-text truncate">
                Skill Diagnostic Playground
              </h2>
            </div>
            <p className="text-2xs text-text-muted mt-0.5 font-mono truncate">
              {selectedSkill.item.name} &middot; scope: {selectedSkill.item.requiredScope || 'none'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close playground"
            onClick={onClose}
            className={`inline-flex items-center justify-center p-1.5 text-text-muted hover:text-text rounded-control hover:bg-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${MIN_TOUCH_TARGET}`}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 space-y-5">
          {/* Skill Identity Card */}
          <div className="rounded-container border border-border bg-surface-elevated p-3 space-y-2 text-2xs">
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
              hint="Test whether the declared triggers match this prompt and how the skill compiler compiles it."
            >
              {({ id }: { id: string }) => (
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
              className="rounded-card border border-error/40 bg-error/10 p-3 text-xs text-error space-y-1"
            >
              <p className="font-semibold">Diagnostic Execution Error</p>
              <p className="text-2xs text-error/80">{testError}</p>
            </div>
          )}

          {/* Diagnostic Output */}
          {diagnostic && (
            <div className="space-y-4 pt-2" aria-live="polite">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
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
              <div className="rounded-container border border-border bg-surface p-3.5 space-y-2">
                <div className="flex items-center justify-between text-2xs font-mono">
                  <span className="text-text-muted">Token Consumption:</span>
                  {diagnostic.tokenBudget !== null && tokenPercentage !== null ? (
                    <span
                      className={
                        diagnostic.withinBudget === false
                          ? 'text-error'
                          : 'text-primary font-semibold'
                      }
                    >
                      {diagnostic.estimatedTokens} / {diagnostic.tokenBudget} tokens (
                      {tokenPercentage}
                      %)
                    </span>
                  ) : (
                    <span className="text-text-muted">
                      ~{diagnostic.estimatedTokens} tokens estimated
                    </span>
                  )}
                </div>
                {diagnostic.tokenBudget !== null && tokenPercentage !== null && (
                  <div
                    role="progressbar"
                    aria-label="Token consumption"
                    aria-valuemin={0}
                    aria-valuemax={diagnostic.tokenBudget}
                    aria-valuenow={diagnostic.estimatedTokens}
                    aria-valuetext={`${diagnostic.estimatedTokens} of ${diagnostic.tokenBudget} tokens`}
                    className="h-2 w-full bg-surface-hover rounded-pill overflow-hidden border border-border-subtle"
                  >
                    <div
                      className={`h-full transition-all duration-500 rounded-pill ${
                        tokenPercentage <= 60
                          ? 'bg-success'
                          : tokenPercentage <= 90
                            ? 'bg-warning'
                            : 'bg-error'
                      }`}
                      style={{ width: `${tokenPercentage}%` }}
                    />
                  </div>
                )}
                <p className="text-2xs text-text-muted">
                  {diagnostic.tokenBudget !== null
                    ? `Skills are allocated a bounded slice (${diagnostic.tokenBudget} tokens) of the prompt window to protect memory and tool schemas.`
                    : 'Skills are allocated a bounded slice of the prompt window to protect memory and tool schemas.'}
                </p>
              </div>

              {/* Trigger Match Card */}
              <div className="rounded-container border border-border bg-surface p-3.5 space-y-1.5 text-2xs">
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
              <div className="rounded-container border border-border bg-surface p-3.5 space-y-2 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-mono">Document Syntax:</span>
                  <Badge variant={diagnostic.syntaxValid ? 'success' : 'error'} size="sm">
                    {diagnostic.syntaxValid ? 'PASSED' : 'VIOLATIONS FOUND'}
                  </Badge>
                </div>
                <p className="text-text-secondary">
                  {diagnostic.rulesChecked} validation rules checked (## Mission, ## Operating
                  Rules, no unescaped placeholders).
                </p>
                {diagnostic.violations.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-2 border-l border-error/40">
                    {diagnostic.violations.map((v, i) => (
                      <li key={i} className="text-error text-2xs">
                        <span className="font-mono font-semibold">[{v.rule}]</span> {v.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Quarantined Fence Preview */}
              <div className="rounded-container border border-border bg-surface p-3.5 space-y-2 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-mono">Quarantine Isolation:</span>
                  <Badge variant={diagnostic.flaggedMarkers ? 'warning' : 'default'} size="sm">
                    {diagnostic.flaggedMarkers ? 'FLAGGED MARKERS' : 'SECURE FENCE'}
                  </Badge>
                </div>
                <p className="text-text-muted text-2xs">
                  Rendered preview of the quarantined prompt block injected into the reasoning loop:
                </p>
                <pre className="p-2.5 rounded bg-background border border-border-subtle font-mono text-2xs text-text overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                  {diagnostic.preview}
                </pre>
              </div>

              {/* Quick Actions Bar */}
              <div className="p-3 rounded-container border border-border bg-surface-elevated flex items-center justify-between gap-2 flex-wrap">
                {!selectedSkill.installed && onInstall && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onInstall(selectedSkill.key)}
                    className="text-xs gap-1"
                  >
                    <ZapIcon size={12} className="shrink-0" />
                    Install &amp; Activate Skill
                  </Button>
                )}
                {workspaceId && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleLaunchInChat}
                    className="text-xs gap-1"
                  >
                    <MessageIcon size={12} className="shrink-0" />
                    Launch in Live Chat
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
