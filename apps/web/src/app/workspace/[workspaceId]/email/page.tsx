'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Badge,
  Button,
  MailIcon,
  BrainIcon,
  CheckIcon,
  ClockIcon,
  SparklesIcon,
  RefreshCwIcon,
  EmptyState,
} from '@vaeloom/ui-kit';
import { DEMO_EMAIL_SYNC_STATUS, DEMO_EMAIL_THREADS } from '@/lib/fixtures/email';
import type { EmailThreadItem, ExtractedCareerEntity } from '@/lib/fixtures/email';

export default function EmailIntelligencePage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [selectedThreadId, setSelectedThreadId] = useState<string>(DEMO_EMAIL_THREADS[0]?.id || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const sync = DEMO_EMAIL_SYNC_STATUS;
  const threads = DEMO_EMAIL_THREADS;

  const filteredThreads =
    categoryFilter === 'ALL' ? threads : threads.filter((t) => t.category === categoryFilter);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || filteredThreads[0];

  const getCategoryBadge = (category: EmailThreadItem['category']) => {
    switch (category) {
      case 'INTERVIEW_INVITE':
        return (
          <Badge variant="success" size="sm">
            INTERVIEW INVITE
          </Badge>
        );
      case 'RECRUITER':
        return (
          <Badge variant="primary" size="sm">
            RECRUITER REACHOUT
          </Badge>
        );
      case 'STATUS_UPDATE':
        return (
          <Badge variant="warning" size="sm">
            STATUS UPDATE
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            GENERAL
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Email Intelligence & Recruiter Triage
            </h1>
            <Badge variant="warning" size="sm">
              DEMO TRIAGE
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Autonomous ingestion of recruiter correspondence, interview timelines, and career memory
            claims.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-2xs font-mono px-3 py-1.5 rounded-lg bg-surface-100 border border-border-subtle">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-text-muted">{sync.provider}:</span>
            <strong className="text-text">{sync.accountEmail}</strong>
          </div>
          <Link href={`/workspace/${workspaceId}/connectors`}>
            <Button variant="outline" size="sm">
              <span className="flex items-center gap-1.5">
                <RefreshCwIcon size={14} /> Connector Status
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {['ALL', 'INTERVIEW_INVITE', 'STATUS_UPDATE', 'RECRUITER', 'GENERAL'].map((cat) => (
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
            {cat === 'ALL' ? 'All Correspondence' : cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Two-Column Master/Detail Layout */}
      {filteredThreads.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No emails in this category"
            description="No recruiter threads match the active category filter."
            action={{
              label: 'View All Correspondence',
              onClick: () => setCategoryFilter('ALL'),
            }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Email Thread List (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            {filteredThreads.map((thread) => {
              const isSelected = thread.id === selectedThread?.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-action/10 border-action/60 shadow-xs'
                      : 'bg-surface border-border-subtle hover:border-border-strong hover:bg-surface-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      {!thread.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-action shrink-0" />
                      )}
                      <span className="font-semibold text-xs text-text truncate">
                        {thread.company} — {thread.senderName}
                      </span>
                    </div>
                    <span className="text-2xs font-mono text-text-muted shrink-0">
                      {new Date(thread.receivedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <h3 className="text-xs font-medium text-text truncate mb-1">{thread.subject}</h3>

                  <p className="text-2xs text-text-secondary line-clamp-2 leading-relaxed">
                    {thread.preview}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border-subtle/50 text-2xs">
                    {getCategoryBadge(thread.category)}
                    <span className="text-text-muted font-mono">
                      {thread.extractedEntities.length} entities extracted
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected Thread & AI Extraction Detail (7 cols) */}
          {selectedThread && (
            <div className="lg:col-span-7 space-y-4">
              <Card className="p-5 space-y-4 border-border-strong">
                {/* Email Header */}
                <div className="space-y-2 border-b border-border-subtle pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text">{selectedThread.company}</span>
                      <span className="text-text-muted text-xs">•</span>
                      <span className="text-xs text-text-secondary">
                        {selectedThread.senderName}
                      </span>
                      <code className="text-2xs font-mono text-text-muted bg-surface-200 px-1 rounded">
                        &lt;{selectedThread.senderEmail}&gt;
                      </code>
                    </div>
                    {getCategoryBadge(selectedThread.category)}
                  </div>

                  <h2 className="text-base sm:text-lg font-bold text-text">
                    {selectedThread.subject}
                  </h2>

                  <div className="text-2xs font-mono text-text-muted flex items-center gap-1">
                    <ClockIcon size={12} /> Received:{' '}
                    {new Date(selectedThread.receivedAt).toLocaleString()}
                  </div>
                </div>

                {/* AI Intelligence Extraction Box */}
                {selectedThread.extractedEntities.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-accent/5 border border-accent/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                        <SparklesIcon size={15} /> AI Extraction & Memory Ingestion
                      </div>
                      <Link
                        href={`/workspace/${workspaceId}/memory`}
                        className="text-2xs text-action hover:underline flex items-center gap-1"
                      >
                        <BrainIcon size={12} /> View Memory Graph
                      </Link>
                    </div>

                    <div className="space-y-1.5">
                      {selectedThread.extractedEntities.map(
                        (ent: ExtractedCareerEntity, idx: number) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded bg-surface border border-border-subtle text-xs"
                          >
                            <div>
                              <span className="text-2xs font-mono uppercase text-text-muted mr-1.5">
                                [{ent.type}]
                              </span>
                              <span className="font-medium text-text">{ent.label}:</span>{' '}
                              <span className="text-text-secondary">{ent.value}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-2xs shrink-0 font-mono">
                              <span className="text-success flex items-center gap-0.5">
                                <CheckIcon size={12} /> Ingested
                              </span>
                              <span className="text-text-muted">
                                ({Math.round(ent.confidence * 100)}%)
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Email Body */}
                <div className="text-xs text-text leading-relaxed whitespace-pre-line bg-surface-100 p-4 rounded-lg font-sans border border-border-subtle">
                  {selectedThread.body}
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                  <div className="text-2xs text-text-muted">
                    Scanned by <strong className="text-text">GmailAgent (System 1 Choice)</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/workspace/${workspaceId}/chat`}>
                      <Button variant="outline" size="sm">
                        <span className="flex items-center gap-1.5">
                          <SparklesIcon size={14} /> Draft AI Response
                        </span>
                      </Button>
                    </Link>
                    <Link href={`/workspace/${workspaceId}/jobs`}>
                      <Button variant="primary" size="sm">
                        View Pipeline Status
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
