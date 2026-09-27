'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
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
  RefreshCwIcon,
} from '@vaeloom/ui-kit';
import {
  careerApi,
  agentCatalogApi,
  type CareerStrategyResponse,
  type CatalogAgent,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export default function CareerStrategyPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('skills');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Live SWR for Career Strategy
  const {
    data: strategy,
    error: strategyError,
    isLoading: strategyLoading,
    mutate: mutateStrategy,
  } = useSWR<CareerStrategyResponse>(
    workspaceId ? `career-strategy-${workspaceId}` : null,
    () => careerApi.getStrategy(workspaceId),
    { revalidateOnFocus: false },
  );

  const { data: agentCatalog } = useSWR<{ agents: CatalogAgent[] }>(
    'agent-catalog',
    () => agentCatalogApi.get(),
    { revalidateOnFocus: false },
  );

  const categories = [
    'ALL',
    'Distributed Systems',
    'AI / Machine Learning',
    'Security & Compliance',
    'Cloud Infrastructure',
  ];

  const skillGaps = strategy?.skillGaps ?? [];
  const filteredSkills =
    categoryFilter === 'ALL' ? skillGaps : skillGaps.filter((s) => s.category === categoryFilter);

  const targetRole = strategy?.primaryTargetRole ?? null;

  const criticalGapsCount = skillGaps.filter((s) => s.gapSeverity === 'HIGH').length;

  const handleRefresh = async () => {
    try {
      await mutateStrategy();
      toast({
        tone: 'success',
        title: 'Strategy Updated',
        detail: 'Recalibrated competency radar and market compensation benchmarks.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Recalibration Failed',
        detail: 'Unable to reach career synthesis service.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Career Strategy & Competency Radar
            </h1>
            <Badge variant="success" size="sm">
              LIVE SYNTHESIS
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Strategic career progression architecture, target compensation benchmarks, and agent
            scouting directives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5"
          >
            <RefreshCwIcon size={14} className={strategyLoading ? 'animate-spin' : ''} />
            <span>Recalibrate</span>
          </Button>
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

      {strategyLoading ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-text-muted font-medium">
            Synthesizing competency graph and compensation radar…
          </p>
        </Card>
      ) : !targetRole ? (
        <Card className="p-8 text-center border border-dashed border-border rounded-xl space-y-3">
          <BriefcaseIcon size={28} className="mx-auto text-text-muted" />
          <h2 className="text-lg font-display font-medium text-text">No target role configured</h2>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Set a target role to calibrate your competency radar, compensation benchmarks, and
            market demand analysis.
          </p>
          <Button variant="primary" size="sm" onClick={() => setActiveTab('skills')}>
            Configure in Skills Tab
          </Button>
        </Card>
      ) : (
        <>
          {/* Target Role & Benchmark Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Target Role Match"
              value={`${targetRole.overallMatchPercentage}%`}
              delta={{ value: '+6% QoQ', trend: 'up' }}
              icon={<BriefcaseIcon size={20} />}
              caption={targetRole.level}
            />
            <StatCard
              label="Target Comp Band"
              value={targetRole.benchmarkCompensation.split(' ')[0] || '$380k - $480k'}
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
              value={criticalGapsCount}
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
                <h2 className="text-lg font-bold text-text">{targetRole.title}</h2>
                <p className="text-xs text-text-secondary">
                  Benchmark calibrated against top-tier infrastructure organizations and sovereign
                  AI labs.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-2xs text-text-muted block">Calibration Confidence</span>
                  <span className="text-sm font-semibold text-action">
                    High ({targetRole.readinessScore}%)
                  </span>
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-action/30 border-t-action flex items-center justify-center font-bold text-xs text-text">
                  {targetRole.overallMatchPercentage}%
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
                {filteredSkills.map((item) => {
                  const currentNum =
                    item.currentLevel === 'Expert' ? 5 : item.currentLevel === 'Advanced' ? 4 : 3;
                  const requiredNum = item.requiredLevel === 'Expert' ? 5 : 4;

                  return (
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
                            item.gapSeverity === 'HIGH'
                              ? 'error'
                              : item.gapSeverity === 'MEDIUM'
                                ? 'warning'
                                : 'success'
                          }
                          size="sm"
                        >
                          {item.gapSeverity} GAP
                        </Badge>
                      </div>

                      {/* Level Progress Indicator */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-2xs text-text-secondary">
                          <span>Current Level: {item.currentLevel}</span>
                          <span>Target Level: {item.requiredLevel}</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-200 overflow-hidden flex">
                          <div
                            className="bg-action h-full transition-all duration-300"
                            style={{ width: `${(currentNum / 5) * 100}%` }}
                          />
                          {requiredNum > currentNum && (
                            <div
                              className="bg-accent/40 h-full transition-all duration-300"
                              style={{ width: `${((requiredNum - currentNum) / 5) * 100}%` }}
                            />
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-2xs text-text-secondary">
                        <span className="truncate max-w-[260px] text-text-muted">
                          {item.actionRequired}
                        </span>
                        {item.gapSeverity === 'LOW' ? (
                          <span className="flex items-center gap-1 text-success font-medium">
                            <CheckIcon size={12} /> Target Met
                          </span>
                        ) : (
                          <span className="text-action font-medium">In Development</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabPanel>

          {/* TAB 2: Milestone Roadmap */}
          <TabPanel activeTab={activeTab} id="roadmap">
            <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
              {(strategy?.milestones ?? []).map((milestone) => (
                <div key={milestone.id} className="relative group">
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

                    <div className="pt-2 border-t border-border-subtle text-2xs text-text-muted flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        Assigned Agent:{' '}
                        <strong className="text-text font-mono">{milestone.agentAssigned}</strong>
                      </span>
                      <span>
                        Progress:{' '}
                        <strong className="text-action font-mono">
                          {milestone.progressPercentage}%
                        </strong>
                      </span>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </TabPanel>

          {/* TAB 3: Target Companies */}
          <TabPanel activeTab={activeTab} id="companies">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(strategy?.targetCompanies ?? []).map((company) => (
                <Card key={company.name} className="p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-text">{company.name}</h3>
                        <span className="text-2xs font-mono text-text-muted">{company.tier}</span>
                      </div>
                      <Badge variant="primary" size="sm">
                        {company.stage.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-2xs text-text-secondary">
                        <span>Alignment Score</span>
                        <span className="font-semibold text-action">
                          {company.matchPercentage}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
                        <div
                          className="bg-action h-full"
                          style={{ width: `${company.matchPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-2xs text-text-muted pt-1">
                      <span>
                        Open Roles: <strong className="text-text">{company.openPositions}</strong>
                      </span>
                      <span>
                        Lead: <strong className="text-text">{company.activeContact}</strong>
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
              {!agentCatalog ? (
                <Card className="p-8 text-center border border-dashed border-border rounded-xl">
                  <p className="text-sm text-text-muted">Loading agent catalog…</p>
                </Card>
              ) : agentCatalog.agents.length === 0 ? (
                <Card className="p-8 text-center border border-dashed border-border rounded-xl">
                  <p className="text-sm text-text-muted">No agents available in the catalog.</p>
                </Card>
              ) : (
                agentCatalog.agents.map((agent) => (
                  <Card
                    key={agent.name}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          {agent.name}
                        </Badge>
                        <span className="text-2xs text-text-muted font-mono">
                          {agent.category} · {agent.defaultAutonomy}
                        </span>
                      </div>
                      <p className="text-xs text-text font-medium">{agent.mission}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/workspace/${workspaceId}/agents`}>
                        <Button variant="outline" size="sm">
                          Configure Agent
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        </>
      )}
    </div>
  );
}
