'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { councilApi, type CouncilVerdict, type CouncilCritique } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

type VerdictKey = 'SHIP' | 'REVISE' | 'HOLD';

/**
 * One source of truth for the council colour scheme.
 *
 * `getVerdictBadge` and the per-critique stance text previously duplicated the
 * same three-swatch palette with different raw values, so the banner and the
 * transcript could disagree about what "good" looks like. Both now read from
 * this map.
 */
const VERDICT_TOKENS: Record<VerdictKey, { chip: string; text: string; label: string }> = {
  SHIP: {
    chip: 'bg-ai-verified/10 text-ai-verified border-ai-verified/30',
    text: 'text-ai-verified',
    label: 'SHIP (Passed)',
  },
  REVISE: {
    chip: 'bg-ai-needs-review/10 text-ai-needs-review border-ai-needs-review/30',
    text: 'text-ai-needs-review',
    label: 'REVISE (Conditional)',
  },
  HOLD: {
    chip: 'bg-ai-blocked/10 text-ai-blocked border-ai-blocked/30',
    text: 'text-ai-blocked',
    label: 'HOLD (Vetoed)',
  },
};

const STANCE_TOKENS: Record<string, string> = {
  PASS: VERDICT_TOKENS.SHIP.text,
  CONCERN: VERDICT_TOKENS.REVISE.text,
  BLOCK: VERDICT_TOKENS.HOLD.text,
};

const VERDICT_ICON: Record<VerdictKey, string> = {
  SHIP: 'M5 13l4 4L19 7',
  REVISE:
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  HOLD: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
};

const SYNTHETIC_BANNER =
  '[SYNTHETIC PLACEHOLDER — every figure below is invented for UI testing. ' +
  "This is not a record of anyone's experience and must not be submitted for certification.]";

/**
 * Demonstration text only. The claims are fabricated, so they carry a synthetic
 * marker in their own first line: the council mints a signed audit credential
 * from whatever it is given, and a user one click away from "Certify W3C" should
 * not be able to pass invented metrics off as attested fact.
 */
const SAMPLE_ARTIFACTS: Record<string, string> = {
  resume: `${SYNTHETIC_BANNER}
Synthetic Resume — Senior Staff Distributed Systems Engineer (illustrative)
- Architected a sub-50ms multi-agent orchestration runtime handling 10M+ daily agent actions with 99.99% availability.
- Designed zero-trust Row-Level Security (RLS) and cryptographic HMAC verification layers across PostgreSQL and vector stores.
- Mentored 12 staff engineers and drove cross-functional alignment on enterprise AI compliance.`,
  proposal: `${SYNTHETIC_BANNER}
Synthetic Proposal: Enterprise Multi-Agent Governance Platform (illustrative)
We propose introducing a Dual-Brain architecture combining sub-50ms typed routing (System 1) with arbitrary BYOK generative LLMs (System 2).
Expected ROI: 75% reduction in API token spend, deterministic human-in-the-loop safety guarantees, and SOC2 compliance out of the box.`,
};

export default function CouncilPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();

  const [artifact, setArtifact] = useState<string>('');
  const [artifactType, setArtifactType] = useState<string>('resume');
  const [mode, setMode] = useState<'collaborative' | 'adversarial'>('collaborative');
  const [isDeliberating, setIsDeliberating] = useState<boolean>(false);
  const [isCertifying, setIsCertifying] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<CouncilVerdict | null>(null);
  const [certification, setCertification] = useState<Record<string, unknown> | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [certifyError, setCertifyError] = useState<string | null>(null);

  const handleReview = async () => {
    if (!artifact.trim()) {
      toast({
        tone: 'error',
        title: 'Empty Artifact',
        detail: 'Please enter or paste artifact text to review.',
      });
      return;
    }

    setIsDeliberating(true);
    setVerdict(null);
    setCertification(null);
    setReviewError(null);
    setCertifyError(null);

    try {
      const res = await councilApi.review({
        artifact,
        artifactType,
        mode,
        context: { workspaceId },
      });
      setVerdict(res);
      toast({
        tone: 'success',
        title: 'Deliberation Complete',
        detail: `Council returned verdict: ${res.verdict} (${res.overallScore}/100)`,
      });
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Unable to complete council deliberation.';
      setReviewError(detail);
      toast({ tone: 'error', title: 'Review Failed', detail });
    } finally {
      setIsDeliberating(false);
    }
  };

  const handleCertify = async () => {
    if (!workspaceId || !artifact.trim()) return;

    setIsCertifying(true);
    setCertifyError(null);
    try {
      // `agent_name` and `execution_id` are required by POST
      // /council/evaluate-and-certify and the server derives neither, so the
      // browser must supply something. Sending "AgentCouncil" and
      // `exec-${Date.now()}` made the credential attest to an identity and an
      // execution the client invented. These values say plainly where they came
      // from instead of impersonating a server-side agent run.
      //
      // `toolsInvoked` is deliberately omitted: the council service did not
      // report which tools it ran, so any list here would be client-asserted
      // provenance baked into a signed credential. The API defaults it to [].
      const res = await councilApi.certify({
        workspaceId,
        agentName: 'client-asserted:council-ui',
        executionId: `client-asserted:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`}`,
        artifact,
        artifactType,
        mode,
      });
      setCertification(res);
      toast({
        tone: 'success',
        title: 'Credential Issued',
        detail: 'W3C Verifiable AgentAuditCredential minted successfully.',
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Failed to issue audit credential.';
      setCertifyError(detail);
      toast({ tone: 'error', title: 'Certification Failed', detail });
    } finally {
      setIsCertifying(false);
    }
  };

  const verdictKey = (verdict?.verdict ?? 'HOLD') as VerdictKey;
  const verdictToken = VERDICT_TOKENS[verdictKey] ?? VERDICT_TOKENS.HOLD;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Multi-Agent Adjudication"
        title="PIOS 5-Agent Council"
        description="Autonomous multi-agent adjudication protocol evaluating quality, voice, evidence, skepticism, and strategy."
        actions={
          <>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
              Workspace: {workspaceId?.slice(0, 8) ?? 'Default'}
            </span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Zero-Trust Adjudication
            </span>
          </>
        }
      />

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label
                htmlFor="council-artifact"
                className="text-sm font-semibold text-foreground flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                Artifact Content for Deliberation
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setArtifact(SAMPLE_ARTIFACTS['resume'] ?? '')}
                  className="btn-secondary text-xs"
                >
                  Load Synthetic Resume Example
                </button>
                <button
                  type="button"
                  onClick={() => setArtifact(SAMPLE_ARTIFACTS['proposal'] ?? '')}
                  className="btn-secondary text-xs"
                >
                  Load Synthetic Proposal Example
                </button>
              </div>
            </div>
            <p className="text-xs text-ai-needs-review">
              The example loaders insert <strong>synthetic placeholder text</strong> with invented
              metrics so the council can be exercised. Replace it with your own artifact before
              certifying.
            </p>

            <textarea
              id="council-artifact"
              value={artifact}
              onChange={(e) => setArtifact(e.target.value)}
              placeholder="Paste artifact markdown, resume bullet points, job application text, or proposal here..."
              rows={8}
              className="w-full rounded-lg bg-background border border-border p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono"
            />

            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <label htmlFor="council-artifact-type">Type:</label>
                  <select
                    id="council-artifact-type"
                    value={artifactType}
                    onChange={(e) => setArtifactType(e.target.value)}
                    className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                  >
                    <option value="resume">Resume</option>
                    <option value="cover_letter">Cover Letter</option>
                    <option value="proposal">Strategic Proposal</option>
                    <option value="code">Code / Architecture</option>
                    <option value="text">General Prose</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <label htmlFor="council-mode">Mode:</label>
                  <select
                    id="council-mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'collaborative' | 'adversarial')}
                    className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                  >
                    <option value="collaborative">Collaborative</option>
                    <option value="adversarial">Adversarial (Red Team)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isDeliberating || !artifact.trim()}
                  onClick={handleReview}
                  className="btn-primary"
                >
                  {isDeliberating ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"
                      />
                      Deliberating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Deliberate
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isCertifying || !artifact.trim()}
                  onClick={handleCertify}
                  className="btn-secondary"
                >
                  {isCertifying ? (
                    <span
                      aria-hidden="true"
                      className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin"
                    />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                  )}
                  Certify W3C
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Overview Sidebar */}
        <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Council Architecture
          </h2>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <span className="font-semibold text-foreground">Skeptic</span>: Identifies inflated
              claims, lack of attribution, and weak metrics.
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <span className="font-semibold text-foreground">Voice</span>: Evaluates clarity,
              executive presence, and authentic delivery.
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <span className="font-semibold text-foreground">Evidence</span>: Verifies factual
              plausibility and technical rigor.
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <span className="font-semibold text-foreground">Strategy</span>: Analyzes alignment
              with target positioning and audience goals.
            </div>
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border/60">
              <span className="font-semibold text-foreground">Adjudicator</span>: Synthesizes
              independent scores into a final binding verdict.
            </div>
          </div>
        </div>
      </div>

      {reviewError && (
        <ErrorState
          title="Deliberation failed"
          message={`${reviewError} No verdict was produced, so nothing below is a council result.`}
          onRetry={() => void handleReview()}
        />
      )}

      {certifyError && (
        <ErrorState
          title="Certification failed"
          message={`${certifyError} No credential was issued and no verdict was recorded on-chain.`}
        />
      )}

      {isDeliberating && <LoadingSpinner text="Council is deliberating…" />}

      {/* Deliberation Verdict & Opinions */}
      {verdict && !isDeliberating && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${verdictToken.chip}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={VERDICT_ICON[verdictKey] ?? VERDICT_ICON.HOLD}
                    />
                  </svg>
                  {verdictToken.label}
                </span>
                <span className="text-lg font-bold text-foreground">
                  Consensus Score: {verdict.overallScore}/100
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Timestamp: {new Date(verdict.timestamp).toLocaleTimeString()}</span>
                <span>Mode: {mode}</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Adjudication Summary</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{verdict.summary}</p>
            </div>

            {verdict.revisionBrief && verdict.revisionBrief.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Required Revisions Before Release
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                  {verdict.revisionBrief.map((rev, idx) => (
                    <li key={idx}>{rev}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Individual Deliberations */}
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                />
              </svg>
              Individual Deliberation Transcripts
            </h2>
            {Object.keys(verdict.round1Critiques || {}).length === 0 ? (
              <EmptyState
                title="No individual critiques returned"
                description="The council produced a verdict but reported no per-role transcripts, so no role-level reasoning is shown."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(verdict.round1Critiques || {}).map(
                  ([key, critique]: [string, CouncilCritique]) => (
                    <div
                      key={key}
                      className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 mb-2">
                          <div>
                            <h3 className="font-semibold text-sm text-foreground capitalize">
                              {critique.role || key}
                            </h3>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xs font-bold ${
                                STANCE_TOKENS[critique.stance] ?? VERDICT_TOKENS.HOLD.text
                              }`}
                            >
                              {critique.stance}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {critique.confidence}% conf
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                          {critique.analysis}
                        </p>
                      </div>

                      {critique.reducibleFlaws && critique.reducibleFlaws.length > 0 && (
                        <div className="pt-2 border-t border-border/30">
                          <span className="text-xs font-semibold text-foreground uppercase">
                            Fixable Items:
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-xs text-muted-foreground mt-1">
                            {critique.reducibleFlaws.slice(0, 2).map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Certification Result */}
      {certification && (
        <div className="bg-card rounded-xl border border-ai-verified/30 bg-ai-verified/5 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-ai-verified font-semibold text-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            W3C AgentAuditCredential Issued
          </div>
          <p className="text-xs text-text-muted">
            Provenance limits: the agent name and execution id in this credential were supplied by
            this browser session, not derived by the server, and no tool-invocation list is attested
            because the council service did not report one.
          </p>
          <pre className="text-xs font-mono bg-background p-3 rounded-lg border border-border overflow-x-auto text-muted-foreground max-h-60">
            {JSON.stringify(certification, null, 2)}
          </pre>
        </div>
      )}

      {!verdict && !certification && !isDeliberating && !reviewError && !certifyError && (
        <EmptyState
          title="No deliberation yet"
          description="Paste an artifact above and run Deliberate to get a council verdict, per-role critiques, and — on a SHIP verdict — a signed W3C audit credential."
        />
      )}
    </div>
  );
}
