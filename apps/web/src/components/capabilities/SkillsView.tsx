'use client';

import React, { useState, useEffect } from 'react';
import { Button, EmptyState } from '@vaeloom/ui-kit';
import { CapabilityItem, saveCustomCapability } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';

interface SkillsViewProps {
  skills: CapabilityItem[];
  workspaceId: string;
  searchQuery?: string;
  onToggleSkill: (id: string) => void;
  onOpenCreate: () => void;
  onUpdateSkill?: (item: CapabilityItem) => void;
  onDeleteSkill?: (id: string) => void;
}

export const SkillsView: React.FC<SkillsViewProps> = ({
  skills,
  workspaceId,
  searchQuery = '',
  onToggleSkill,
  onOpenCreate,
  onUpdateSkill,
  onDeleteSkill,
}) => {
  const { toast } = useToast();
  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    skills[0]?.id || 'skill-acceptance-criteria-review',
  );
  const [sortBy, setSortBy] = useState<'most-used' | 'alphabetical' | 'recent'>('most-used');
  const [tabView, setTabView] = useState<'installed' | 'browse'>('installed');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Editable instruction state
  const [isEditing, setIsEditing] = useState(false);
  const [editedDoc, setEditedDoc] = useState('');

  const installedCount = skills.filter((s) => s.enabled).length;
  const browseCount = skills.filter((s) => !s.enabled).length;

  const effectiveQuery = searchQuery.trim().toLowerCase();
  const filteredSkills = skills.filter((item) => {
    if (tabView === 'installed' && !item.enabled) return false;
    if (tabView === 'browse' && item.enabled) return false;
    if (!effectiveQuery) return true;
    return (
      item.name.toLowerCase().includes(effectiveQuery) ||
      item.description.toLowerCase().includes(effectiveQuery) ||
      item.tags.some((t) => t.toLowerCase().includes(effectiveQuery))
    );
  });

  // Dynamic sorting based on sortBy selection
  const sortedSkills = [...filteredSkills].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'recent') {
      return (b.lastUsed || '').localeCompare(a.lastUsed || '');
    }
    return (b.usageCount || 0) - (a.usageCount || 0);
  });

  const selectedItem =
    sortedSkills.find((s) => s.id === selectedSkillId) || sortedSkills[0] || null;

  useEffect(() => {
    if (sortedSkills.length > 0) {
      if (!selectedSkillId || !sortedSkills.some((i) => i.id === selectedSkillId)) {
        setSelectedSkillId(sortedSkills[0]?.id || '');
      }
    } else {
      setSelectedSkillId('');
    }
  }, [sortedSkills, selectedSkillId]);

  // Sync instruction doc when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setEditedDoc(selectedItem.markdownDoc || '');
      setIsEditing(false);
    }
  }, [selectedItem?.id]);

  const handleCopyInstructions = () => {
    if (!selectedItem) return;
    const textToCopy = isEditing ? editedDoc : selectedItem.markdownDoc;
    navigator.clipboard.writeText(textToCopy);
    toast({ tone: 'info', title: `Copied instructions for ${selectedItem.name}` });
  };

  const handleSave = () => {
    if (!selectedItem) return;
    const updated: CapabilityItem = {
      ...selectedItem,
      markdownDoc: editedDoc,
    };
    saveCustomCapability(workspaceId, updated);
    if (onUpdateSkill) {
      onUpdateSkill(updated);
    }
    setIsEditing(false);
    toast({
      tone: 'success',
      title: `Saved instructions for ${selectedItem.name}`,
      detail: 'Changes persisted to workspace configuration.',
    });
  };

  const handleCancel = () => {
    if (selectedItem) {
      setEditedDoc(selectedItem.markdownDoc || '');
    }
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex min-h-0 bg-[#09090b] overflow-hidden">
      {/* Left Column: Capability List with 1 Most used sort */}
      <div
        className={`w-full lg:w-[320px] xl:w-[350px] shrink-0 border-r border-[#1c1d24] bg-[#0c0d10] flex flex-col min-h-0 ${
          mobileDetailOpen ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Top Toolbar */}
        <div className="p-3 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'most-used' | 'alphabetical' | 'recent')}
              className="bg-transparent border-0 text-xs font-sans text-[#8b8e99] hover:text-[#e4e4e7] focus:outline-none cursor-pointer"
            >
              <option value="most-used" className="bg-[#14151a] text-[#f4f4f5]">
                Most used
              </option>
              <option value="alphabetical" className="bg-[#14151a] text-[#f4f4f5]">
                Alphabetical
              </option>
              <option value="recent" className="bg-[#14151a] text-[#f4f4f5]">
                Recently used
              </option>
            </select>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-0.5 rounded bg-[#14151a] border border-[#23242c] text-xs font-sans">
                <button
                  type="button"
                  onClick={() => setTabView('installed')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    tabView === 'installed'
                      ? 'bg-[#22242e] text-[#f4f4f5] font-semibold'
                      : 'text-[#71717a] hover:text-[#d4d4d8]'
                  }`}
                >
                  Installed ({installedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTabView('browse')}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    tabView === 'browse'
                      ? 'bg-[#22242e] text-[#f4f4f5] font-semibold'
                      : 'text-[#71717a] hover:text-[#d4d4d8]'
                  }`}
                >
                  Browse ({browseCount})
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenCreate}
                aria-label="Create Skill"
                title="Create Skill"
                className="w-6 h-6 rounded bg-[#14151a] border border-[#252732] hover:bg-[#1c1e26] hover:text-white text-[#8b8e99] flex items-center justify-center transition-colors shrink-0"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Capability Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#17181f] p-1.5 space-y-0.5">
          {sortedSkills.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No skills found"
                description={`Try adjusting your search query or switching from "${tabView}" to "${
                  tabView === 'installed' ? 'Browse' : 'Installed'
                }".`}
              />
            </div>
          ) : (
            sortedSkills.map((item) => {
              const isSelected = item.id === selectedSkillId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedSkillId(item.id);
                    setMobileDetailOpen(true);
                  }}
                  className={`group relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-120 ${
                    isSelected
                      ? 'bg-[#181920] border border-[#2b2d39] shadow-xs'
                      : 'hover:bg-[#121318] border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-sans font-medium tracking-tight truncate ${
                          isSelected
                            ? 'text-white font-semibold'
                            : 'text-[#d4d4d8] group-hover:text-white'
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {item.source && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-2xs font-sans font-medium capitalize ${
                            item.source === 'custom'
                              ? 'bg-[#1c2233] text-[#93c5fd] border border-[#252f48]'
                              : item.source === 'learned'
                                ? 'bg-[#221c33] text-[#c4b5fd] border border-[#312548]'
                                : 'bg-[#181920] text-[#9ca3af] border border-[#272934]'
                          }`}
                        >
                          {item.source}
                        </span>
                      )}
                      {item.tags
                        ?.filter(
                          (t) =>
                            t.toLowerCase() !== item.source.toLowerCase() &&
                            t.toLowerCase() !== 'general' &&
                            t.toLowerCase() !== 'learned' &&
                            t.toLowerCase() !== 'built-in',
                        )
                        .slice(0, 2)
                        .map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded text-2xs font-sans font-medium bg-[#14151a] text-[#8b8e99] border border-[#23242c]"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.enabled}
                      aria-label={`Toggle ${item.name}`}
                      onClick={() => onToggleSkill(item.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        item.enabled ? 'bg-[#22c55e]' : 'bg-surface-active'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                          item.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Deep Detail Inspector */}
      <div
        className={`flex-1 flex flex-col min-h-0 bg-[#09090b] overflow-hidden ${
          mobileDetailOpen ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {selectedItem ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Detail Header & Action Links */}
            <div className="p-4 sm:p-5 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0 font-sans">
              <div className="flex flex-col gap-2">
                {/* Back button on mobile */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileDetailOpen(false)}
                    className="text-xs text-[#8b8e99] hover:text-white inline-flex items-center gap-1 mb-1"
                  >
                    <span>← Back to list</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white font-sans truncate">
                    {selectedItem.name}
                  </h2>
                  {selectedItem.source && (
                    <span
                      className={`px-1.5 py-0.5 text-2xs font-sans font-medium rounded capitalize ${
                        selectedItem.source === 'custom'
                          ? 'bg-[#1c2233] text-[#93c5fd] border border-[#252f48]'
                          : selectedItem.source === 'learned'
                            ? 'bg-[#221c33] text-[#c4b5fd] border border-[#312548]'
                            : 'bg-[#181920] text-[#9ca3af] border border-[#272934]'
                      }`}
                    >
                      {selectedItem.source}
                    </span>
                  )}
                  {selectedItem.tags
                    ?.filter(
                      (t) =>
                        t.toLowerCase() !== selectedItem.source.toLowerCase() &&
                        t.toLowerCase() !== 'general' &&
                        t.toLowerCase() !== 'learned' &&
                        t.toLowerCase() !== 'built-in',
                    )
                    .slice(0, 3)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-2xs font-sans font-medium rounded bg-[#14151a] text-[#8b8e99] border border-[#23242c]"
                      >
                        {tag}
                      </span>
                    ))}
                </div>

                <p className="text-xs text-[#8b8e99] leading-relaxed max-w-2xl mt-0.5 font-sans">
                  {selectedItem.description}
                </p>

                {/* Action Links Bar */}
                <div className="flex items-center gap-4 mt-2 text-xs font-sans font-medium">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="text-primary hover:text-primary-hover font-semibold transition-colors flex items-center gap-1"
                      >
                        <span>Save Changes</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="text-[#8b8e99] hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-[#8b8e99] hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleSkill(selectedItem.id)}
                        className="text-[#ef4444] hover:text-[#f87171] transition-colors"
                      >
                        {selectedItem.enabled ? 'Archive' : 'Restore'}
                      </button>
                      {onDeleteSkill &&
                        (selectedItem.source === 'custom' ||
                          selectedItem.id.startsWith('custom-')) && (
                          <button
                            type="button"
                            onClick={() => onDeleteSkill(selectedItem.id)}
                            className="text-[#71717a] hover:text-[#ef4444] transition-colors text-xs"
                          >
                            Delete
                          </button>
                        )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyInstructions}
                    title="Copy full instructions to clipboard"
                    className="text-[#8b8e99] hover:text-white transition-colors ml-auto text-2xs flex items-center gap-1"
                    aria-label="Copy full instructions"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Copy Spec</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Detail Content Body: Clean Monospace Instructions */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#09090b] min-h-0 space-y-3.5">
              {isEditing ? (
                <div className="rounded-xl border border-[#2c2f3d] bg-[#0c0d12] p-4 shadow-md space-y-3">
                  <div className="flex items-center justify-between text-2xs font-sans text-[#8b8e99] pb-2 border-b border-[#1c1d24]">
                    <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Editing Instructions (Markdown)
                    </span>
                    <span className="font-mono text-[#71717a]">
                      Ctrl+Enter to save • Esc to cancel
                    </span>
                  </div>
                  <textarea
                    value={editedDoc}
                    onChange={(e) => setEditedDoc(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      } else if (e.key === 'Escape') {
                        handleCancel();
                      }
                    }}
                    aria-label="Skill Instructions"
                    rows={20}
                    className="w-full font-mono text-xs text-[#f4f4f5] bg-[#08090c] border border-[#1f212a] focus:border-primary focus:ring-1 focus:ring-primary/30 rounded-lg p-3.5 leading-relaxed outline-none resize-y"
                    placeholder="# Enter skill rules, triggers and instructions in markdown..."
                  />
                  <div className="flex items-center justify-between pt-1 text-2xs font-sans">
                    <span className="text-[#71717a] font-mono">
                      {editedDoc.split('\n').length} lines • {editedDoc.length} characters
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancel}
                        className="text-xs font-sans"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSave}
                        className="text-xs font-sans font-medium shadow-xs"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[#1e2028] bg-[#0c0d12] p-4 sm:p-5 shadow-xs">
                  <pre className="font-mono text-xs text-[#d4d4d8] leading-relaxed whitespace-pre-wrap select-text font-normal">
                    {selectedItem.markdownDoc}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <EmptyState
              title="Select a skill"
              description="Select a skill from the list to view its operating rules, mission, and documentation."
            />
          </div>
        )}
      </div>
    </div>
  );
};
