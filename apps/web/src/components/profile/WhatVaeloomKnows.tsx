'use client';

import React from 'react';

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
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    key: 'documentCount',
    name: 'Document Memory',
    desc: 'Extracted facts from your uploaded files',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    key: 'careerCount',
    name: 'Career Memory',
    desc: 'Job applications, interviews, and trajectory',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
        />
      </svg>
    ),
  },
  {
    key: 'episodicCount',
    name: 'Episodic Memory',
    desc: 'Past interactions, feedback, and events',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    key: 'preferenceCount',
    name: 'Preference Memory',
    desc: 'Work styles, constraints, and priorities',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    ),
  },
  {
    key: 'workingCount',
    name: 'Working Memory',
    desc: 'Active context for current tasks',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
];

export function WhatVaeloomKnows({ summary }: { summary?: MemorySummary }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text">What Vaeloom Knows</h2>
        <p className="text-sm text-text-dim mt-1">
          A transparent view of your personalized memory graph
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memoryTypes.map((type) => {
          const count = summary ? summary[type.key as keyof MemorySummary] : 0;

          return (
            <div
              key={type.key}
              className="border border-border rounded-lg p-4 flex flex-col hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${type.bg} ${type.color}`}>{type.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text truncate">{type.name}</h3>
                  <div className="text-xs font-mono text-text-muted">{count} items</div>
                </div>
              </div>
              <p className="text-xs text-text-dim mt-auto">{type.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-border flex items-center justify-center gap-2 text-xs text-text-muted">
        <svg
          className="w-4 h-4 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
        <span>Your memory graph is private and never shared</span>
      </div>
    </div>
  );
}
