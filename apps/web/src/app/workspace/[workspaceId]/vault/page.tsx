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
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Sovereign Trust & Verifiable Credentials
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                W3C Decentralized Identifiers (DIDs), Ed25519 verifiable attestations, and
                local-first CRDT synchronization.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sovereign Identity Badge & Key Info */}
      {identity && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400">
                  Self-Sovereign Identity Active
                </span>
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400">
                  Ed25519 · W3C DID Core
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">DID:</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {identity.did}
                </span>
                <button
                  onClick={() => copyToClipboard(identity.did, 'DID')}
                  className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                <span>Public Key:</span>
                <span className="max-w-md truncate">{identity.publicKeyBase64}</span>
                <button
                  onClick={() => copyToClipboard(identity.publicKeyBase64, 'Public Key')}
                  className="rounded p-1 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'credentials'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'
          }`}
        >
          Active Credentials ({credsData?.total ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('issue')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'issue'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'
          }`}
        >
          Issue Capability Credential
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'verify'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'
          }`}
        >
          Mathematical Verifier
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'sync'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'
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
                    className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                            isCap
                              ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-950/50 dark:text-purple-400'
                              : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-400'
                          }`}
                        >
                          {isCap ? 'Capability Credential' : 'Agent Audit Credential'}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                          {cred.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
                          {tag}
                        </h3>
                        <p className="mt-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                          Tier / Verdict:{' '}
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {tier}
                          </span>
                        </p>
                      </div>

                      {cred.claims?.['evidence'] && Array.isArray(cred.claims['evidence']) && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-neutral-400">Evidence:</span>
                          <ul className="list-inside list-disc text-xs text-neutral-600 dark:text-neutral-300">
                            {(cred.claims['evidence'] as string[]).slice(0, 3).map((e, idx) => (
                              <li key={idx} className="truncate">
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
                      <span className="text-xs text-neutral-400">
                        {new Date(cred.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInspect(cred.id)}
                          className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                        >
                          Inspect JSON-LD
                        </button>
                        <button
                          onClick={async () => {
                            const doc = await api.sovereignty.getCredential(workspaceId!, cred.id);
                            setVerifyJsonInput(JSON.stringify(doc, null, 2));
                            setActiveTab('verify');
                          }}
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
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
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Issue Signed W3C Capability Credential
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Cryptographically certify verified agent or human skills using your sovereign Ed25519
            identity.
          </p>

          <form onSubmit={handleIssueCapability} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-500">
                Capability Tag
              </label>
              <input
                type="text"
                value={capabilityTag}
                onChange={(e) => setCapabilityTag(e.target.value)}
                placeholder="e.g. capability:backend.python@v3 or capability:security.zero_trust@v1"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 font-mono text-sm text-neutral-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-500">
                Validation Tier
              </label>
              <select
                value={validationTier}
                onChange={(e) => setValidationTier(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                <option value="V0">V0 - Unverified / Self-Claimed</option>
                <option value="V1">V1 - Syntactic / AST Checked</option>
                <option value="V2">V2 - Unit & Integration Tested</option>
                <option value="V3">V3 - Zero-Trust & Forensic Audited</option>
                <option value="V4">V4 - Formal Proof / Council Signed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-500">
                Evidence Log (One per line)
              </label>
              <textarea
                value={evidenceInput}
                onChange={(e) => setEvidenceInput(e.target.value)}
                rows={4}
                placeholder="Passed 37 unit tests&#10;AST static analysis clean&#10;SSRF and RLS verified"
                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 font-mono text-sm text-neutral-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>

            <button
              type="submit"
              disabled={issuing || !capabilityTag.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {issuing ? 'Cryptographically Signing...' : 'Sign & Issue Verifiable Credential'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Mathematical Verifier */}
      {activeTab === 'verify' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Zero-Knowledge Mathematical Proof Verifier
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Verifies Ed25519Signature2020 proofs against canonical W3C JSON-LD payloads with
                  tamper detection.
                </p>
              </div>
              <button
                type="button"
                onClick={loadSampleForVerification}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs text-neutral-900 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleVerify}
                disabled={verifying || !verifyJsonInput.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {verifying ? 'Verifying Ed25519 Curve...' : 'Verify Cryptographic Signature'}
              </button>
            </div>
          </div>

          {/* Live Verification Verdict */}
          {verificationResult && (
            <div
              className={`rounded-2xl border p-6 shadow-sm ${
                verificationResult.isValid
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
                    verificationResult.isValid
                      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
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
                    className={`text-base font-bold ${
                      verificationResult.isValid
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-rose-900 dark:text-rose-200'
                    }`}
                  >
                    {verificationResult.isValid
                      ? 'Cryptographically Valid & Untampered'
                      : 'Verification Refused (Signature / Hash Mismatch)'}
                  </h3>
                  <p
                    className={`text-xs ${
                      verificationResult.isValid
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {verificationResult.reason ||
                      'Ed25519 signature mathematically verified against canonical bytes.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 font-mono text-xs text-neutral-600 dark:text-neutral-300">
                    <div>
                      <span className="font-semibold">Issuer:</span> {verificationResult.issuer}
                    </div>
                    <div>
                      <span className="font-semibold">Subject:</span> {verificationResult.subject}
                    </div>
                    <div>
                      <span className="font-semibold">Type:</span>{' '}
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
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    Conflict-Free Replicated Data (CRDT) Ledger
                  </h2>
                </div>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Hybrid Logical Clocks (HLC) deliver deterministic Last-Write-Wins (LWW) state
                  merging for local-first operations.
                </p>
              </div>
              <button
                onClick={() => mutateSync()}
                disabled={syncLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                {syncLoading ? 'Syncing...' : 'Pull Latest Deltas'}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-xs text-neutral-500">Active Clock Cursor</span>
                <p className="mt-1 font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                  {syncData?.latestHlc ?? 'Synchronized'}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-xs text-neutral-500">Total Delta Count</span>
                <p className="mt-1 font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {syncData?.total ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                <span className="text-xs text-neutral-500">Conflict Resolution Mode</span>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Deterministic LWW
                </p>
              </div>
            </div>
          </div>

          {/* Deltas table */}
          {syncData?.deltas && syncData.deltas.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-neutral-500">
                      HLC
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-neutral-500">
                      Entity Type
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-neutral-500">
                      Operation
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-neutral-500">
                      Client ID
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-xs font-semibold text-neutral-500">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {syncData.deltas.map((d: any) => (
                    <tr key={d.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                      <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                        {d.hlcTimestamp}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        {d.entityType}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {d.operation}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">{d.clientId}</td>
                      <td className="px-4 py-3 text-xs text-neutral-400">
                        {new Date(d.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-800">
              <p className="text-sm text-neutral-500">
                No recent CRDT state deltas recorded in this workspace.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inspect Credential Modal */}
      {inspectModalOpen && selectedCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                W3C JSON-LD Verifiable Credential
              </h3>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
              <pre className="rounded-xl bg-neutral-900 p-4 text-emerald-400 overflow-x-auto">
                {JSON.stringify(selectedCred, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
              <button
                onClick={() =>
                  copyToClipboard(JSON.stringify(selectedCred, null, 2), 'Credential JSON')
                }
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                Copy JSON-LD
              </button>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                W3C DID Document ({identity.did})
              </h3>
              <button
                onClick={() => setDidModalOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
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
              <pre className="rounded-xl bg-neutral-900 p-4 text-sky-400 overflow-x-auto">
                {JSON.stringify(identity.didDocument, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
              <button
                onClick={() =>
                  copyToClipboard(JSON.stringify(identity.didDocument, null, 2), 'DID Document')
                }
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                Copy DID Document
              </button>
              <button
                onClick={() => setDidModalOpen(false)}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
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
