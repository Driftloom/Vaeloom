'use client';

import React, { useState } from 'react';
import { SkillItem, ProfileData, profileApi } from '@/lib/api-client';

interface SkillsShowcaseProps {
  skills: SkillItem[];
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function SkillsShowcase({
  skills = [],
  workspaceId,
  onUpdate,
}: SkillsShowcaseProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [loadingSkill, setLoadingSkill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (skillName: string) => {
    if (!workspaceId) return;
    setLoadingSkill(skillName);
    setError(null);
    try {
      const updated = await profileApi.confirmSkill(skillName, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm skill');
    } finally {
      setLoadingSkill(null);
    }
  };

  const handleRemove = async (skillName: string) => {
    if (!workspaceId) return;
    setLoadingSkill(skillName);
    setError(null);
    try {
      const updated = await profileApi.removeSkill(skillName, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove skill');
    } finally {
      setLoadingSkill(null);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !newSkillName.trim()) return;
    setLoadingSkill('__new__');
    setError(null);
    try {
      const updated = await profileApi.addSkill(newSkillName.trim(), workspaceId, 1.0);
      onUpdate?.(updated);
      setNewSkillName('');
      setIsAdding(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add skill');
    } finally {
      setLoadingSkill(null);
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-text">Skills & Expertise</h2>
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
            Add Skill
          </button>
        )}
      </div>
      <p className="text-sm text-text-muted mb-4">
        Vaeloom learns these from your connected sources and interactions. Confirm skills to make
        them part of your permanent agent memory.
      </p>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">
          {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddSkill} className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="e.g. Next.js, Distributed Systems..."
            autoFocus
            className="flex-1 px-3 py-1.5 text-sm bg-surface-200 border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={loadingSkill === '__new__' || !newSkillName.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loadingSkill === '__new__' ? 'Adding...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewSkillName('');
            }}
            className="px-3 py-1.5 text-xs font-medium bg-surface-200 text-text-muted hover:text-text rounded-lg transition-colors"
          >
            Cancel
          </button>
        </form>
      )}

      {(!skills || skills.length === 0) && !isAdding ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl">
          <p className="text-text-muted mb-2">
            Connect sources or add skills to let Vaeloom personalize your agent workflows
          </p>
          {workspaceId && (
            <button
              onClick={() => setIsAdding(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              + Add First Skill
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {skills.map((skill, i) => {
            let dotColor = 'bg-gray-400';
            if (skill.verified || skill.confidence >= 0.9) dotColor = 'bg-emerald-500';
            else if (skill.confidence >= 0.7) dotColor = 'bg-amber-500';

            const isLoading = loadingSkill === skill.name;
            const tier = skill.validationTier || (skill.verified ? 'V1' : 'V0');
            const tierColors: Record<string, string> = {
              V0: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40',
              V1: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
              V2: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
              V3: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              V4: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
            };
            const decay = skill.decayStatus || 'fresh';
            const decayLabels: Record<string, string> = {
              fresh: 'text-emerald-400',
              active: 'text-amber-400',
              stale: 'text-rose-400',
            };

            return (
              <div
                key={i}
                className="group inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface-200 border border-border text-sm hover:border-border-hover transition-colors"
                title={`Tag: ${skill.tag || skill.name} | Tier: ${tier} | Status: ${decay} | Effective: ${Math.round((skill.effectiveConfidence ?? skill.confidence) * 100)}%`}
              >
                <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                <span className="font-medium text-text">{skill.name}</span>

                {/* PIOS Validation Tier Badge */}
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${tierColors[tier] ?? tierColors['V0']}`}
                  title={`Capability Tier ${tier}`}
                >
                  {tier}
                </span>

                {/* PIOS Decay status if not fresh */}
                {decay !== 'fresh' && (
                  <span
                    className={`text-[10px] font-medium ${decayLabels[decay] ?? ''}`}
                    title={`Recency Decay: ${decay}`}
                  >
                    • {decay}
                  </span>
                )}

                {skill.verified ? (
                  <span title="Verified in memory" className="text-emerald-500 flex items-center">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                ) : (
                  workspaceId && (
                    <button
                      onClick={() => handleConfirm(skill.name)}
                      disabled={isLoading}
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                      title="Confirm this skill"
                    >
                      {isLoading ? '...' : 'Confirm'}
                    </button>
                  )
                )}

                {workspaceId && (
                  <button
                    onClick={() => handleRemove(skill.name)}
                    disabled={isLoading}
                    className="opacity-40 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-opacity"
                    title="Remove skill"
                    aria-label={`Remove ${skill.name}`}
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
