'use client';

import React, { useState } from 'react';
import { JobPreferencesData, ProfileData, profileApi } from '@/lib/api-client';

interface JobPreferencesProps {
  preferences: JobPreferencesData | null;
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function JobPreferences({
  preferences,
  workspaceId,
  onUpdate,
}: JobPreferencesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobTypes, setJobTypes] = useState(preferences?.jobTypes?.join(', ') ?? '');
  const [industries, setIndustries] = useState(preferences?.preferredIndustries?.join(', ') ?? '');
  const [remotePref, setRemotePref] = useState(preferences?.remotePreference ?? 'Remote');
  const [dealbreakers, setDealbreakers] = useState(preferences?.dealbreakers?.join(', ') ?? '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await profileApi.updatePreferences(
        {
          jobTypes: jobTypes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          preferredIndustries: industries
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          remotePreference: remotePref,
          dealbreakers: dealbreakers
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        workspaceId,
      );
      onUpdate?.(updated);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  if (!preferences && !isEditing) {
    return (
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text">Job Preferences</h2>
          {workspaceId && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-medium px-2.5 py-1 rounded-md bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors"
            >
              Set Preferences
            </button>
          )}
        </div>
        <div className="p-8 text-center border border-dashed border-border rounded-xl">
          <p className="text-text-muted mb-3">
            Set your job preferences so your agents find the right opportunities
          </p>
          {workspaceId && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              Configure Preferences
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text">Job Preferences</h2>
          <p className="text-xs text-text-dim mt-0.5">
            Used by Job Search Agent and Application Agent
          </p>
        </div>
        {workspaceId && !isEditing && (
          <button
            onClick={() => {
              setJobTypes(preferences?.jobTypes?.join(', ') ?? '');
              setIndustries(preferences?.preferredIndustries?.join(', ') ?? '');
              setRemotePref(preferences?.remotePreference ?? 'Remote');
              setDealbreakers(preferences?.dealbreakers?.join(', ') ?? '');
              setIsEditing(true);
            }}
            className="text-sm font-medium text-text-muted hover:text-text px-2.5 py-1 rounded-md hover:bg-surface-hover transition-colors border border-border"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">
          {error}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Job Types (comma-separated)
            </label>
            <input
              type="text"
              value={jobTypes}
              onChange={(e) => setJobTypes(e.target.value)}
              placeholder="Full-time, Contract, Senior Engineer"
              className="w-full px-3 py-2 text-sm bg-surface-200 border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Preferred Industries (comma-separated)
            </label>
            <input
              type="text"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              placeholder="AI/ML, FinTech, Developer Tools"
              className="w-full px-3 py-2 text-sm bg-surface-200 border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Work Location Model
            </label>
            <select
              value={remotePref}
              onChange={(e) => setRemotePref(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-200 border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            >
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
              <option value="Any">Flexible / Any</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Dealbreakers (comma-separated)
            </label>
            <input
              type="text"
              value={dealbreakers}
              onChange={(e) => setDealbreakers(e.target.value)}
              placeholder="No crypto, No on-call, Relocation required"
              className="w-full px-3 py-2 text-sm bg-surface-200 border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-medium bg-surface-200 text-text-muted hover:text-text rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Job Types
            </h3>
            {preferences?.jobTypes && preferences.jobTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {preferences.jobTypes.map((type, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-surface-200 text-text rounded-md text-sm border border-border"
                  >
                    {type}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-dim italic">Not specified</p>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              Preferred Industries
            </h3>
            {preferences?.preferredIndustries && preferences.preferredIndustries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {preferences.preferredIndustries.map((ind, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-surface-200 text-text rounded-md text-sm border border-border"
                  >
                    {ind}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-dim italic">Not specified</p>
            )}
          </div>

          {preferences?.remotePreference && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Work Location
              </h3>
              <div className="text-sm font-medium text-text">{preferences.remotePreference}</div>
            </div>
          )}

          {preferences?.dealbreakers && preferences.dealbreakers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Dealbreakers
              </h3>
              <div className="flex flex-wrap gap-2">
                {preferences.dealbreakers.map((db, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-red-500/10 text-red-600 rounded-md text-sm border border-red-500/20 font-medium"
                  >
                    {db}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
