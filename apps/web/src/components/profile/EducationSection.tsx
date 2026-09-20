'use client';

import React, { useState } from 'react';
import { EducationEntry, ProfileData, profileApi } from '@/lib/api-client';

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

      let updated: ProfileData;
      if (editId) {
        updated = await profileApi.updateEducation(editId, payload, workspaceId);
      } else {
        updated = await profileApi.addEducation(payload, workspaceId);
      }
      setIsEditing(false);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save education');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entryId: string, instName: string) => {
    if (!workspaceId) return;
    if (!window.confirm(`Are you sure you want to remove ${instName} from your education?`)) return;

    setLoading(true);
    setError(null);
    try {
      const updated = await profileApi.deleteEducation(entryId, workspaceId);
      onUpdate?.(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete education');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <span>Education & Degrees</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-surface-200 text-text-muted border border-border">
              {education.length}
            </span>
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Verified academic credentials used for ATS degree-matching algorithms
          </p>
        </div>
        {workspaceId && !isEditing && (
          <button
            onClick={openAdd}
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
            Add Degree
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      {isEditing && (
        <form
          onSubmit={handleSave}
          className="mb-6 p-4 rounded-xl border border-border bg-surface-200 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text">
              {editId ? 'Edit Degree' : 'Add Degree / Credential'}
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-text-muted hover:text-text text-xs"
            >
              Cancel
            </button>
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
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
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
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
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
              className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
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
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
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
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
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
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
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
              Honors, Awards & Activities (comma separated)
            </label>
            <input
              type="text"
              value={honorsText}
              onChange={(e) => setHonorsText(e.target.value)}
              placeholder="e.g. Summa Cum Laude, Dean's List, ACM ICPC Regional Finalist"
              className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface hover:bg-surface-hover text-text border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : editId ? 'Update Degree' : 'Add Degree'}
            </button>
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
            <button
              onClick={openAdd}
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
              Add First Degree
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {education.map((item, idx) => (
            <div
              key={item.id || idx}
              className="group p-4 rounded-xl bg-surface-200 border border-border hover:border-border-hover transition-colors flex items-start justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text text-sm">{item.institution}</span>
                  {item.graduationYear && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                      {item.startYear ? `${item.startYear} – ` : ''}
                      {item.graduationYear}
                    </span>
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
                      <span className="ml-2 text-emerald-500 font-medium">✓ Visible on Resume</span>
                    )}
                  </p>
                )}
                {item.honors && item.honors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.honors.map((h, hIdx) => (
                      <span
                        key={hIdx}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                      >
                        ★ {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {workspaceId && (
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1 rounded text-text-muted hover:text-text hover:bg-surface transition-colors"
                    title="Edit degree"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
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
                    onClick={() => handleDelete(item.id || item.institution, item.institution)}
                    className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-surface transition-colors"
                    title="Delete degree"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
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
          ))}
        </div>
      )}
    </div>
  );
}
