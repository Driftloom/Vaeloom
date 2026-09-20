'use client';

import React, { useState } from 'react';
import { CareerEntry, ProfileData, profileApi } from '@/lib/api-client';
import { Panel } from '@/components/shared/Panel';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Badge, Button, EditIcon, IconButton, PlusIcon, TrashIcon } from '@vaeloom/ui-kit';

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
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [isCurrent, setIsCurrent] = useState(false);
  const [achievementsText, setAchievementsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => {
    setEditCompany(null);
    setRole('');
    setCompany('');
    setStartDate('');
    setEndDate('');
    setLocation('');
    setEmploymentType('Full-time');
    setIsCurrent(false);
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
    setLocation(entry.location || '');
    setEmploymentType(entry.employmentType || 'Full-time');
    setIsCurrent(entry.isCurrent ?? (!entry.endDate || entry.endDate.toLowerCase() === 'present'));
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
      const resolvedEndDate = isCurrent ? 'Present' : endDate.trim() || undefined;
      const payload = {
        role: role.trim(),
        startDate: startDate.trim() || undefined,
        endDate: resolvedEndDate,
        achievements,
        location: location.trim() || undefined,
        employmentType,
        isCurrent,
      };
      const updated = editCompany
        ? await profileApi.updateCareer(editCompany, payload, workspaceId)
        : await profileApi.addCareer({ company: company.trim(), ...payload }, workspaceId);
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save career experience');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !workspaceId) return;
    setDeleting(true);
    try {
      const updated = await profileApi.deleteCareer(deleteTarget, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete career position');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Career Entry"
        message={`Are you sure you want to remove ${deleteTarget} from your career history? This will also remove the associated memory record.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        loading={deleting}
      />

      <Panel className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              Work Experience &amp; Career History
              {yearsExperience != null && (
                <Badge variant="primary" size="sm">
                  {yearsExperience} yrs total
                </Badge>
              )}
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Career trajectory and impact metrics used to tailor resumes and applications
            </p>
          </div>
          {workspaceId && !isEditing && (
            <Button variant="secondary" size="sm" onClick={openAdd}>
              <PlusIcon size={13} className="mr-1.5" />
              Add Experience
            </Button>
          )}
        </div>

        {/* Edit / Add Form */}
        {isEditing && (
          <form
            onSubmit={handleSave}
            className="mb-6 p-4 border border-border rounded-xl bg-background space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-text">
                {editCompany ? `Edit Experience at ${editCompany}` : 'Add New Career Experience'}
              </h3>
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>

            {error && <p className="text-xs text-error">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Company *</label>
                <input
                  type="text"
                  required
                  disabled={!!editCompany}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Stripe, OpenAI"
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
                  placeholder="e.g. Staff Software Engineer"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA (or Remote)"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Employment Type
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Contract">Contract / Consultant</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Internship">Internship</option>
                </select>
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
                  disabled={isCurrent}
                  value={isCurrent ? 'Present' : endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="e.g. 2023-11"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCurrentRole"
                checked={isCurrent}
                onChange={(e) => {
                  setIsCurrent(e.target.checked);
                  if (e.target.checked) setEndDate('Present');
                }}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <label
                htmlFor="isCurrentRole"
                className="text-xs font-medium text-text cursor-pointer"
              >
                I currently work here (protects from agent auto-apply)
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Key Achievements &amp; Impacts (one per line)
              </label>
              <textarea
                rows={3}
                value={achievementsText}
                onChange={(e) => setAchievementsText(e.target.value)}
                placeholder={
                  'Architected distributed event pipeline handling 2M events/sec\nMentored 4 engineers and improved release velocity by 35%'
                }
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary resize-y"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={saving}>
                {editCompany ? 'Update Position' : 'Save Position'}
              </Button>
            </div>
          </form>
        )}

        {/* Empty state */}
        {(!careerHistory || careerHistory.length === 0) && !isEditing ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl">
            <p className="text-text-muted text-sm mb-3">
              Add your career history so agents can tailor resumes and populate application work
              history sections
            </p>
            {workspaceId && (
              <Button variant="primary" size="sm" onClick={openAdd}>
                <PlusIcon size={13} className="mr-1.5" />
                Add First Experience
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {careerHistory.map((roleEntry, idx) => {
              const isCurr =
                roleEntry.isCurrent ||
                !roleEntry.endDate ||
                roleEntry.endDate.toLowerCase() === 'present';
              return (
                <div key={idx} className="relative pl-6 border-l-2 border-border group">
                  <div
                    className={`absolute w-3 h-3 rounded-full -left-[7px] top-1.5 ${isCurr ? 'bg-success' : 'bg-primary'}`}
                  />

                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text">{roleEntry.role}</h3>
                        {isCurr && (
                          <Badge variant="success" size="sm">
                            Current
                          </Badge>
                        )}
                        {roleEntry.employmentType && (
                          <Badge variant="default" size="sm">
                            {roleEntry.employmentType}
                          </Badge>
                        )}
                      </div>
                      <div className="text-primary font-medium text-xs flex items-center gap-2 mt-0.5">
                        <span>{roleEntry.company}</span>
                        {roleEntry.location && (
                          <span className="text-text-dim font-normal">• {roleEntry.location}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-xs text-text-muted text-right">
                        <div>
                          {roleEntry.startDate || 'Unknown'} – {roleEntry.endDate || 'Present'}
                        </div>
                        {roleEntry.confidence < 0.8 && (
                          <Badge variant="warning" size="sm" className="mt-1">
                            Inferred
                          </Badge>
                        )}
                      </div>
                      {workspaceId && !isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <IconButton
                            aria-label="Edit position"
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(roleEntry)}
                          >
                            <EditIcon size={13} />
                          </IconButton>
                          <IconButton
                            aria-label="Delete position"
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteTarget(roleEntry.company)}
                          >
                            <TrashIcon size={13} />
                          </IconButton>
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
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
