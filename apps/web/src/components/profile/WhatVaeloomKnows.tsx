'use client';

import React from 'react';
import {
  Panel,
  BrainIcon,
  FileTextIcon,
  BriefcaseIcon,
  ClockIcon,
  CpuIcon,
  ShieldIcon,
  Badge,
} from '@vaeloom/ui-kit';

interface MemorySummary {
  profileCount: number;
  documentCount: number;
  careerCount: number;
  episodicCount: number;
  preferenceCount: number;
  workingCount: number;
}

const memoryTypes = [
  {
    key: 'profileCount',
    name: 'Profile Memory',
    desc: 'Core identity, skills, and professional baseline',
    icon: BrainIcon,
  },
  {
    key: 'documentCount',
    name: 'Document Memory',
    desc: 'Extracted facts and structured data from uploaded files',
    icon: FileTextIcon,
  },
  {
    key: 'careerCount',
    name: 'Career Memory',
    desc: 'Job applications, interviews, and trajectory history',
    icon: BriefcaseIcon,
  },
  {
    key: 'episodicCount',
    name: 'Episodic Memory',
    desc: 'Past interactions, feedback loops, and agent decisions',
    icon: ClockIcon,
  },
  {
    key: 'preferenceCount',
    name: 'Preference Memory',
    desc: 'Work styles, autonomy constraints, and communication priorities',
    icon: ShieldIcon,
  },
  {
    key: 'workingCount',
    name: 'Working Memory',
    desc: 'Active context and short-term cache for in-flight tasks',
    icon: CpuIcon,
  },
];

export function WhatVaeloomKnows({ summary }: { summary?: MemorySummary }) {
  const totalItems = memoryTypes.reduce(
    (acc, t) => acc + (summary ? summary[t.key as keyof MemorySummary] || 0 : 0),
    0,
  );

  return (
    <Panel
      padding="lg"
      header={
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">What Vaeloom Knows</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Transparent breakdown of your personalized multi-tiered memory graph.
            </p>
          </div>
          <Badge variant="info" size="sm">
            {totalItems} Memory Nodes
          </Badge>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {memoryTypes.map((type) => {
          const count = summary ? summary[type.key as keyof MemorySummary] || 0 : 0;
          const Icon = type.icon;

          return (
            <div
              key={type.key}
              className="border border-border rounded-xl p-4 flex flex-col justify-between bg-surface hover:border-primary/30 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                  </div>
                  <span className="font-mono text-xs font-semibold text-text px-2 py-0.5 rounded-full bg-background border border-border">
                    {count} items
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-text">{type.name}</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">{type.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-text-muted">
        <ShieldIcon size={14} className="text-success" />
        <span>Your memory graph is encrypted, workspace-isolated, and strictly zero-trust.</span>
      </div>
    </Panel>
  );
}
