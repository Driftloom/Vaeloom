'use client';

import React, { useState } from 'react';
import { AgentDirectivesData, ProfileData, profileApi } from '@/lib/api-client';

interface AgentDirectivesCardProps {
  directives?: AgentDirectivesData | null;
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function AgentDirectivesCard({
  directives,
  workspaceId,
  onUpdate,
}: AgentDirectivesCardProps) {
  const [autonomyMode, setAutonomyMode] = useState(directives?.autonomyMode ?? 'copilot');
  const [minMatchThreshold, setMinMatchThreshold] = useState(directives?.minMatchThreshold ?? 80);
  const [dailyQuota, setDailyQuota] = useState(directives?.dailyApplicationQuota ?? 10);
  const [minBaseSalary, setMinBaseSalary] = useState(
    directives?.minBaseSalary ? String(directives.minBaseSalary) : '',
  );
  const [targetBaseSalary, setTargetBaseSalary] = useState(
    directives?.targetBaseSalary ? String(directives.targetBaseSalary) : '',
  );
  const [targetTotalComp, setTargetTotalComp] = useState(
    directives?.targetTotalComp ? String(directives.targetTotalComp) : '',
  );
  const [currency, setCurrency] = useState(directives?.currency ?? 'USD');
  const [noticePeriod, setNoticePeriod] = useState(directives?.noticePeriod ?? '2 weeks');
  const [relocation, setRelocation] = useState(directives?.relocationPreference ?? 'Remote only');
  const [travel, setTravel] = useState(directives?.travelPercentage ?? '0%');
  const [coverLetterPolicy, setCoverLetterPolicy] = useState(
    directives?.coverLetterPolicy ?? 'when_required',
  );

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: Partial<AgentDirectivesData> = {
        autonomyMode,
        minMatchThreshold: Number(minMatchThreshold),
        dailyApplicationQuota: Number(dailyQuota),
        minBaseSalary: minBaseSalary ? parseInt(minBaseSalary, 10) : null,
        targetBaseSalary: targetBaseSalary ? parseInt(targetBaseSalary, 10) : null,
        targetTotalComp: targetTotalComp ? parseInt(targetTotalComp, 10) : null,
        currency,
        noticePeriod,
        relocationPreference: relocation,
        travelPercentage: travel,
        coverLetterPolicy,
      };

      const updated = await profileApi.updateDirectives(payload, workspaceId);
      onUpdate?.(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save agent directives');
    } finally {
      setSaving(false);
    }
  };

  const autonomyModes = [
    {
      id: 'copilot',
      label: 'Copilot (Assisted)',
      badge: 'Recommended',
      description:
        'Agent searches, evaluates, and fills applications, but requires your 1-click review before final submission.',
      icon: '🛡️',
    },
    {
      id: 'semi_autonomous',
      label: 'Semi-Autonomous',
      badge: 'High Match',
      description:
        'Agent auto-applies only when ATS match score is ≥ 85%, holding applications with salary questions or essays for review.',
      icon: '⚡',
    },
    {
      id: 'full_autopilot',
      label: 'Full Autopilot',
      badge: 'Autonomous',
      description:
        'Agent operates end-to-end within pre-approved parameters up to your daily quota, logging full receipts.',
      icon: '🚀',
    },
  ];

  const currencies = [
    { code: 'USD', label: 'USD ($) — US Dollar' },
    { code: 'INR', label: 'INR (₹) — Indian Rupee' },
    { code: 'EUR', label: 'EUR (€) — Euro' },
    { code: 'GBP', label: 'GBP (£) — British Pound' },
    { code: 'CAD', label: 'CAD ($) — Canadian Dollar' },
    { code: 'AUD', label: 'AUD ($) — Australian Dollar' },
    { code: 'SGD', label: 'SGD ($) — Singapore Dollar' },
  ];

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <span>Agent Autopilot Directives & Guardrails</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
              Autonomous Brain
            </span>
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Configure how your Job Search and Application Agents discover, evaluate, and submit
            applications on your behalf
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          ✓ Agent directives and guardrails updated successfully!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Autonomy Mode Selector */}
        <div>
          <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-2">
            1. Autonomous Execution Mode
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {autonomyModes.map((mode) => {
              const selected = autonomyMode === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => setAutonomyMode(mode.id)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    selected
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-surface-200 border-border hover:border-border-hover'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{mode.icon}</span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface text-text-muted border border-border'
                        }`}
                      >
                        {mode.badge}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-text">{mode.label}</h3>
                    <p className="text-xs text-text-muted leading-relaxed">{mode.description}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-text-dim">Status:</span>
                    <span
                      className={`text-[11px] font-medium ${selected ? 'text-primary' : 'text-text-muted'}`}
                    >
                      {selected ? 'Active Policy' : 'Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sliders: Match Threshold & Quota */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-surface-200 border border-border">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text">Minimum Match Score Threshold</label>
              <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                {minMatchThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              step="5"
              value={minMatchThreshold}
              onChange={(e) => setMinMatchThreshold(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="text-[11px] text-text-muted mt-1.5">
              Agents will skip applications where semantic ATS match score is below{' '}
              {minMatchThreshold}%.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-text">Daily Application Quota Cap</label>
              <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                {dailyQuota} / day
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={dailyQuota}
              onChange={(e) => setDailyQuota(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="text-[11px] text-text-muted mt-1.5">
              Safety governor: Limits total submissions to prevent platform rate limits and preserve
              reputation.
            </p>
          </div>
        </div>

        {/* Compensation Guardrails */}
        <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              2. Compensation Guardrails & Currency
            </h3>
            <div className="w-56">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Minimum Base Salary Floor
              </label>
              <input
                type="number"
                value={minBaseSalary}
                onChange={(e) => setMinBaseSalary(e.target.value)}
                placeholder="e.g. 140000"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
              <span className="text-[10px] text-text-dim mt-0.5 block">
                Reject jobs below this floor
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Target Base Salary
              </label>
              <input
                type="number"
                value={targetBaseSalary}
                onChange={(e) => setTargetBaseSalary(e.target.value)}
                placeholder="e.g. 185000"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
              <span className="text-[10px] text-text-dim mt-0.5 block">
                Auto-fills salary questions
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Target Total Compensation
              </label>
              <input
                type="number"
                value={targetTotalComp}
                onChange={(e) => setTargetTotalComp(e.target.value)}
                placeholder="e.g. 240000"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
              <span className="text-[10px] text-text-dim mt-0.5 block">Base + Bonus + Equity</span>
            </div>
          </div>
        </div>

        {/* Operational Policies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-200 border border-border">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Notice Period</label>
            <select
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            >
              <option value="Immediately">Immediately (No notice)</option>
              <option value="2 weeks">2 weeks</option>
              <option value="1 month">1 month</option>
              <option value="2 months">2 months</option>
              <option value="3 months">3 months</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Relocation Preference
            </label>
            <select
              value={relocation}
              onChange={(e) => setRelocation(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            >
              <option value="Remote only">Remote only</option>
              <option value="Willing to relocate with assistance">
                Willing to relocate (with assistance)
              </option>
              <option value="Open to relocation at own expense">Open to relocation (any)</option>
              <option value="Not willing to relocate">Not willing to relocate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Travel Willingness
            </label>
            <select
              value={travel}
              onChange={(e) => setTravel(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            >
              <option value="0%">0% (No travel)</option>
              <option value="Up to 10%">Up to 10% (Occasional offsites)</option>
              <option value="Up to 25%">Up to 25% (Monthly travel)</option>
              <option value="Up to 50%">Up to 50% (Frequent travel)</option>
              <option value="50%+">50%+ (Heavy travel)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Cover Letter Policy
            </label>
            <select
              value={coverLetterPolicy}
              onChange={(e) => setCoverLetterPolicy(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            >
              <option value="when_required">Generate only when strictly required</option>
              <option value="always">Always generate tailored cover letter</option>
              <option value="never">Never submit cover letter</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Saving Guardrails...' : 'Save Agent Directives'}
          </button>
        </div>
      </form>
    </div>
  );
}
