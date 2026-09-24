'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Badge,
  Button,
  StatCard,
  Tabs,
  TabPanel,
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  AlertCircleIcon,
  SparklesIcon,
  ExternalLinkIcon,
  FileTextIcon,
} from '@vaeloom/ui-kit';
import { DEMO_CAREER_STRATEGY } from '@/lib/fixtures/career';
import type { SkillGapItem, RoadmapMilestone, TargetCompany } from '@/lib/fixtures/career';

export default function CareerStrategyPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';
  const [activeTab, setActiveTab] = useState('skills');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const strategy = DEMO_CAREER_STRATEGY;

  const categories = [
    'ALL',
    'Distributed Systems',
    'AI / Machine Learning',
    'Security & Compliance',
    'Cloud Infrastructure',
  ];

  const filteredSkills =
    categoryFilter === 'ALL'
      ? strategy.skillGaps
      : strategy.skillGaps.filter((s) => s.category === categoryFilter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Career Strategy & Competency Radar
            </h1>
            <Badge variant="warning" size="sm">
              DEMO PREVIEW
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Strategic career progression architecture, target compensation benchmarks, and agent
            scouting directives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href={`/workspace/${workspaceId}/resume`}>
            <Button variant="outline" size="sm">
              <span className="flex items-center gap-1.5">
                <FileTextIcon size={14} /> Tailor Resume
              </span>
            </Button>
          </Link>
          <Link href={`/workspace/${workspaceId}/jobs`}>
            <Button variant="primary" size="sm">
              <span className="flex items-center gap-1.5">
                <BriefcaseIcon size={14} /> View Matching Jobs
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Target Role & Benchmark Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Target Role Match"
          value={`${strategy.primaryTargetRole.overallMatchPercentage}%`}
          delta={{ value: '+6% QoQ', trend: 'up' }}
          icon={<BriefcaseIcon size={20} />}
          caption={strategy.primaryTargetRole.level}
        />
        <StatCard
          label="Target Comp Band"
          value="$380k - $480k"
          icon={<SparklesIcon size={20} />}
          caption="Total Target Compensation (L7)"
        />
        <StatCard
          label="Market Demand"
          value="Very High"
          delta={{ value: '+34% YoY', trend: 'up' }}
          icon={<ClockIcon size={20} />}
          caption="Distributed AI Infrastructure"
        />
        <StatCard
          label="Critical Gaps"
          value={strategy.skillGaps.filter((s) => s.priority === 'CRITICAL').length}
          icon={<AlertCircleIcon size={20} />}
          caption="Priority 1 development areas"
        />
      </div>

      {/* Primary Role Overview Card */}
      <Card className="p-5 border-border-strong bg-surface-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Active Strategic Target
            </span>
            <h2 className="text-lg font-bold text-text">{strategy.primaryTargetRole.roleTitle}</h2>
            <p className="text-xs text-text-secondary">
              Benchmark calibrated against top tier infrastructure organizations and sovereign AI
              labs.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-2xs text-text-muted block">Calibration Confidence</span>
              <span className="text-sm font-semibold text-action">High (98.4%)</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-action/30 border-t-action flex items-center justify-center font-bold text-xs text-text">
              {strategy.primaryTargetRole.overallMatchPercentage}%
            </div>
          </div>
        </div>
      </Card>

      {/* Main Tabbed Sections */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'skills', label: 'Skills & Competency Radar' },
          { id: 'roadmap', label: 'Milestone Roadmap' },
          { id: 'companies', label: 'Target Companies' },
          { id: 'directives', label: 'Agent Directives' },
        ]}
      />

      {/* TAB 1: Skills & Competency Radar */}
      <TabPanel activeTab={activeTab} id="skills">
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  categoryFilter === cat
                    ? 'bg-action text-white'
                    : 'bg-surface-200 text-text-secondary hover:text-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSkills.map((item: SkillGapItem) => (
              <Card key={item.skill} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-2xs font-mono uppercase text-text-muted">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-semibold text-text mt-0.5">{item.skill}</h3>
                  </div>
                  <Badge
                    variant={
                      item.priority === 'CRITICAL'
                        ? 'error'
                        : item.priority === 'HIGH'
                          ? 'warning'
                          : 'default'
                    }
                    size="sm"
                  >
                    {item.priority}
                  </Badge>
                </div>

                {/* Level Progress Indicator */}
                <div className="space-y-1">
                  <div className="flex justify-between text-2xs text-text-secondary">
                    <span>Current Level: {item.currentLevel}/5</span>
                    <span>Target Level: {item.requiredLevel}/5</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-200 overflow-hidden flex">
                    <div
                      className="bg-action h-full transition-all duration-300"
                      style={{ width: `${(item.currentLevel / 5) * 100}%` }}
                    />
                    {item.requiredLevel > item.currentLevel && (
                      <div
                        className="bg-accent/40 h-full transition-all duration-300"
                        style={{
                          width: `${((item.requiredLevel - item.currentLevel) / 5) * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-2xs text-text-secondary">
                  <span className="truncate max-w-[260px] text-text-muted">
                    {item.learningResource}
                  </span>
                  {item.currentLevel >= item.requiredLevel ? (
                    <span className="flex items-center gap-1 text-success font-medium">
                      <CheckIcon size={12} /> Target Met
                    </span>
                  ) : (
                    <span className="text-action font-medium">In Development</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </TabPanel>

      {/* TAB 2: Milestone Roadmap */}
      <TabPanel activeTab={activeTab} id="roadmap">
        <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
          {strategy.milestones.map((milestone: RoadmapMilestone) => (
            <div key={milestone.id} className="relative group">
              {/* Dot */}
              <div
                className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 bg-surface transition-colors ${
                  milestone.status === 'COMPLETED'
                    ? 'border-success bg-success'
                    : milestone.status === 'IN_PROGRESS'
                      ? 'border-action bg-action'
                      : 'border-border-strong bg-surface-200'
                }`}
              />

              <Card className="p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-text-muted">
                      {milestone.quarter}
                    </span>
                    <h3 className="text-sm font-semibold text-text">{milestone.title}</h3>
                  </div>
                  <Badge
                    variant={
                      milestone.status === 'COMPLETED'
                        ? 'success'
                        : milestone.status === 'IN_PROGRESS'
                          ? 'primary'
                          : 'default'
                    }
                    size="sm"
                  >
                    {milestone.status.replace('_', ' ')}
                  </Badge>
                </div>

                <p className="text-xs text-text-secondary">{milestone.description}</p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {milestone.skillsAcquired.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded bg-surface-200 text-text text-2xs font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {milestone.evidenceArtifact && (
                  <div className="pt-2 border-t border-border-subtle text-2xs text-text-muted flex items-center gap-1">
                    <CheckIcon size={12} className="text-success" />
                    Evidence verified:{' '}
                    <code className="font-mono text-text">{milestone.evidenceArtifact}</code>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      </TabPanel>

      {/* TAB 3: Target Companies */}
      <TabPanel activeTab={activeTab} id="companies">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {strategy.targetCompanies.map((company: TargetCompany) => (
            <Card key={company.id} className="p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-text">{company.name}</h3>
                    <span className="text-2xs font-mono text-text-muted">{company.domain}</span>
                  </div>
                  <Badge variant={company.tier === 'TIER_1' ? 'primary' : 'default'} size="sm">
                    {company.tier.replace('_', ' ')}
                  </Badge>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">{company.notes}</p>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-2xs text-text-secondary">
                    <span>Alignment Score</span>
                    <span className="font-semibold text-action">{company.matchScore}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                    <div className="bg-action h-full" style={{ width: `${company.matchScore}%` }} />
                  </div>
                </div>

                <div className="flex justify-between text-2xs text-text-muted pt-1">
                  <span>
                    Open Roles: <strong className="text-text">{company.openRolesCount}</strong>
                  </span>
                  <span>
                    Comp: <strong className="text-text">{company.salaryBand}</strong>
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle">
                <Link
                  href={`/workspace/${workspaceId}/jobs?query=${encodeURIComponent(company.name)}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-action hover:underline"
                >
                  Explore Company Postings <ExternalLinkIcon size={12} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>

      {/* TAB 4: Agent Directives */}
      <TabPanel activeTab={activeTab} id="directives">
        <div className="space-y-3">
          {strategy.agentDirectives.map((directive) => (
            <Card
              key={directive.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    {directive.agent}
                  </Badge>
                  <span className="text-2xs text-text-muted font-mono">ID: {directive.id}</span>
                </div>
                <p className="text-xs text-text font-medium">{directive.directive}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={directive.active ? 'success' : 'default'} size="sm">
                  {directive.active ? 'SCOUTING ACTIVE' : 'PAUSED'}
                </Badge>
                <Link href={`/workspace/${workspaceId}/agents`}>
                  <Button variant="outline" size="sm">
                    Configure Agent
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </TabPanel>
    </div>
  );
}
