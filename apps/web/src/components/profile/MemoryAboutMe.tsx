import React, { useState } from 'react';
import { ProfileData, UpdateProfileData, profileApi } from '@/lib/api-client';

interface MemoryAboutMeProps {
  profile: ProfileData;
  workspaceId: string;
  onUpdate: (updated: ProfileData) => void;
}

export default function MemoryAboutMe({ profile, workspaceId, onUpdate }: MemoryAboutMeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data: UpdateProfileData = { bio };
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
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-text">About Me</h2>
          {!isEditing && !profile.bio && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded border border-primary/20">
              ✨ Generated from your memory graph
            </span>
          )}
          {!isEditing && profile.bio && (
            <span className="px-2 py-0.5 text-xs font-medium bg-surface-200 text-text-muted rounded border border-border">
              Custom
            </span>
          )}
        </div>
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
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            className="w-full bg-surface-active border border-border rounded-lg p-3 text-text focus:ring-1 focus:ring-primary text-sm resize-y"
            placeholder="Write a little about yourself..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Bio'}
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
        <div className="text-text-muted leading-relaxed whitespace-pre-wrap text-sm">
          {profile.bio || (
            <span className="italic text-text-dim">
              No bio available. Add a resume or write something about yourself.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
