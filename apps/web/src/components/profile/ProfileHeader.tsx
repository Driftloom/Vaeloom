import React, { useState } from 'react';
import { ProfileData, UpdateProfileData, profileApi } from '@/lib/api-client';
import { Avatar } from '@/components/shared/Avatar';

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
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateSuccess, setPopulateSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: UpdateProfileData = {
        display_name: displayName,
        headline,
        location,
      };
      const updated = await profileApi.update(data, workspaceId);
      onUpdate(updated);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoPopulate = async () => {
    setIsPopulating(true);
    try {
      const updated = await profileApi.autoPopulate(workspaceId);
      onUpdate(updated);
      setDisplayName(updated.displayName || '');
      setHeadline(updated.headline || '');
      setLocation(updated.location || '');
      setPopulateSuccess(true);
      setTimeout(() => setPopulateSuccess(false), 4000);
    } catch (e) {
      console.error('Auto-populate failed:', e);
    } finally {
      setIsPopulating(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
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
    <div className="card mb-6">
      <div className="flex items-start gap-6">
        <div className="relative group cursor-pointer shrink-0">
          <Avatar
            src={profile.avatarUrl}
            alt={profile.displayName || 'User profile'}
            fallback={profile.displayName?.[0] || '?'}
            className="w-24 h-24 text-3xl"
          />
          <label className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center rounded-full text-white cursor-pointer transition-opacity">
            <span className="text-xs font-medium">Upload</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </label>
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-surface-active border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full bg-surface-active border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-surface-active border border-border rounded-lg px-3 py-2 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. San Francisco, CA"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-border text-text rounded-lg hover:bg-surface-hover text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-display font-semibold text-text truncate">
                  {profile.displayName || 'Anonymous User'}
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleAutoPopulate}
                    disabled={isPopulating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors disabled:opacity-50"
                    title="Extract headline, bio, skills, and career history from workspace resume"
                  >
                    {isPopulating ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          ></path>
                        </svg>
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>Auto-Populate from Resume</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-text-muted hover:text-text px-3 py-1.5 rounded-md hover:bg-surface-hover text-sm font-medium transition-colors"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>

              {populateSuccess && (
                <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>
                    Profile, skills, and career memories successfully synced from your resume!
                  </span>
                </div>
              )}

              <div className="mt-2 text-lg text-text-muted">
                {profile.headline || 'Add a headline'}
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-text-dim">
                {profile.location && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    {profile.location}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
