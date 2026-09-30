'use client';

import React, { useMemo, useState } from 'react';
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
import { PageHeader } from '@/components/shared/Page';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { FilterPills } from '@/components/shared/FilterPills';

const NOT_REPORTED = 'Not reported';

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

  const { data: agentCatalog, error: catalogError } = useSWR<{ agents: CatalogAgent[] }>(
    'agent-catalog',
    () => agentCatalogApi.get(),
    { revalidateOnFocus: false },
  );

  const skillGaps = useMemo(() => strategy?.skillGaps ?? [], [strategy]);

  // Categories are derived from the returned skills. The previous fixed
  // four-item taxonomy meant any category the server added produced a silently
  // empty filtered list with no way to tell that from "no gaps".
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const s of skillGaps) {
      if (s.category) seen.add(s.category);
    }
    return ['ALL', ...Array.from(seen).sort()];
  }, [skillGaps]);

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
        detail: 'Refetched the competency radar and market compensation benchmarks.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Recalibration Failed',
        detail: 'Unable to reach career synthesis service.',
      });
    }
  };

  const compensationBand = targetRole?.benchmarkCompensation?.trim();
  const marketDemand = targetRole?.marketDemand?.trim();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        eyebrow="Career Strategy"
        title="Strategy & Competency Radar"
        description="Strategic career progression architecture, target compensation benchmarks, and agent scouting directives."
        actions={
          <>
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
                  <FileTextIcon size={14} aria-hidden="true" /> Tailor Resume
                </span>
              </Button>
            </Link>
            <Link href={`/workspace/${workspaceId}/jobs`}>
              <Button variant="primary" size="sm">
                <span className="flex items-center gap-1.5">
                  <BriefcaseIcon size={14} aria-hidden="true" /> View Matching Jobs
                </span>
              </Button>
            </Link>
          </>
        }
      />

      {strategyLoading ? (
        <LoadingSpinner text="Synthesizing competency graph and compensation radar…" />
      ) : strategyError ? (
        // Without this the page fell through to "No target role configured",
        // which reports a server failure as missing user configuration.
        <ErrorState
          title="Failed to load career strategy"
          message={`${
            strategyError.message || 'The career synthesis service returned an error.'
          } No competency, compensation or roadmap figures are shown, because none were retrieved.`}
          onRetry={() => {
            void mutateStrategy();
          }}
        />
      ) : !targetRole ? (
        <Card className="p-8">
          <EmptyState
            title="No target role configured"
            description="The strategy endpoint returned successfully but reported no primary target role, so no radar or compensation figures exist for this workspace."
            action={{ label: 'Go to Skills', onClick: () => setActiveTab('skills') }}
          />
        </Card>
      ) : (
        <>
          {/* Target Role & Benchmark Stat Cards.
              Every value below is a straight pass-through of a server field or
              the explicit "not reported" string. The previous version attached
              invented market deltas ("+6% QoQ", "+34% YoY") and a hard-coded
              "Very High" demand reading to a card whose backend has no such
              fields, which is indistinguishable from a real market feed. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Target Role Match"
              value={`${targetRole.overallMatchPercentage}%`}
              icon={<BriefcaseIcon size={20} aria-hidden="true" />}
              caption={`Server-reported readiness for ${targetRole.title}`}
            />
            <StatCard
              label="Target Comp Band"
              value={compensationBand || NOT_REPORTED}
              icon={<SparklesIcon size={20} aria-hidden="true" />}
              caption={
                compensationBand
                  ? 'Benchmark returned by the career strategy service'
                  : 'The strategy service did not return a compensation band'
              }
            />
            <StatCard
              label="Market Demand"
              value={marketDemand || NOT_REPORTED}
              icon={<AlertCircleIcon size={20} aria-hidden="true" />}
              caption={
                marketDemand
                  ? 'As reported by the career strategy service'
                  : 'The strategy service did not return a demand reading'
              }
            />
            <StatCard
              label="Critical Gaps"
              value={criticalGapsCount}
              icon={<AlertCircleIcon size={20} aria-hidden="true" />}
              caption={`Of ${skillGaps.length} reported skill gap(s)`}
            />
          </div>

          {/* Primary Role Overview Card */}
          <Card className="p-5 border-border-strong bg-surface-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Active Strategic Target
                </span>
                <h2 className="text-lg font-bold text-text">{targetRole.title}</h2>
                <p className="text-xs text-text-secondary">{targetRole.level}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-xs text-text-muted block">Readiness Score</span>
                  <span className="text-sm font-semibold text-action">
                    {targetRole.readinessScore}%
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
              {categories.length > 2 && (
                <FilterPills
                  options={categories.map((c) => ({ value: c, label: c }))}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  ariaLabel="Filter skill gaps by category"
                />
              )}

              {filteredSkills.length === 0 ? (
                <EmptyState
                  title={
                    skillGaps.length === 0 ? 'No skill gaps reported' : 'No gaps in this category'
                  }
                  description={
                    skillGaps.length === 0
                      ? 'The career strategy service reported no skill gaps for this workspace.'
                      : `No reported skill gap falls under "${categoryFilter}".`
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSkills.map((item) => {
                    const currentNum =
                      item.currentLevel === 'Expert' ? 5 : item.currentLevel === 'Advanced' ? 4 : 3;
                    const requiredNum = item.requiredLevel === 'Expert' ? 5 : 4;

                    return (
                      <Card key={item.skill} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-mono uppercase text-text-muted">
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
                        <ProgressBar
                          value={currentNum}
                          max={5}
                          showValue={false}
                          label={`Current level: ${item.currentLevel} — target level: ${item.requiredLevel}`}
                          color="primary"
                        />
                        {requiredNum > currentNum && (
                          <ProgressBar
                            value={requiredNum - currentNum}
                            max={5}
                            showValue={false}
                            label={`Gap to close: ${requiredNum - currentNum} of 5 levels`}
                            color="accent"
                          />
                        )}

                        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs text-text-secondary">
                          <span className="truncate max-w-[260px] text-text-muted">
                            {item.actionRequired}
                          </span>
                          {item.gapSeverity === 'LOW' ? (
                            <span className="flex items-center gap-1 text-success font-medium">
                              <CheckIcon size={12} aria-hidden="true" /> Target Met
                            </span>
                          ) : (
                            <span className="text-action font-medium">In Development</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabPanel>

          {/* TAB 2: Milestone Roadmap */}
          <TabPanel activeTab={activeTab} id="roadmap">
            {(strategy?.milestones ?? []).length === 0 ? (
              <EmptyState
                title="No milestones reported"
                description="The career strategy service returned no roadmap milestones for this workspace."
              />
            ) : (
              <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
                {(strategy?.milestones ?? []).map((milestone) => (
                  <div key={milestone.id} className="relative group">
                    <div
                      aria-hidden="true"
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

                      <ProgressBar
                        value={milestone.progressPercentage}
                        max={100}
                        className="pt-2"
                        label="Progress"
                        color="primary"
                      />
                      <div className="text-xs text-text-muted flex items-center justify-between">
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
            )}
          </TabPanel>

          {/* TAB 3: Target Companies */}
          <TabPanel activeTab={activeTab} id="companies">
            {(strategy?.targetCompanies ?? []).length === 0 ? (
              <EmptyState
                title="No target companies reported"
                description="The career strategy service returned no target companies for this workspace."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(strategy?.targetCompanies ?? []).map((company) => (
                  <Card key={company.name} className="p-4 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-text">{company.name}</h3>
                          <span className="text-xs font-mono text-text-muted">{company.tier}</span>
                        </div>
                        <Badge variant="primary" size="sm">
                          {company.stage.replace('_', ' ')}
                        </Badge>
                      </div>

                      <ProgressBar
                        value={company.matchPercentage}
                        max={100}
                        label="Alignment Score"
                        color="primary"
                        className="pt-1"
                      />

                      <div className="flex justify-between text-xs text-text-muted pt-1">
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
                        Explore Company Postings <ExternalLinkIcon size={12} aria-hidden="true" />
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabPanel>

          {/* TAB 4: Agent Directives */}
          <TabPanel activeTab={activeTab} id="directives">
            <div className="space-y-3">
              {catalogError ? (
                <ErrorState
                  title="Failed to load agent catalog"
                  message={catalogError.message || 'The agent catalog service returned an error.'}
                />
              ) : !agentCatalog ? (
                <Card className="p-8 text-center border border-dashed border-border rounded-xl">
                  <p className="text-sm text-text-muted">Loading agent catalog…</p>
                </Card>
              ) : agentCatalog.agents.length === 0 ? (
                <EmptyState
                  title="No agents available"
                  description="The agent catalog returned zero agents for this environment."
                />
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
                        <span className="text-xs text-text-muted font-mono">
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
