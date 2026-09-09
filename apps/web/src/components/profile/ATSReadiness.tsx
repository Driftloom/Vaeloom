'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ATSReadinessData, profileApi } from '@/lib/api-client';

interface ATSReadinessProps {
  workspaceId: string;
  onSkillAdded?: () => void;
}

export default function ATSReadiness({ workspaceId, onSkillAdded }: ATSReadinessProps) {
  const {
    data: ats,
    error,
    isLoading,
    mutate,
  } = useSWR<ATSReadinessData>(
    workspaceId ? ['profile-ats', workspaceId] : null,
    () => profileApi.atsReadiness(workspaceId),
    { revalidateOnFocus: false },
  );

  const [addingSkill, setAddingSkill] = useState<string | null>(null);

  const handleAddMissingSkill = async (skill: string) => {
    setAddingSkill(skill);
    try {
      await profileApi.addSkill(skill, workspaceId, 1.0);
      await mutate();
      onSkillAdded?.();
    } catch (err) {
      console.error('Failed to add missing skill:', err);
    } finally {
      setAddingSkill(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6 bg-gradient-to-br from-surface to-surface-200 animate-pulse space-y-4">
        <div className="h-5 w-32 bg-surface-200 rounded" />
        <div className="h-16 w-16 mx-auto rounded-full bg-surface-200" />
        <div className="h-4 w-48 bg-surface-200 rounded mx-auto" />
      </div>
    );
  }

  const score = ats?.score ?? 0;
  const statusLabel = ats?.statusLabel ?? 'Calculating';
  const targetRole = ats?.targetRole ?? 'General Profile';
  const matchingSkills = ats?.matchingSkills ?? [];
  const missingSkills = ats?.missingSkills ?? [];
  const suggestions = ats?.suggestions ?? [];

  // Gauge colors
  const strokeColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const textColor =
    score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';
  const badgeBg =
    score >= 80
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      : score >= 50
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        : 'bg-rose-500/10 border-rose-500/30 text-rose-400';

  // SVG Gauge calculations (radius = 32, circumference ~ 201)
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="card mb-6 bg-gradient-to-br from-surface to-surface-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="font-semibold text-text">ATS Readiness</h3>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badgeBg}`}>
          {statusLabel}
        </span>
      </div>

      {/* Target Role & Gauge */}
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="space-y-1">
          <p className="text-xs text-text-dim">Benchmark Target</p>
          <p className="text-sm font-semibold text-text truncate max-w-[160px]" title={targetRole}>
            {targetRole}
          </p>
          <p className="text-xs text-text-muted">
            {matchingSkills.length} keyword match{matchingSkills.length === 1 ? '' : 'es'}
          </p>
        </div>

        {/* Circular Gauge */}
        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              className="text-surface-active"
              fill="transparent"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke={strokeColor}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold font-mono ${textColor}`}>{score}%</span>
          </div>
        </div>
      </div>

      {/* Missing In-Demand ATS Skills */}
      {missingSkills.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border">
          <p className="text-xs font-medium text-text-muted flex items-center justify-between">
            <span>Missing ATS Keywords</span>
            <span className="text-[10px] text-text-dim">Click + to add</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingSkills.map((skill) => (
              <button
                key={skill}
                onClick={() => handleAddMissingSkill(skill)}
                disabled={addingSkill === skill}
                className="group flex items-center gap-1 px-2 py-1 rounded text-xs border border-dashed border-border hover:border-primary/50 bg-surface text-text-muted hover:text-text transition-colors"
                title={`Add ${skill} to verified skills`}
              >
                <span>{skill}</span>
                <span className="text-primary group-hover:scale-125 transition-transform">
                  {addingSkill === skill ? '...' : '+'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border">
          <div className="space-y-2">
            {suggestions.slice(0, 2).map((sug, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-text-muted">
                <svg
                  className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="leading-relaxed">{sug}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/workspace/${workspaceId}/resume`}
        className="block w-full py-2 text-center bg-primary text-white rounded-lg hover:bg-primary/90 text-xs font-semibold tracking-wide transition-colors shadow-sm"
      >
        Optimize in Resume Builder →
      </Link>
    </div>
  );
}
