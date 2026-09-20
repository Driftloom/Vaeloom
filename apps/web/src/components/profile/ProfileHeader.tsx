'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
  ProfileData,
  ProfileImportSummaryData,
  UpdateProfileData,
  profileApi,
} from '@/lib/api-client';
import { Avatar } from '@/components/shared/Avatar';
import {
  Badge,
  Button,
  CalendarIcon,
  CheckIcon,
  EditIcon,
  LockIcon,
  SparklesIcon,
  UploadIcon,
} from '@vaeloom/ui-kit';

// ------------------------------------------------------------------
// Import Profile Modal
// ------------------------------------------------------------------
interface ImportProfileModalProps {
  workspaceId: string;
  onImported: (data: ProfileImportSummaryData) => void;
  onClose: () => void;
}

function ImportProfileModal({ workspaceId, onImported, onClose }: ImportProfileModalProps) {
  const [tab, setTab] = useState<'resume' | 'linkedin' | 'workspace'>('resume');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      setError('Only PDF, DOCX, or TXT files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  const handleResumeImport = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await profileApi.importResume(selectedFile, workspaceId);
      onImported(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkedInImport = async () => {
    if (!linkedinUrl.startsWith('https://www.linkedin.com/')) {
      setError('Enter a valid linkedin.com profile URL.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await profileApi.importLinkedIn(linkedinUrl, workspaceId);
      onImported(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSync = async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await profileApi.autoPopulate(workspaceId);
      onImported({
        skillsImported: 0,
        careerImported: 0,
        educationImported: 0,
        message: 'Synced from workspace resume.',
        profile: updated,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'resume' as const, label: 'Upload Resume' },
    { key: 'linkedin' as const, label: 'LinkedIn URL' },
    { key: 'workspace' as const, label: 'Workspace Sync' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <SparklesIcon size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-text">Import Your Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-background hover:text-text transition-colors"
            aria-label="Close import modal"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border px-6 bg-background/50">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setError('');
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
              {error}
            </div>
          )}

          {/* Resume Upload */}
          {tab === 'resume' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Upload your resume (PDF, DOCX, or TXT) and Vaeloom will extract your skills,
                experience, and education automatically.
              </p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : selectedFile
                      ? 'border-success/50 bg-success/5'
                      : 'border-border hover:border-primary/50 hover:bg-background'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <UploadIcon size={28} className={selectedFile ? 'text-success' : 'text-text-dim'} />
                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-text">{selectedFile.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {(selectedFile.size / 1024).toFixed(0)} KB • Click to change
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-text">Drop your resume here</p>
                    <p className="text-xs text-text-muted mt-0.5">PDF, DOCX, or TXT • Max 10 MB</p>
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleResumeImport}
                loading={loading}
                disabled={!selectedFile || loading}
                className="w-full"
              >
                <SparklesIcon size={14} className="mr-1.5" />
                Extract & Import Profile
              </Button>
            </div>
          )}

          {/* LinkedIn URL */}
          {tab === 'linkedin' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Paste your LinkedIn profile URL to auto-import your name, headline, location, and
                skills.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-text-dim">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/your-profile"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-dim focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs">
                Note: LinkedIn limits public data access. For best results, ensure your profile
                privacy allows public viewing.
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleLinkedInImport}
                loading={loading}
                disabled={!linkedinUrl || loading}
                className="w-full"
              >
                <SparklesIcon size={14} className="mr-1.5" />
                Import from LinkedIn
              </Button>
            </div>
          )}

          {/* Workspace Sync */}
          {tab === 'workspace' && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                Sync your profile from resumes and documents already uploaded to your workspace.
                Vaeloom&apos;s AI will extract and populate your profile fields automatically.
              </p>
              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <SparklesIcon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">AI-Powered Extraction</p>
                    <p className="text-xs text-text-muted">
                      Reads all your workspace documents and applies LLM extraction
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <CheckIcon size={16} className="text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">Non-Destructive</p>
                    <p className="text-xs text-text-muted">
                      Merges with existing data — nothing is overwritten without confirmation
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleWorkspaceSync}
                loading={loading}
                disabled={loading}
                className="w-full"
              >
                <SparklesIcon size={14} className="mr-1.5" />
                Sync from Workspace
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Import Success Toast
// ------------------------------------------------------------------
interface ImportSuccessProps {
  data: ProfileImportSummaryData;
  onClose: () => void;
}

function ImportSuccessToast({ data, onClose }: ImportSuccessProps) {
  return (
    <div className="mt-3 p-3 rounded-xl bg-success/10 border border-success/30 text-sm animate-fadeIn">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CheckIcon size={16} className="text-success mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-success">Profile imported successfully!</p>
            <p className="text-text-muted text-xs mt-0.5">{data.message}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {data.skillsImported > 0 && (
                <Badge variant="success" size="sm">
                  {data.skillsImported} skills
                </Badge>
              )}
              {data.careerImported > 0 && (
                <Badge variant="primary" size="sm">
                  {data.careerImported} career entries
                </Badge>
              )}
              {data.educationImported > 0 && (
                <Badge variant="info" size="sm">
                  {data.educationImported} education entries
                </Badge>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text text-xs shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main ProfileHeader
// ------------------------------------------------------------------
interface ProfileHeaderProps {
  profile: ProfileData;
  workspaceId: string;
  onUpdate: (updated: ProfileData) => void;
}

export default function ProfileHeader({ profile, workspaceId, onUpdate }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [headline, setHeadline] = useState(profile.headline || '');
  const [location, setLocation] = useState(profile.location || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSuccess, setImportSuccess] = useState<ProfileImportSummaryData | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: UpdateProfileData = { display_name: displayName, headline, location };
      const updated = await profileApi.update(data, workspaceId);
      onUpdate(updated);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImported = (data: ProfileImportSummaryData) => {
    setShowImportModal(false);
    onUpdate(data.profile);
    setDisplayName(data.profile.displayName || '');
    setHeadline(data.profile.headline || '');
    setLocation(data.profile.location || '');
    setImportSuccess(data);
    setTimeout(() => setImportSuccess(null), 8000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        const { avatarUrl } = await profileApi.uploadAvatar(e.target.files[0]);
        const updated = await profileApi.update({ avatar_url: avatarUrl }, workspaceId);
        onUpdate(updated);
      } catch (err) {
        console.error('Avatar upload failed', err);
      }
    }
  };

  return (
    <>
      {showImportModal && (
        <ImportProfileModal
          workspaceId={workspaceId}
          onImported={handleImported}
          onClose={() => setShowImportModal(false)}
        />
      )}

      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs mb-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start gap-6 relative">
          {/* Avatar */}
          <div className="relative group cursor-pointer shrink-0">
            <Avatar
              src={profile.avatarUrl}
              alt={profile.displayName || 'User profile'}
              fallback={profile.displayName?.[0] || '?'}
              className="w-24 h-24 text-3xl ring-2 ring-border/80 shadow-md"
            />
            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-full text-white cursor-pointer transition-opacity duration-200">
              <UploadIcon size={18} className="mb-0.5" />
              <span className="text-2xs font-medium tracking-wide uppercase">Change</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 w-full">
            {isEditing ? (
              <div className="space-y-4 max-w-lg animate-fadeIn">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Alex Morgan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1">
                    Professional Headline
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. Staff AI Systems Engineer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. San Francisco, CA (Remote)"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving}>
                    Save Profile
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-display font-medium text-text truncate">
                      {profile.displayName || 'Anonymous User'}
                    </h1>
                    <Badge variant="default" size="sm">
                      <CheckIcon size={12} className="mr-1 text-primary" />
                      Verified Identity
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowImportModal(true)}
                      className="border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <SparklesIcon size={14} className="mr-1.5 text-primary" />
                      Import Profile
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                      <EditIcon size={14} className="mr-1.5" />
                      Edit Profile
                    </Button>
                  </div>
                </div>

                {/* Import success toast */}
                {importSuccess && (
                  <ImportSuccessToast data={importSuccess} onClose={() => setImportSuccess(null)} />
                )}

                {/* Headline */}
                <div className="mt-2 text-base text-text-muted">
                  {profile.headline || (
                    <span className="italic text-text-dim">
                      No headline set. Click Edit to add one.
                    </span>
                  )}
                </div>

                {/* Metadata row */}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-text-dim">
                  {profile.location && (
                    <div className="flex items-center gap-1.5">
                      <svg
                        className="w-3.5 h-3.5 text-text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>{profile.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon size={14} className="text-text-muted" />
                    <span>Member since {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <LockIcon size={13} className="text-text-muted" />
                    <span>Workspace Protected</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
