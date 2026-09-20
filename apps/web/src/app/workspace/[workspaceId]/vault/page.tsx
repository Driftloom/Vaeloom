'use client';

import React, { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { api } from '../../../../lib/api';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/Toast';

export default function SovereignVaultPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'credentials' | 'issue' | 'verify' | 'sync'>(
    'credentials',
  );
  const [selectedCred, setSelectedCred] = useState<Record<string, unknown> | null>(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [didModalOpen, setDidModalOpen] = useState(false);

  // Issue capability form state
  const [capabilityTag, setCapabilityTag] = useState('');
  const [validationTier, setValidationTier] = useState('V3');
  const [evidenceInput, setEvidenceInput] = useState('');
  const [issuing, setIssuing] = useState(false);

  // Verify form state
  const [verifyJsonInput, setVerifyJsonInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    issuer: string;
    subject: string;
    credentialType: string;
    claimsVerified: boolean;
    signatureVerified: boolean;
    reason?: string | null;
    checkedAt: string;
  } | null>(null);

  // SWR: Sovereign Identity
  const {
    data: identity,
    error: identityError,
    isLoading: identityLoading,
  } = useSWR(workspaceId ? `identity-${workspaceId}` : null, () => api.sovereignty.getIdentity());

  // SWR: Credentials list
  const {
    data: credsData,
    error: credsError,
    isLoading: credsLoading,
    mutate: mutateCreds,
  } = useSWR(workspaceId ? `credentials-${workspaceId}` : null, () =>
    api.sovereignty.listCredentials(workspaceId!),
  );

  // SWR: Local-First CRDT deltas
  const {
    data: syncData,
    isLoading: syncLoading,
    mutate: mutateSync,
  } = useSWR(workspaceId && activeTab === 'sync' ? `sync-${workspaceId}` : null, () =>
    api.sovereignty.pullSyncDeltas(workspaceId!),
  );

  const copyToClipboard = useCallback(
    (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: `Copied ${label} to clipboard` });
    },
    [toast],
  );

  const handleIssueCapability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !capabilityTag.trim()) return;

    setIssuing(true);
    try {
      const evidence = evidenceInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const issued = await api.sovereignty.issueCapability({
        workspace_id: workspaceId,
        capability_tag: capabilityTag.trim(),
        validation_tier: validationTier,
        evidence,
      });

      toast({ tone: 'success', title: 'Capability Credential Issued & Signed' });
      setCapabilityTag('');
      setEvidenceInput('');
      await mutateCreds();
      setSelectedCred(issued);
      setInspectModalOpen(true);
      setActiveTab('credentials');
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Issuance Failed',
        detail: err instanceof Error ? err.message : 'Check inputs and try again.',
      });
    } finally {
      setIssuing(false);
    }
  };

  const handleInspect = async (credId: string) => {
    if (!workspaceId) return;
    try {
      const doc = await api.sovereignty.getCredential(workspaceId, credId);
      setSelectedCred(doc);
      setInspectModalOpen(true);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to fetch credential',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleVerify = async () => {
    if (!verifyJsonInput.trim()) return;
    setVerifying(true);
    setVerificationResult(null);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(verifyJsonInput);
      } catch {
        toast({ tone: 'error', title: 'Invalid JSON', detail: 'Could not parse credential JSON' });
        setVerifying(false);
        return;
      }

      const res = await api.sovereignty.verifyCredential(parsed);
      setVerificationResult(res);
      if (res.isValid) {
        toast({ tone: 'success', title: 'Cryptographic Proof Verified!' });
      } else {
        toast({
          tone: 'error',
          title: 'Verification Failed',
          detail: res.reason || 'Invalid signature',
        });
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Verification Request Failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setVerifying(false);
    }
  };

  const loadSampleForVerification = () => {
    const firstCred = credsData?.credentials?.[0];
    if (firstCred) {
      handleInspect(firstCred.id);
    } else if (identity) {
      const sample = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1',
          'https://vaeloom.app/credentials/v1',
        ],
        id: 'urn:uuid:sample-id',
        type: ['VerifiableCredential', 'CapabilityCredential'],
        issuer: { id: identity.did },
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: identity.did,
          capabilityTag: 'capability:backend.python@v3',
          validationTier: 'V3',
          evidence: ['Unit test verified'],
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date().toISOString(),
          verificationMethod: `${identity.did}#key-1`,
          proofPurpose: 'assertionMethod',
          proofValue: 'SAMPLE_SIGNATURE_PLACEHOLDER',
        },
      };
      setVerifyJsonInput(JSON.stringify(sample, null, 2));
    }
  };

  if (identityLoading || credsLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (identityError || credsError) {
    return (
      <ErrorState
        title="Failed to load Sovereign Vault"
        message={(identityError || credsError)?.message || 'An error occurred'}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-display font-medium text-text">
                Sovereign Trust & Verifiable Credentials
              </h1>
              <p className="text-sm text-text-muted">
                W3C Decentralized Identifiers (DIDs), Ed25519 verifiable attestations, and
                local-first CRDT synchronization.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sovereign Identity Badge & Key Info */}
      {identity && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-success border border-success/30">
                  Self-Sovereign Identity Active
                </span>
                <span className="inline-flex items-center rounded-md bg-info/15 px-2 py-1 text-xs font-medium text-info border border-info/30">
                  Ed25519 · W3C DID Core
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                <span className="text-text-muted">DID:</span>
                <span className="font-semibold text-text">{identity.did}</span>
                <button
                  onClick={() => copyToClipboard(identity.did, 'DID')}
                  className="rounded p-1 text-text-muted hover:bg-surface-200 hover:text-text"
                  title="Copy DID"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9 9 9 0 00-9 9v.375m16.5 6.75H12m0 0l2.25-2.25M12 17.25l2.25 2.25"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-text-muted">
                <span>Public Key:</span>
                <span className="max-w-md truncate">{identity.publicKeyBase64}</span>
                <button
                  onClick={() => copyToClipboard(identity.publicKeyBase64, 'Public Key')}
                  className="rounded p-1 hover:bg-surface-200 hover:text-text"
                  title="Copy Public Key"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9 9 9 0 00-9 9v.375m16.5 6.75H12m0 0l2.25-2.25M12 17.25l2.25 2.25"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <button
                onClick={() => setDidModalOpen(true)}
                className="btn-secondary text-xs flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
                Inspect W3C DID Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'credentials'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Active Credentials ({credsData?.total ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('issue')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'issue'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Issue Capability Credential
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'verify'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Mathematical Verifier
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'sync'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          Local-First Sync (CRDT)
        </button>
      </div>

      {/* Tab 1: Credentials List */}
      {activeTab === 'credentials' && (
        <div className="space-y-4">
          {!credsData || credsData.credentials.length === 0 ? (
            <EmptyState
              title="No Verifiable Credentials Issued"
              description="Issue your first capability credential or run agent council workflows to generate tamper-evident audit credentials."
              action={{
                label: 'Issue Capability',
                onClick: () => setActiveTab('issue'),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {credsData.credentials.map((cred) => {
                const isCap = cred.credentialType === 'CapabilityCredential';
                const tag =
                  cred.claims?.['capabilityTag'] || cred.claims?.['agentName'] || 'Attestation';
                const tier =
                  cred.claims?.['validationTier'] || cred.claims?.['councilVerdict'] || 'VERIFIED';

                return (
                  <div
                    key={cred.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-card transition hover:border-border-strong"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                            isCap
                              ? 'bg-accent/15 text-accent border border-accent/30'
                              : 'bg-success/15 text-success border border-success/30'
                          }`}
                        >
                          {isCap ? 'Capability Credential' : 'Agent Audit Credential'}
                        </span>
                        <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                          {cred.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-mono text-base font-semibold text-text">{tag}</h3>
                        <p className="mt-1 font-mono text-xs text-text-muted">
                          Tier / Verdict: <span className="font-semibold text-text">{tier}</span>
                        </p>
                      </div>

                      {cred.claims?.['evidence'] && Array.isArray(cred.claims['evidence']) && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-text-muted">Evidence:</span>
                          <ul className="list-inside list-disc text-xs text-text-secondary">
                            {(cred.claims['evidence'] as string[]).slice(0, 3).map((e, idx) => (
                              <li key={idx} className="truncate">
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-text-muted">
                        {new Date(cred.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInspect(cred.id)}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Inspect JSON-LD
                        </button>
                        <button
                          onClick={async () => {
                            const doc = await api.sovereignty.getCredential(workspaceId!, cred.id);
                            setVerifyJsonInput(JSON.stringify(doc, null, 2));
                            setActiveTab('verify');
                          }}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          Verify Proof
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Issue Capability */}
      {activeTab === 'issue' && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-display font-medium text-text">
            Issue Signed W3C Capability Credential
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Cryptographically certify verified agent or human skills using your sovereign Ed25519
            identity.
          </p>

          <form onSubmit={handleIssueCapability} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Capability Tag
              </label>
              <input
                type="text"
                value={capabilityTag}
                onChange={(e) => setCapabilityTag(e.target.value)}
                placeholder="e.g. capability:backend.python@v3 or capability:security.zero_trust@v1"
                className="input-field mt-1.5 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Validation Tier
              </label>
              <select
                value={validationTier}
                onChange={(e) => setValidationTier(e.target.value)}
                className="input-field mt-1.5"
              >
                <option value="V0">V0 - Unverified / Self-Claimed</option>
                <option value="V1">V1 - Syntactic / AST Checked</option>
                <option value="V2">V2 - Unit & Integration Tested</option>
                <option value="V3">V3 - Zero-Trust & Forensic Audited</option>
                <option value="V4">V4 - Formal Proof / Council Signed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Evidence Log (One per line)
              </label>
              <textarea
                value={evidenceInput}
                onChange={(e) => setEvidenceInput(e.target.value)}
                rows={4}
                placeholder="Passed 37 unit tests&#10;AST static analysis clean&#10;SSRF and RLS verified"
                className="input-field mt-1.5 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={issuing || !capabilityTag.trim()}
              className="btn-primary inline-flex items-center gap-2"
            >
              {issuing ? 'Cryptographically Signing...' : 'Sign & Issue Verifiable Credential'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Mathematical Verifier */}
      {activeTab === 'verify' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-medium text-text">
                  Zero-Knowledge Mathematical Proof Verifier
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Verifies Ed25519Signature2020 proofs against canonical W3C JSON-LD payloads with
                  tamper detection.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSampleForVerification}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Load Sample
              </button>
            </div>

            <div className="mt-4">
              <textarea
                value={verifyJsonInput}
                onChange={(e) => setVerifyJsonInput(e.target.value)}
                rows={10}
                placeholder="Paste complete W3C Verifiable Credential JSON here..."
                className="input-field p-4 font-mono text-xs"
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={verifying || !verifyJsonInput.trim()}
                className="btn-primary inline-flex items-center gap-2"
              >
                {verifying ? 'Verifying Ed25519 Curve...' : 'Verify Cryptographic Signature'}
              </button>
            </div>
          </div>

          {/* Live Verification Verdict */}
          {verificationResult && (
            <div
              className={`rounded-xl border p-6 shadow-card ${
                verificationResult.isValid
                  ? 'border-success/30 bg-success/15'
                  : 'border-error/30 bg-error/15'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
                    verificationResult.isValid
                      ? 'bg-success/20 text-success ring-success/30'
                      : 'bg-error/20 text-error ring-error/30'
                  }`}
                >
                  {verificationResult.isValid ? (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="space-y-1">
                  <h3
                    className={`text-base font-display font-medium ${
                      verificationResult.isValid ? 'text-success' : 'text-error'
                    }`}
                  >
                    {verificationResult.isValid
                      ? 'Cryptographically Valid & Untampered'
                      : 'Verification Refused (Signature / Hash Mismatch)'}
                  </h3>
                  <p
                    className={`text-xs ${
                      verificationResult.isValid ? 'text-success' : 'text-error'
                    }`}
                  >
                    {verificationResult.reason ||
                      'Ed25519 signature mathematically verified against canonical bytes.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs text-text-secondary">
                    <div>
                      <span className="font-semibold text-text">Issuer:</span>{' '}
                      {verificationResult.issuer}
                    </div>
                    <div>
                      <span className="font-semibold text-text">Subject:</span>{' '}
                      {verificationResult.subject}
                    </div>
                    <div>
                      <span className="font-semibold text-text">Type:</span>{' '}
                      {verificationResult.credentialType}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Local-First Sync (CRDT) */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-success"></span>
                  <h2 className="text-lg font-display font-medium text-text">
                    Conflict-Free Replicated Data (CRDT) Ledger
                  </h2>
                </div>
                <p className="mt-1 text-sm text-text-muted">
                  Hybrid Logical Clocks (HLC) deliver deterministic Last-Write-Wins (LWW) state
                  merging for local-first operations.
                </p>
              </div>
              <button
                onClick={() => mutateSync()}
                disabled={syncLoading}
                className="btn-secondary text-xs"
              >
                {syncLoading ? 'Syncing...' : 'Pull Latest Deltas'}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-100 p-4">
                <span className="text-xs text-text-muted">Active Clock Cursor</span>
                <p className="mt-1 font-mono text-sm font-bold text-text truncate">
                  {syncData?.latestHlc ?? 'Synchronized'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-100 p-4">
                <span className="text-xs text-text-muted">Total Delta Count</span>
                <p className="mt-1 font-mono text-sm font-bold text-text">{syncData?.total ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface-100 p-4">
                <span className="text-xs text-text-muted">Conflict Resolution Mode</span>
                <p className="mt-1 font-mono text-sm font-bold text-success">Deterministic LWW</p>
              </div>
            </div>
          </div>

          {/* Deltas table */}
          {syncData?.deltas && syncData.deltas.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-text-muted">
                      HLC
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-text-muted">
                      Entity Type
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-text-muted">
                      Operation
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-text-muted">
                      Client ID
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-text-muted">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {syncData.deltas.map((d: any) => (
                    <tr key={d.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{d.hlcTimestamp}</td>
                      <td className="px-4 py-3 text-xs font-medium text-text">{d.entityType}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="rounded bg-surface-200 px-1.5 py-0.5 font-mono text-text">
                          {d.operation}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">{d.clientId}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {new Date(d.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface-100/50">
              <p className="text-sm text-text-muted">
                No recent CRDT state deltas recorded in this workspace.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inspect Credential Modal */}
      {inspectModalOpen && selectedCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-base font-display font-medium text-text">
                W3C JSON-LD Verifiable Credential
              </h3>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-200 hover:text-text"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 font-mono text-xs">
              <pre className="rounded-xl bg-background p-4 text-success overflow-x-auto">
                {JSON.stringify(selectedCred, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() =>
                  copyToClipboard(JSON.stringify(selectedCred, null, 2), 'Credential JSON')
                }
                className="btn-secondary text-xs px-4 py-2"
              >
                Copy JSON-LD
              </button>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="btn-primary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect DID Document Modal */}
      {didModalOpen && identity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="text-base font-display font-medium text-text">
                W3C DID Document ({identity.did})
              </h3>
              <button
                onClick={() => setDidModalOpen(false)}
                className="rounded-lg p-1 text-text-muted hover:bg-surface-200 hover:text-text"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 font-mono text-xs">
              <pre className="rounded-xl bg-background p-4 text-info overflow-x-auto">
                {JSON.stringify(identity.didDocument, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2 border-t border-border p-4">
              <button
                onClick={() =>
                  copyToClipboard(JSON.stringify(identity.didDocument, null, 2), 'DID Document')
                }
                className="btn-secondary text-xs px-4 py-2"
              >
                Copy DID Document
              </button>
              <button
                onClick={() => setDidModalOpen(false)}
                className="btn-primary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
