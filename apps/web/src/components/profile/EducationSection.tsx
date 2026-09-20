'use client';

import React, { useState } from 'react';
import { EducationEntry, ProfileData, profileApi } from '@/lib/api-client';
import { Panel } from '@/components/shared/Panel';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Badge, Button, EditIcon, IconButton, PlusIcon, TrashIcon } from '@vaeloom/ui-kit';

interface EducationSectionProps {
  education: EducationEntry[];
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function EducationSection({
  education = [],
  workspaceId,
  onUpdate,
}: EducationSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [institution, setInstitution] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startYear, setStartYear] = useState<string>('');
  const [graduationYear, setGraduationYear] = useState<string>('');
  const [gpa, setGpa] = useState('');
  const [showGpa, setShowGpa] = useState(false);
  const [honorsText, setHonorsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => {
    setEditId(null);
    setInstitution('');
    setDegree('');
    setFieldOfStudy('');
    setStartYear('');
    setGraduationYear('');
    setGpa('');
    setShowGpa(false);
    setHonorsText('');
    setError(null);
    setIsEditing(true);
  };

  const openEdit = (entry: EducationEntry) => {
    setEditId(entry.id || entry.institution);
    setInstitution(entry.institution);
    setDegree(entry.degree);
    setFieldOfStudy(entry.fieldOfStudy);
    setStartYear(entry.startYear ? String(entry.startYear) : '');
    setGraduationYear(entry.graduationYear ? String(entry.graduationYear) : '');
    setGpa(entry.gpa || '');
    setShowGpa(entry.showGpaOnResume ?? false);
    setHonorsText((entry.honors || []).join(', '));
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !institution.trim() || !degree.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const honors = honorsText
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      const payload = {
        institution: institution.trim(),
        degree: degree.trim(),
        fieldOfStudy: fieldOfStudy.trim(),
        startYear: startYear ? parseInt(startYear, 10) : null,
        graduationYear: graduationYear ? parseInt(graduationYear, 10) : null,
        gpa: gpa.trim() || null,
        showGpaOnResume: showGpa,
        honors,
      };
      const updated = editId
        ? await profileApi.updateEducation(editId, payload, workspaceId)
        : await profileApi.addEducation(payload, workspaceId);
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save education');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !workspaceId) return;
    setDeleting(true);
    try {
      const updated = await profileApi.deleteEducation(deleteTarget.id, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete education');
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
        title="Remove Education Entry"
        message={`Are you sure you want to remove ${deleteTarget?.name} from your education history?`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        loading={deleting}
      />

      <Panel className="mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text flex items-center gap-2">
              Education &amp; Degrees
              <Badge variant="default" size="sm">
                {education.length}
              </Badge>
            </h2>
            <p className="text-xs text-text-dim mt-0.5">
              Verified academic credentials used for ATS degree-matching algorithms
            </p>
          </div>
          {workspaceId && !isEditing && (
            <Button variant="secondary" size="sm" onClick={openAdd}>
              <PlusIcon size={13} className="mr-1.5" />
              Add Degree
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-error/10 border border-error/20 text-xs text-error">
            {error}
          </div>
        )}

        {isEditing && (
          <form
            onSubmit={handleSave}
            className="mb-6 p-4 rounded-xl border border-border bg-background space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-text">
                {editId ? 'Edit Degree' : 'Add Degree / Credential'}
              </h3>
              <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Institution / University *
                </label>
                <input
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Stanford University, IIT Bombay"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Degree Level *
                </label>
                <input
                  type="text"
                  required
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="e.g. Bachelor of Science, Master of Science"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Field of Study / Major
              </label>
              <input
                type="text"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="e.g. Computer Science, Electrical Engineering"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Start Year</label>
                <input
                  type="number"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  placeholder="e.g. 2018"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Graduation Year
                </label>
                <input
                  type="number"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2022"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  GPA (Optional)
                </label>
                <input
                  type="text"
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                  placeholder="e.g. 3.9 / 4.0"
                  className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showGpa"
                checked={showGpa}
                onChange={(e) => setShowGpa(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="showGpa" className="text-xs text-text-muted cursor-pointer">
                Show GPA on tailored resumes
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Honors, Awards &amp; Activities (comma separated)
              </label>
              <input
                type="text"
                value={honorsText}
                onChange={(e) => setHonorsText(e.target.value)}
                placeholder="e.g. Summa Cum Laude, Dean's List, ACM ICPC Regional Finalist"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary"
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
              <Button variant="primary" size="sm" type="submit" loading={loading}>
                {editId ? 'Update Degree' : 'Add Degree'}
              </Button>
            </div>
          </form>
        )}

        {education.length === 0 && !isEditing ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl">
            <p className="text-text-muted text-sm mb-3">
              Add your degrees and academic history so autonomous agents can satisfy ATS education
              requirements
            </p>
            {workspaceId && (
              <Button variant="primary" size="sm" onClick={openAdd}>
                <PlusIcon size={13} className="mr-1.5" />
                Add First Degree
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {education.map((item, idx) => (
              <div
                key={item.id || idx}
                className="group p-4 rounded-xl bg-background border border-border hover:border-border-hover transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-text text-sm">{item.institution}</span>
                    {item.graduationYear && (
                      <Badge variant="default" size="sm">
                        {item.startYear ? `${item.startYear} – ` : ''}
                        {item.graduationYear}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    <span className="font-medium text-text">{item.degree}</span>
                    {item.fieldOfStudy ? ` • ${item.fieldOfStudy}` : ''}
                  </p>
                  {item.gpa && (
                    <p className="text-[11px] text-text-dim">
                      GPA: <span className="text-text font-medium">{item.gpa}</span>
                      {item.showGpaOnResume && (
                        <Badge variant="success" size="sm" className="ml-2">
                          Visible on Resume
                        </Badge>
                      )}
                    </p>
                  )}
                  {item.honors && item.honors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.honors.map((h, hIdx) => (
                        <Badge key={hIdx} variant="primary" size="sm">
                          ★ {h}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {workspaceId && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      aria-label="Edit degree"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(item)}
                    >
                      <EditIcon size={13} />
                    </IconButton>
                    <IconButton
                      aria-label="Delete degree"
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setDeleteTarget({ id: item.id || item.institution, name: item.institution })
                      }
                    >
                      <TrashIcon size={13} />
                    </IconButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
