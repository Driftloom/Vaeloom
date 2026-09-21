'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { councilApi, type CouncilVerdict, type CouncilCritique } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

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

  const sampleArtifacts: Record<string, string> = {
    resume: `Senior Staff Distributed Systems Engineer
- Architected sub-50ms multi-agent orchestration runtime handling 10M+ daily agent actions with 99.99% availability.
- Designed zero-trust Row-Level Security (RLS) and cryptographic HMAC verification layers across PostgreSQL and vector stores.
- Mentored 12 staff engineers and drove cross-functional alignment on enterprise AI compliance.`,
    proposal: `Proposal: Enterprise Multi-Agent Governance Platform
We propose introducing a Dual-Brain architecture combining sub-50ms typed routing (System 1) with arbitrary BYOK generative LLMs (System 2).
Expected ROI: 75% reduction in API token spend, deterministic human-in-the-loop safety guarantees, and SOC2 compliance out of the box.`,
  };

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
      toast({
        tone: 'error',
        title: 'Review Failed',
        detail: err instanceof Error ? err.message : 'Unable to complete council deliberation.',
      });
    } finally {
      setIsDeliberating(false);
    }
  };

  const handleCertify = async () => {
    if (!workspaceId || !artifact.trim()) return;

    setIsCertifying(true);
    try {
      const res = await councilApi.certify({
        workspaceId,
        agentName: 'AgentCouncil',
        executionId: `exec-${Date.now()}`,
        artifact,
        artifactType,
        mode,
        toolsInvoked: ['council.evaluate', 'council.certify'],
      });
      setCertification(res);
      toast({
        tone: 'success',
        title: 'Credential Issued',
        detail: 'W3C Verifiable AgentAuditCredential minted successfully.',
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Certification Failed',
        detail: err instanceof Error ? err.message : 'Failed to issue audit credential.',
      });
    } finally {
      setIsCertifying(false);
    }
  };

  const getVerdictBadge = (v: 'SHIP' | 'REVISE' | 'HOLD') => {
    switch (v) {
      case 'SHIP':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            SHIP (Passed)
          </span>
        );
      case 'REVISE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            REVISE (Conditional)
          </span>
        );
      case 'HOLD':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            HOLD (Vetoed)
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                PIOS 5-Agent Council
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Autonomous multi-agent adjudication protocol evaluating quality, voice, evidence,
                skepticism, and strategy.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border">
            Workspace: {workspaceId?.slice(0, 8) ?? 'Default'}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Zero-Trust Adjudication
          </span>
        </div>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
                  onClick={() => setArtifact(sampleArtifacts['resume'] ?? '')}
                  className="text-xs px-2.5 py-1 rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors"
                >
                  Load Resume Sample
                </button>
                <button
                  type="button"
                  onClick={() => setArtifact(sampleArtifacts['proposal'] ?? '')}
                  className="text-xs px-2.5 py-1 rounded bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors"
                >
                  Load Proposal Sample
                </button>
              </div>
            </div>

            <textarea
              value={artifact}
              onChange={(e) => setArtifact(e.target.value)}
              placeholder="Paste artifact markdown, resume bullet points, job application text, or proposal here..."
              rows={8}
              className="w-full rounded-lg bg-background border border-border p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono"
            />

            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Type:</span>
                  <select
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
                  <span>Mode:</span>
                  <select
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isDeliberating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Deliberating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors border border-border"
                >
                  {isCertifying ? (
                    <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Deliberation Verdict & Opinions */}
      {verdict && (
        <div className="space-y-6">
          {/* Verdict Banner */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div className="flex items-center gap-3">
                {getVerdictBadge(verdict.verdict)}
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
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
                            className={`text-xs font-bold ${critique.stance === 'PASS' ? 'text-emerald-400' : critique.stance === 'CONCERN' ? 'text-amber-400' : 'text-rose-400'}`}
                          >
                            {critique.stance}
                          </span>
                          <div className="text-[10px] text-muted-foreground">
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
                        <span className="text-[10px] font-semibold text-foreground uppercase">
                          Fixable Items:
                        </span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground mt-1">
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
          </div>
        </div>
      )}

      {/* Certification Result */}
      {certification && (
        <div className="bg-card rounded-xl border border-emerald-500/30 p-5 shadow-sm space-y-3 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
            W3C AgentAuditCredential Issued
          </div>
          <pre className="text-xs font-mono bg-background p-3 rounded-lg border border-border overflow-x-auto text-muted-foreground max-h-60">
            {JSON.stringify(certification, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
