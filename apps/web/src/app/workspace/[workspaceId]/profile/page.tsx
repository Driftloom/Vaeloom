'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
import EducationSection from '@/components/profile/EducationSection';
import PortfolioShowcase from '@/components/profile/PortfolioShowcase';
import AgentDirectivesCard from '@/components/profile/AgentDirectivesCard';
import CompanyBlacklistCard from '@/components/profile/CompanyBlacklistCard';
import ApplicationVaultCard from '@/components/profile/ApplicationVaultCard';
import ScreeningQuestionsCard from '@/components/profile/ScreeningQuestionsCard';
import { WhatVaeloomKnows } from '@/components/profile/WhatVaeloomKnows';
import { RecentActivity } from '@/components/profile/RecentActivity';
import { AchievementsCertificates } from '@/components/profile/AchievementsCertificates';
import { ProfileExport } from '@/components/profile/ProfileExport';
import { ThemePreferences } from '@/components/profile/ThemePreferences';
import { ActiveSessions } from '@/components/profile/ActiveSessions';
import { TwoFactorAuthCard } from '@/components/profile/TwoFactorAuthCard';
import { AccountPrivacyCard } from '@/components/profile/AccountPrivacyCard';

function ProfileContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = (params?.['workspaceId'] as string) || '';

  const initialTab = searchParams?.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (workspaceId) {
      router.replace(`/workspace/${workspaceId}/profile?tab=${tabId}`, { scroll: false });
    }
  };

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
    { id: 'overview', label: 'Overview & Skills' },
    { id: 'agent_directives', label: 'Agent Directives' },
    { id: 'vault', label: 'Application & EEO Vault' },
    { id: 'memory_activity', label: 'Memory & Activity' },
    { id: 'appearance_export', label: 'Appearance & Export' },
  ];

  if (profileError) {
    return (
      <div className="p-8 text-center text-error max-w-lg mx-auto">
        <p className="font-semibold text-base">Failed to load profile.</p>
        <p className="text-sm text-text-muted mt-1">
          {profileError.message || 'Please try again later.'}
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-48 bg-surface rounded-2xl border border-border" />
        <div className="h-12 bg-surface rounded-xl border border-border w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-64 bg-surface rounded-2xl border border-border" />
            <div className="h-64 bg-surface rounded-2xl border border-border" />
          </div>
          <div className="space-y-6">
            <div className="h-48 bg-surface rounded-2xl border border-border" />
            <div className="h-48 bg-surface rounded-2xl border border-border" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Elevated Profile Hero */}
      <ProfileHeader
        profile={profile}
        workspaceId={workspaceId}
        onUpdate={(updated) => mutateProfile(updated, false)}
      />

      {/* Primary Tab Navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Tab 1: Overview & Skills */}
      <TabPanel id="overview" activeTab={activeTab}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          <div className="lg:col-span-2 space-y-6">
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
            <PortfolioShowcase
              projects={profile.projects}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <EducationSection
              education={profile.education}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
          </div>

          <div className="space-y-6">
            {completeness && <ProfileCompleteness data={completeness} />}
            <ATSReadiness workspaceId={workspaceId} onSkillAdded={() => mutateProfile()} />
            <JobPreferences
              preferences={profile.jobPreferences}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <CareerTimeline careerHistory={profile.careerHistory} />
            <ContactSocialLinks
              profile={profile}
              workspaceId={workspaceId}
              onUpdate={(updated) => mutateProfile(updated, false)}
            />
            <ConnectedSources workspaceId={workspaceId} />
          </div>
        </div>
      </TabPanel>

      {/* Tab 2: Agent Directives */}
      <TabPanel id="agent_directives" activeTab={activeTab}>
        <div className="space-y-6 pt-2">
          <AgentDirectivesCard
            directives={profile.agentDirectives}
            workspaceId={workspaceId}
            onUpdate={(updated) => mutateProfile(updated, false)}
          />
          <CompanyBlacklistCard
            blacklist={profile.companyBlacklist}
            workspaceId={workspaceId}
            onUpdate={(updated) => mutateProfile(updated, false)}
          />
          <AgentInsights
            workspaceId={workspaceId}
            onUpdate={(updated) => mutateProfile(updated, false)}
          />
        </div>
      </TabPanel>

      {/* Tab 3: Application & EEO Vault */}
      <TabPanel id="vault" activeTab={activeTab}>
        <div className="space-y-6 pt-2">
          <ApplicationVaultCard
            vault={profile.applicationVault}
            workspaceId={workspaceId}
            onUpdate={(updated) => mutateProfile(updated, false)}
          />
          <ScreeningQuestionsCard
            questions={profile.screeningQuestions}
            workspaceId={workspaceId}
            onUpdate={(updated) => mutateProfile(updated, false)}
          />
        </div>
      </TabPanel>

      {/* Tab 4: Memory & Activity */}
      <TabPanel id="memory_activity" activeTab={activeTab}>
        <div className="space-y-6 pt-2">
          <WhatVaeloomKnows summary={memoryCounts} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AchievementsCertificates workspaceId={workspaceId} />
            <RecentActivity workspaceId={workspaceId} />
          </div>
        </div>
      </TabPanel>

      {/* Tab 5: Appearance & Export */}
      <TabPanel id="appearance_export" activeTab={activeTab}>
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ThemePreferences />
            <ProfileExport workspaceId={workspaceId} userId={profile.id} />
          </div>
          <TwoFactorAuthCard
            initialEnabled={Boolean((profile as unknown as { mfaEnabled?: boolean })?.mfaEnabled)}
            onStatusChange={() => mutateProfile()}
          />
          <ActiveSessions />
          <AccountPrivacyCard />
        </div>
      </TabPanel>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-48 bg-surface rounded-2xl border border-border" />
          <div className="h-12 bg-surface rounded-xl border border-border w-96" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
