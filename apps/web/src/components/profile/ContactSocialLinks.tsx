import React, { useState } from 'react';
import { ProfileData, UpdateProfileData, profileApi } from '@/lib/api-client';

interface ContactSocialLinksProps {
  profile: ProfileData;
  workspaceId: string;
  onUpdate: (updated: ProfileData) => void;
}

export default function ContactSocialLinks({
  profile,
  workspaceId,
  onUpdate,
}: ContactSocialLinksProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(profile.phone || '');
  const [github, setGithub] = useState(profile.socialLinks?.['github'] || '');
  const [linkedin, setLinkedin] = useState(profile.socialLinks?.['linkedin'] || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: UpdateProfileData = {
        phone,
        social_links: {
          ...profile.socialLinks,
          github,
          linkedin,
        },
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

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Contact & Links</h2>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-hover"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
            <input
              type="text"
              value={profile.email}
              disabled
              className="w-full bg-surface-200 border border-border rounded-lg px-3 py-2 text-text-dim cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface-active border border-border rounded-lg px-3 py-2 text-text focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">GitHub URL</label>
            <input
              type="text"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="w-full bg-surface-active border border-border rounded-lg px-3 py-2 text-text focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">LinkedIn URL</label>
            <input
              type="text"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="w-full bg-surface-active border border-border rounded-lg px-3 py-2 text-text focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Links'}
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
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <svg
              className="w-5 h-5 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <span className="text-text">{profile.email}</span>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-3 text-sm">
              <svg
                className="w-5 h-5 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span className="text-text">{profile.phone}</span>
            </div>
          )}
          {profile.socialLinks?.['github'] && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
              <a
                href={profile.socialLinks['github']}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline truncate"
              >
                {profile.socialLinks['github']}
              </a>
            </div>
          )}
          {profile.socialLinks?.['linkedin'] && (
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <a
                href={profile.socialLinks['linkedin']}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline truncate"
              >
                {profile.socialLinks['linkedin']}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
