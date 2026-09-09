'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { profileApi } from '@/lib/api-client';
import { Tabs, TabPanel } from '@/components/shared/Tabs';

import ProfileHeader from '@/components/profile/ProfileHeader';
import SkillsShowcase from '@/components/profile/SkillsShowcase';
import CareerSummary from '@/components/profile/CareerSummary';
import ContactSocialLinks from '@/components/profile/ContactSocialLinks';
import ProfileCompleteness from '@/components/profile/ProfileCompleteness';
import MemoryAboutMe from '@/components/profile/MemoryAboutMe';
import ConnectedSources from '@/components/profile/ConnectedSources';
import JobPreferences from '@/components/profile/JobPreferences';
import CareerTimeline from '@/components/profile/CareerTimeline';
import ATSReadiness from '@/components/profile/ATSReadiness';
import AgentInsights from '@/components/profile/AgentInsights';
import { WhatVaeloomKnows } from '@/components/profile/WhatVaeloomKnows';
import { RecentActivity } from '@/components/profile/RecentActivity';
import { AchievementsCertificates } from '@/components/profile/AchievementsCertificates';
import { ProfileExport } from '@/components/profile/ProfileExport';
import { ThemePreferences } from '@/components/profile/ThemePreferences';

export default function ProfilePage() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string) || '';
  const [activeTab, setActiveTab] = useState('overview');

  const {
    data: profile,
    error: profileError,
    mutate: mutateProfile,
  } = useSWR(workspaceId ? ['profile', workspaceId] : null, () => profileApi.get(workspaceId));

  const { data: completeness } = useSWR(
    workspaceId ? ['profile-completeness', workspaceId] : null,
    () => profileApi.completeness(workspaceId),
  );

  const memoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (profile?.memorySummary ?? []).forEach((item) => {
      map[item.type] = item.count;
    });
    return {
      profileCount: map['profile'] ?? 0,
      documentCount: map['document'] ?? 0,
      careerCount: map['career'] ?? 0,
      episodicCount: map['episodic'] ?? 0,
      preferenceCount: map['preference'] ?? 0,
      workingCount: map['working'] ?? 0,
    };
  }, [profile?.memorySummary]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'memory_activity', label: 'Memory & Activity' },
    { id: 'settings', label: 'Appearance & Export' },
  ];

  if (profileError) {
    return (
      <div className="p-8 text-center text-red-500">
        <p className="font-medium">Failed to load profile.</p>
        <p className="text-sm text-text-muted mt-1">
          {profileError.message || 'Please try again later.'}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-48 bg-surface rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 bg-surface rounded-xl" />
            <div className="h-64 bg-surface rounded-xl" />
          </div>
          <div className="space-y-6">
            <div className="h-48 bg-surface rounded-xl" />
            <div className="h-48 bg-surface rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <ProfileHeader
        profile={profile}
        workspaceId={workspaceId}
        onUpdate={(updated) => mutateProfile(updated, false)}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <TabPanel id="overview" activeTab={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          <div className="lg:col-span-2 space-y-6">
            <AgentInsights
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <MemoryAboutMe
              profile={profile}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <SkillsShowcase
              skills={profile.skills}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <CareerSummary
              careerHistory={profile.careerHistory}
              yearsExperience={profile.yearsExperience}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <JobPreferences
              preferences={profile.jobPreferences}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
          </div>

          <div className="space-y-6">
            {completeness && <ProfileCompleteness data={completeness} />}
            <ContactSocialLinks
              profile={profile}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <ATSReadiness workspaceId={workspaceId} onSkillAdded={() => mutateProfile()} />
            <CareerTimeline careerHistory={profile.careerHistory} />
            <ConnectedSources workspaceId={workspaceId} />
          </div>
        </div>
      </TabPanel>

      <TabPanel id="memory_activity" activeTab={activeTab}>
        <div className="space-y-6 pt-2">
          <WhatVaeloomKnows summary={memoryCounts} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AchievementsCertificates workspaceId={workspaceId} />
            <RecentActivity workspaceId={workspaceId} />
          </div>
        </div>
      </TabPanel>

      <TabPanel id="settings" activeTab={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <ThemePreferences />
          <ProfileExport workspaceId={workspaceId} userId={profile.id} />
        </div>
      </TabPanel>
    </div>
  );
}
