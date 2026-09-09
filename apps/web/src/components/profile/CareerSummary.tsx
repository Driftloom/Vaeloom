'use client';

import React, { useState } from 'react';
import { CareerEntry, ProfileData, profileApi } from '@/lib/api-client';

interface CareerSummaryProps {
  careerHistory: CareerEntry[];
  yearsExperience: number | null;
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function CareerSummary({
  careerHistory,
  yearsExperience,
  workspaceId,
  onUpdate,
}: CareerSummaryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCompany, setEditCompany] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [achievementsText, setAchievementsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAdd = () => {
    setEditCompany(null);
    setRole('');
    setCompany('');
    setStartDate('');
    setEndDate('');
    setAchievementsText('');
    setError(null);
    setIsEditing(true);
  };

  const openEdit = (entry: CareerEntry) => {
    setEditCompany(entry.company);
    setRole(entry.role);
    setCompany(entry.company);
    setStartDate(entry.startDate || '');
    setEndDate(entry.endDate || '');
    setAchievementsText((entry.achievements || []).join('\n'));
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !company.trim() || !role.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const achievements = achievementsText
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean);

      let updated: ProfileData;
      if (editCompany) {
        updated = await profileApi.updateCareer(
          editCompany,
          {
            role: role.trim(),
            startDate: startDate.trim() || undefined,
            endDate: endDate.trim() || undefined,
            achievements,
          },
          workspaceId,
        );
      } else {
        updated = await profileApi.addCareer(
          {
            company: company.trim(),
            role: role.trim(),
            startDate: startDate.trim() || undefined,
            endDate: endDate.trim() || undefined,
            achievements,
          },
          workspaceId,
        );
      }
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to save career experience');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (compName: string) => {
    if (!workspaceId) return;
    if (!window.confirm(`Are you sure you want to remove ${compName} from your career history?`))
      return;

    try {
      const updated = await profileApi.deleteCareer(compName, workspaceId);
      onUpdate?.(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove career experience');
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-text">Career Journey</h2>
          {yearsExperience !== null && (
            <span className="px-3 py-1 bg-surface-200 rounded-full text-xs font-medium text-text-muted">
              {yearsExperience}+ years experience
            </span>
          )}
        </div>
        {workspaceId && !isEditing && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium rounded-lg transition-colors"
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
            Add Experience
          </button>
        )}
      </div>

      {isEditing && (
        <form
          onSubmit={handleSave}
          className="mb-6 p-4 border border-primary/20 rounded-xl bg-surface-50 space-y-4"
        >
          <h3 className="text-sm font-semibold text-text">
            {editCompany ? `Edit Experience at ${editCompany}` : 'Add New Career Experience'}
          </h3>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Company *</label>
              <input
                type="text"
                required
                disabled={!!editCompany}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Role / Job Title *
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Start Date</label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. 2021-03 or Mar 2021"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">End Date</label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="e.g. Present or 2023-11"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Key Achievements & Impacts (one per line)
            </label>
            <textarea
              rows={3}
              value={achievementsText}
              onChange={(e) => setAchievementsText(e.target.value)}
              placeholder="Architected distributed event pipeline handling 2M events/sec&#10;Mentored 4 engineers and improved release velocity by 35%"
              className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save to Memory'}
            </button>
          </div>
        </form>
      )}

      {(!careerHistory || careerHistory.length === 0) && !isEditing ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl">
          <p className="text-text-muted text-sm">
            Add resume or click "+ Add Experience" to build your career journey
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {careerHistory.map((roleEntry, idx) => (
            <div key={idx} className="relative pl-6 border-l-2 border-border group">
              <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1.5" />

              <div className="flex justify-between items-start mb-1">
                <div>
                  <h3 className="text-base font-semibold text-text">{roleEntry.role}</h3>
                  <div className="text-primary font-medium text-sm">{roleEntry.company}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-text-muted text-right">
                    <div>
                      {roleEntry.startDate ? roleEntry.startDate : 'Unknown'} -{' '}
                      {roleEntry.endDate ? roleEntry.endDate : 'Present'}
                    </div>
                    {roleEntry.confidence < 0.8 && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-surface-200 rounded text-text-dim">
                        Inferred
                      </span>
                    )}
                  </div>

                  {workspaceId && !isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button
                        onClick={() => openEdit(roleEntry)}
                        className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-text"
                        title="Edit position"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(roleEntry.company)}
                        className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-rose-500"
                        title="Delete position"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {roleEntry.achievements && roleEntry.achievements.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-text-muted list-disc list-inside">
                  {roleEntry.achievements.map((achieve, i) => (
                    <li key={i}>{achieve}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
