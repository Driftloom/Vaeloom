'use client';

import React, { useState } from 'react';
import { BlacklistItem, ProfileData, profileApi } from '@/lib/api-client';
import { Panel } from '@/components/shared/Panel';

interface CompanyBlacklistCardProps {
  blacklist: BlacklistItem[];
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function CompanyBlacklistCard({
  blacklist = [],
  workspaceId,
  onUpdate,
}: CompanyBlacklistCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [reason, setReason] = useState('Current Employer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !companyName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await profileApi.addBlacklist(
        {
          companyName: companyName.trim(),
          domain: domain.trim() || undefined,
          reason,
        },
        workspaceId,
      );
      setCompanyName('');
      setDomain('');
      setIsAdding(false);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add company to blacklist');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (compName: string) => {
    if (!workspaceId) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await profileApi.removeBlacklist(compName, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <span>Company Blacklist & Employer Blocklist</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-surface-200 text-text-muted border border-border">
              {blacklist.length} Protected
            </span>
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Your agents will immediately skip any job postings from these companies, parent
            entities, or matching domains
          </p>
        </div>
        {workspaceId && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Company
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="mb-6 p-4 rounded-xl border border-border bg-surface-200 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text">Exclude Company from Agent Search</h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-text-muted hover:text-text text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp, Google"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Website Domain (Optional)
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. acmeworks.com"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Protection Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              >
                <option value="Current Employer">Current Employer</option>
                <option value="Direct Competitor">Direct Competitor</option>
                <option value="Toxic Culture / Bad Experience">
                  Toxic Culture / Poor Glassdoor
                </option>
                <option value="Former Employer">Former Employer</option>
                <option value="Recruitment Agency">Recruitment Agency</option>
                <option value="Personal Preference">Personal Preference</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface hover:bg-surface-hover text-text border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding...' : 'Protect & Exclude'}
            </button>
          </div>
        </form>
      )}

      {blacklist.length === 0 && !isAdding ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl">
          <p className="text-text-muted text-sm mb-3">
            No companies blacklisted yet. Add your current employer to guarantee agents never
            discover or apply to your current company.
          </p>
          {workspaceId && (
            <button
              onClick={() => setIsAdding(true)}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add First Excluded Company
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {blacklist.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-surface-200 border border-border flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text truncate">
                    {item.companyName}
                  </span>
                  {item.autoInferred && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Auto-Protected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-dim mt-0.5">
                  <span>{item.reason}</span>
                  {item.domain && <span>• {item.domain}</span>}
                </div>
              </div>

              {workspaceId && !item.autoInferred && (
                <button
                  onClick={() => handleRemove(item.companyName)}
                  className="opacity-40 group-hover:opacity-100 hover:text-red-500 p-1 rounded transition-opacity"
                  title="Remove from blacklist"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
