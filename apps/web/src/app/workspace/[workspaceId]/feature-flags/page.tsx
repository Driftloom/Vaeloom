'use client';
import React, { useState } from 'react';
import { Button, Card, Input } from '@vaeloom/ui-kit';
import { Toggle } from '@/components/shared/Toggle';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  category: string;
  updatedAt: string;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: { label: string; percentage: number }[];
  status: 'running' | 'paused' | 'completed';
}

const initialFlags: FeatureFlag[] = [
  { id: 'f1', name: 'new-agent-ui', description: 'Enable the redesigned agent configuration interface', enabled: true, rolloutPercentage: 100, category: 'ui', updatedAt: '2026-07-15' },
  { id: 'f2', name: 'advanced-search', description: 'Enable semantic search across all workspace documents', enabled: true, rolloutPercentage: 50, category: 'features', updatedAt: '2026-07-14' },
  { id: 'f3', name: 'batch-operations', description: 'Allow batch operations on files and memories', enabled: false, rolloutPercentage: 0, category: 'features', updatedAt: '2026-07-10' },
  { id: 'f4', name: 'dark-mode-v2', description: 'Enable enhanced dark mode theming with new color palette', enabled: true, rolloutPercentage: 25, category: 'ui', updatedAt: '2026-07-18' },
  { id: 'f5', name: 'ai-suggestions', description: 'Show AI-powered suggestions in the editor', enabled: false, rolloutPercentage: 0, category: 'ai', updatedAt: '2026-07-12' },
  { id: 'f6', name: 'webhook-integrations', description: 'Allow third-party webhook connections', enabled: true, rolloutPercentage: 100, category: 'integrations', updatedAt: '2026-07-01' },
];

const audits = [
  { flag: 'new-agent-ui', action: 'enabled (100%)', user: 'Alice Chen', timestamp: '2026-07-15 14:30' },
  { flag: 'advanced-search', action: 'rollout changed to 50%', user: 'Bob Martinez', timestamp: '2026-07-14 11:22' },
  { flag: 'dark-mode-v2', action: 'rollout changed to 25%', user: 'Alice Chen', timestamp: '2026-07-13 09:15' },
  { flag: 'batch-operations', action: 'disabled', user: 'Eve Williams', timestamp: '2026-07-10 16:00' },
];

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flags' | 'abtest' | 'audit'>('flags');

  const handleToggle = (id: string) => {
    setFlags(flags.map(f => f.id === id ? { ...f, enabled: !f.enabled, rolloutPercentage: !f.enabled ? 100 : 0 } : f));
  };

  const handleRollout = (id: string, pct: number) => {
    setFlags(flags.map(f => f.id === id ? { ...f, rolloutPercentage: Math.max(0, Math.min(100, pct)), enabled: pct > 0 } : f));
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Feature Flags</h1>
        <p className="text-text-muted">Manage feature rollouts, A/B tests, and track changes.</p>
      </header>

      <div className="flex gap-2 border-b border-border">
        {(['flags', 'abtest', 'audit'] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeTab === tab ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text'
            }`}
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
                        onChange={(e) => handleRollout(flag.id, parseInt(e.target.value))}
                        className="flex-1 h-2 bg-surface-active rounded-lg appearance-none cursor-pointer accent-primary max-w-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
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
                  <input type="number" min={0} max={100} className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text" placeholder="50%" />
                </div>
                <div className="flex items-center gap-3">
                  <Input placeholder="Variant B label" className="flex-1" />
                  <input type="number" min={0} max={100} className="w-20 bg-background border border-border rounded-md px-3 py-2 text-sm text-text" placeholder="50%" />
                </div>
              </div>
            </div>
            <Button>Create Test</Button>
          </div>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card padding="lg">
          <h2 className="text-lg font-display font-medium text-text mb-4">Audit Trail</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
              <span>Flag</span><span>Action</span><span>User</span><span>Timestamp</span>
            </div>
            {audits.map((a, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 py-2 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors">
                <span className="font-mono text-primary">{a.flag}</span>
                <span className="text-text-muted">{a.action}</span>
                <span>{a.user}</span>
                <span className="text-text-muted text-xs">{a.timestamp}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
