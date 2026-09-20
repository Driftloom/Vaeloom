'use client';

import React, { useState, useMemo } from 'react';
import { SkillItem, ProfileData, profileApi } from '@/lib/api-client';
import { Panel, Badge, Button, PlusIcon, XIcon, CheckIcon } from '@vaeloom/ui-kit';

interface SkillsShowcaseProps {
  skills: SkillItem[];
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

const CATEGORIES = [
  'All',
  'Languages',
  'Frameworks',
  'Cloud & DevOps',
  'Databases',
  'AI & Machine Learning',
  'Tools & Core',
];

export default function SkillsShowcase({
  skills = [],
  workspaceId,
  onUpdate,
}: SkillsShowcaseProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  const filteredSkills = useMemo(() => {
    if (selectedCategory === 'All') return skills;
    return skills.filter((s) => (s.category || 'Tools & Core') === selectedCategory);
  }, [skills, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: skills.length };
    skills.forEach((s) => {
      const cat = s.category || 'Tools & Core';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [skills]);

  return (
    <Panel
      padding="lg"
      className="mb-6"
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-text">Skills & Competencies Matrix</h2>
            <Badge variant="default" size="sm">
              {skills.length} Total
            </Badge>
          </div>
          {workspaceId && !isAdding && (
            <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
              <PlusIcon size={14} className="mr-1" />+ Add Skill
            </Button>
          )}
        </div>
      }
    >
      <p className="text-xs text-text-muted mb-4">
        Vaeloom organizes your capabilities into categorized matrix tiers. Verified skills are
        reinforced in your permanent agent memory.
      </p>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error">
          {error}
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-border">
        {CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] || 0;
          if (cat !== 'All' && count === 0) return null;
          const selected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                selected
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-hover'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selected ? 'bg-white/20 text-white' : 'bg-surface-hover text-text-dim'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isAdding && (
        <form
          onSubmit={handleAddSkill}
          className="mb-4 flex items-center gap-2 p-3 bg-surface border border-border rounded-xl"
        >
          <input
            type="text"
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="e.g. Next.js, Rust, Kubernetes, PyTorch..."
            autoFocus
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={loadingSkill === '__new__'}
            disabled={!newSkillName.trim()}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewSkillName('');
            }}
          >
            Cancel
          </Button>
        </form>
      )}

      {(!skills || skills.length === 0) && !isAdding ? (
        <div className="p-8 text-center border border-dashed border-border rounded-xl bg-surface/50">
          <p className="text-xs text-text-muted mb-3">
            Connect sources or add skills to let Vaeloom personalize your agent workflows
          </p>
          {workspaceId && (
            <Button variant="primary" size="sm" onClick={() => setIsAdding(true)}>
              <PlusIcon size={14} className="mr-1" />+ Add First Skill
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {filteredSkills.map((skill, i) => {
            let dotColor = 'bg-text-dim';
            if (skill.verified || skill.confidence >= 0.9) dotColor = 'bg-success';
            else if (skill.confidence >= 0.7) dotColor = 'bg-warning';

            const isLoading = loadingSkill === skill.name;
            const tier = skill.validationTier || (skill.verified ? 'V1' : 'V0');
            const decay = skill.decayStatus || 'fresh';

            return (
              <div
                key={i}
                className="group inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-surface border border-border text-xs hover:border-border/80 transition-all shadow-xs"
                title={`Category: ${skill.category || 'General'} | Tier: ${tier} | Status: ${decay} | Effective: ${Math.round((skill.effectiveConfidence ?? skill.confidence) * 100)}%`}
              >
                <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                <span className="font-medium text-text">{skill.name}</span>

                {skill.proficiency && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-background border border-border text-text-dim">
                    {skill.proficiency}
                  </span>
                )}

                <Badge variant="default" size="sm" className="text-[10px] font-mono py-0 px-1.5">
                  {tier}
                </Badge>

                {decay !== 'fresh' && (
                  <span className="text-[10px] font-medium text-warning">• {decay}</span>
                )}

                {skill.verified ? (
                  <span title="Verified in memory" className="text-success flex items-center">
                    <CheckIcon size={13} />
                  </span>
                ) : (
                  workspaceId && (
                    <button
                      onClick={() => handleConfirm(skill.name)}
                      disabled={isLoading}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
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
                    className="opacity-40 group-hover:opacity-100 hover:text-error p-0.5 rounded transition-opacity"
                    title="Remove skill"
                    aria-label={`Remove ${skill.name}`}
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
