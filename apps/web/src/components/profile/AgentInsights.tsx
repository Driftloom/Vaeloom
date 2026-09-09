'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ProfileRecommendationItem, profileApi, ProfileData } from '@/lib/api-client';

interface AgentInsightsProps {
  workspaceId: string;
  onUpdate?: (updated: ProfileData) => void;
}

export default function AgentInsights({ workspaceId, onUpdate }: AgentInsightsProps) {
  const {
    data: recommendations,
    error,
    isLoading,
    mutate,
  } = useSWR<ProfileRecommendationItem[]>(
    workspaceId ? ['profile-recommendations', workspaceId] : null,
    () => profileApi.recommendations(workspaceId),
    { revalidateOnFocus: false },
  );

  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<Record<string, boolean>>({});

  const handleAction = async (rec: ProfileRecommendationItem) => {
    setExecutingAction(rec.id);
    try {
      if (rec.actionLabel === 'Auto-Populate') {
        const updated = await profileApi.autoPopulate(workspaceId);
        onUpdate?.(updated);
        setActionDone((prev) => ({ ...prev, [rec.id]: true }));
        await mutate();
      } else if (rec.actionLabel.startsWith('Add ')) {
        const skillName = rec.actionLabel.replace('Add ', '').trim();
        const updated = await profileApi.addSkill(skillName, workspaceId, 1.0);
        onUpdate?.(updated);
        setActionDone((prev) => ({ ...prev, [rec.id]: true }));
        await mutate();
      }
    } catch (err) {
      console.error('Agent recommendation execution failed:', err);
    } finally {
      setExecutingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-44 bg-surface-200 rounded" />
          <div className="h-4 w-20 bg-surface-200 rounded-full" />
        </div>
        <div className="h-20 bg-surface-200 rounded-lg" />
        <div className="h-20 bg-surface-200 rounded-lg" />
      </div>
    );
  }

  if (error || !recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="card p-6 space-y-5 border border-primary/20 bg-gradient-to-br from-surface to-primary/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-base">
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-text text-base">Autonomous Agent Insights</h3>
            <p className="text-xs text-text-muted">
              Proactive suggestions derived from your memory graph
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
          Live Agents
        </span>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => {
          const isDone = actionDone[rec.id];
          const isExecuting = executingAction === rec.id;

          return (
            <div
              key={rec.id}
              className="p-4 rounded-xl border border-border bg-surface hover:border-primary/30 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-surface-200 text-text-muted border border-border">
                    {rec.agentName}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {rec.impact}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">
                  {rec.title}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">{rec.description}</p>
              </div>

              <div className="shrink-0 flex items-center">
                {rec.actionUrl ? (
                  <Link
                    href={rec.actionUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <span>{rec.actionLabel}</span>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                ) : (
                  <button
                    onClick={() => handleAction(rec)}
                    disabled={isExecuting || isDone}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
                        <span>Applying...</span>
                      </>
                    ) : isDone ? (
                      <>
                        <svg
                          className="w-3.5 h-3.5 text-emerald-400"
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
                        <span>Applied!</span>
                      </>
                    ) : (
                      <>
                        <span>{rec.actionLabel}</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
