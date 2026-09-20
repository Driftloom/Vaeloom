'use client';

import React, { useState } from 'react';
import { ProfileData, UpdateProfileData, profileApi } from '@/lib/api-client';
import { Panel, Badge, Button, SparklesIcon, EditIcon } from '@vaeloom/ui-kit';

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
    <Panel
      padding="lg"
      className="mb-6"
      header={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-text">About Me & Professional Bio</h2>
            {!isEditing && !profile.bio && (
              <Badge variant="info" size="sm">
                <SparklesIcon size={12} className="mr-1" />
                Synthesized from Memory Graph
              </Badge>
            )}
            {!isEditing && profile.bio && (
              <Badge variant="default" size="sm">
                Customized
              </Badge>
            )}
          </div>
          {!isEditing && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              <EditIcon size={13} className="mr-1.5" />
              Edit Bio
            </Button>
          )}
        </div>
      }
    >
      {isEditing ? (
        <div className="space-y-4">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            className="w-full bg-background border border-border rounded-xl p-3.5 text-text focus:outline-none focus:ring-1 focus:ring-primary text-sm leading-relaxed resize-y"
            placeholder="Write a concise overview of your background, passions, and expertise..."
          />
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} loading={isSaving}>
              Save Bio
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-text-muted leading-relaxed whitespace-pre-wrap text-sm">
          {profile.bio || (
            <span className="italic text-text-dim">
              No bio recorded yet. Auto-populate from your resume or click Edit Bio above to write
              one.
            </span>
          )}
        </div>
      )}
    </Panel>
  );
}
