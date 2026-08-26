'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input } from '@vaeloom/ui-kit';
import { Toggle } from '@/components/shared/Toggle';
import { StatusBadge } from '@/components/shared/StatusBadge';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  category: string;
  updatedAt: string;
}

interface AuditEntry {
  flag: string;
  action: string;
  user: string;
  timestamp: string;
}

const initialFlags: FeatureFlag[] = [
  { id: 'f1', name: 'new-agent-ui', description: 'Enable the redesigned agent configuration interface', enabled: true, rolloutPercentage: 100, category: 'ui', updatedAt: '2026-07-15' },
  { id: 'f2', name: 'advanced-search', description: 'Enable semantic search across all workspace documents', enabled: true, rolloutPercentage: 50, category: 'features', updatedAt: '2026-07-14' },
  { id: 'f3', name: 'batch-operations', description: 'Allow batch operations on files and memories', enabled: false, rolloutPercentage: 0, category: 'features', updatedAt: '2026-07-10' },
  { id: 'f4', name: 'dark-mode-v2', description: 'Enable enhanced dark mode theming with new color palette', enabled: true, rolloutPercentage: 25, category: 'ui', updatedAt: '2026-07-18' },
  { id: 'f5', name: 'ai-suggestions', description: 'Show AI-powered suggestions in the editor', enabled: false, rolloutPercentage: 0, category: 'ai', updatedAt: '2026-07-12' },
  { id: 'f6', name: 'webhook-integrations', description: 'Allow third-party webhook connections', enabled: true, rolloutPercentage: 100, category: 'integrations', updatedAt: '2026-07-01' },
];

const initialAudits: AuditEntry[] = [
  { flag: 'new-agent-ui', action: 'enabled (100%)', user: 'Alice Chen', timestamp: '2026-07-15 14:30' },
  { flag: 'advanced-search', action: 'rollout changed to 50%', user: 'Bob Martinez', timestamp: '2026-07-14 11:22' },
  { flag: 'dark-mode-v2', action: 'rollout changed to 25%', user: 'Alice Chen', timestamp: '2026-07-13 09:15' },
  { flag: 'batch-operations', action: 'disabled', user: 'Eve Williams', timestamp: '2026-07-10 16:00' },
];

export default function FeatureFlagsPage() {
  // ── Hooks must be BEFORE early return guard (no conditional hooks) ─────────
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? null;
  const storageKey = `vaeloom.featureFlags.${workspaceId ?? 'default'}`;

  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [audits, setAudits] = useState<AuditEntry[]>(initialAudits);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  void expandedFlag;
  void setExpandedFlag;
  const [activeTab, setActiveTab] = useState<'flags' | 'abtest' | 'audit'>('flags');
  const [hydrated, setHydrated] = useState(false);

  const { data: tenantSettings } = useSWR(
    workspaceId ? `tenant-settings-${workspaceId}` : null,
    () => api.request<Record<string, unknown>>(`/admin/tenants/${workspaceId}/settings`).catch(() => null),
    { revalidateOnFocus: false },
  );

  const isLive = !!tenantSettings;

  // Hydrate flags from localStorage per workspace
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as FeatureFlag[];
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((f) => typeof f.id === 'string' && typeof f.name === 'string')) {
          setFlags(parsed);
        }
      }
    } catch {
      // ignore parse/storage errors
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  // Persist flags to localStorage on change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(flags));
      }
    } catch {
      // ignore quota/privacy errors
    }
  }, [flags, storageKey, hydrated]);

  // Optional: if backend tenant settings contain feature flag state, it would win — currently settings shape is opaque, so we treat existence as "live"
  useEffect(() => {
    if (tenantSettings && typeof tenantSettings === 'object') {
      const maybeFlags = (tenantSettings as { featureFlags?: unknown }).featureFlags;
      if (Array.isArray(maybeFlags) && maybeFlags.length > 0) {
        try {
          const normalized = (maybeFlags as unknown[]).map((f) => f as FeatureFlag).filter((f) => typeof f.id === 'string');
          if (normalized.length > 0) setFlags(normalized);
        } catch {
          // ignore shape mismatch
        }
      }
    }
  }, [tenantSettings]);

  const appendAudit = useCallback((flagName: string, action: string) => {
    const entry: AuditEntry = {
      flag: flagName,
      action,
      user: 'you',
      timestamp: new Date().toLocaleString(),
    };
    setAudits((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      setFlags((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const nextEnabled = !f.enabled;
          const nextPct = nextEnabled ? 100 : 0;
          const action = nextEnabled ? `enabled (${nextPct}%)` : 'disabled';
          // schedule audit after state update via queueMicrotask to keep audit trail in sync with toggle
          queueMicrotask(() => appendAudit(f.name, action));
          return { ...f, enabled: nextEnabled, rolloutPercentage: nextPct, updatedAt: new Date().toISOString().slice(0, 10) };
        }),
      );
    },
    [appendAudit],
  );

  const handleRollout = useCallback(
    (id: string, pct: number) => {
      const clamped = Math.max(0, Math.min(100, pct));
      setFlags((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const nextEnabled = clamped > 0;
          queueMicrotask(() => appendAudit(f.name, `rollout changed to ${clamped}%`));
          return { ...f, rolloutPercentage: clamped, enabled: nextEnabled, updatedAt: new Date().toISOString().slice(0, 10) };
        }),
      );
    },
    [appendAudit],
  );

  // Enterprise gate — MUST stay after all hooks (no conditional hooks before)
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Feature Flags" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Feature Flags</h1>
        <p className="text-text-muted">
          Manage feature rollouts, A/B tests, and track changes.{' '}
          <span className={isLive ? 'text-success' : 'text-text-dim'}>
            {isLive ? 'Live from GET /admin/tenants/{id}/settings (live)' : '(persisted locally)'}
          </span>
        </p>
        <p className="mt-2 text-xs font-mono text-text-dim">
          Data source:{' '}
          {isLive ? (
            <span className="text-success">GET /admin/tenants/{workspaceId}/settings (live) — flags may be overridden by backend when shape matches</span>
          ) : (
            <span>
              localStorage <code className="rounded bg-surface px-1 py-0.5 border border-border">{storageKey}</code> — {hydrated ? 'hydrated' : 'hydrating…'} · {flags.length} flag(s) · no live tenant settings (backend unavailable)
            </span>
          )}
        </p>
      </header>

      <div className="flex gap-2 border-b border-border">
        {(['flags', 'abtest', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${activeTab === tab ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'flags' ? 'Flags' : tab === 'abtest' ? 'A/B Tests' : 'Audit Trail'}
          </button>
        ))}
      </div>

      {activeTab === 'flags' && (
        <div className="space-y-4">
          {flags.map((flag) => (
            <Card key={flag.id} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Toggle enabled={flag.enabled} onChange={() => handleToggle(flag.id)} />
                    <div>
                      <span className="font-mono text-sm text-primary">{flag.name}</span>
                      <span className="ml-2 text-xs text-text-muted bg-surface-active px-2 py-0.5 rounded">{flag.category}</span>
                    </div>
                    <StatusBadge variant={flag.enabled ? 'success' : 'neutral'} label={flag.enabled ? 'ON' : 'OFF'} />
                    <span className="text-xs text-text-dim font-mono ml-auto hidden sm:inline">{flag.updatedAt}</span>
                  </div>
                  <p className="text-sm text-text-muted mt-2 ml-11">{flag.description}</p>
                  <div className="ml-11 mt-3">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-text-muted w-32">Rollout: {flag.rolloutPercentage}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={flag.rolloutPercentage}
                        onChange={(e) => handleRollout(flag.id, parseInt(e.target.value, 10))}
                        className="flex-1 h-2 bg-surface-active rounded-lg appearance-none cursor-pointer accent-primary max-w-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          <p className="text-xs text-text-dim font-mono">Flags persisted to {storageKey} · changes append to Audit Trail with timestamp</p>
        </div>
      )}

      {activeTab === 'abtest' && (
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">A/B Test Configuration</h2>
          <div className="space-y-4">
            <Input label="Test Name" placeholder="e.g. new-onboarding-flow" />
            <Input label="Description" placeholder="Describe what this test compares" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text">Variants</label>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Input placeholder="Variant A label" className="flex-1" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text"
                    placeholder="50%"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Input placeholder="Variant B label" className="flex-1" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text"
                    placeholder="50%"
                  />
                </div>
              </div>
            </div>
            <Button>Create Test</Button>
          </div>
          <p className="mt-4 text-xs text-text-dim font-mono">A/B tests are UI only — no backend endpoint yet (future: POST /feature-flags/ab-tests)</p>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">Audit Trail</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
              <span>Flag</span>
              <span>Action</span>
              <span>User</span>
              <span>Timestamp</span>
            </div>
            {audits.map((a, i) => (
              <div key={`${a.flag}-${a.timestamp}-${i}`} className="grid grid-cols-4 gap-4 py-2 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors">
                <span className="font-mono text-primary">{a.flag}</span>
                <span className="text-text-muted">{a.action}</span>
                <span>{a.user}</span>
                <span className="text-text-muted text-xs">{a.timestamp}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-dim font-mono">Audit trail is in-memory + appended on every toggle/rollout with live timestamp · persisted flags survive reload via {storageKey}</p>
        </Card>
      )}
    </div>
  );
}
