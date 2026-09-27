'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
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
import { gmailApi, type LiveEmailMessage, type ExtractedEmailEntity } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export default function EmailIntelligencePage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';
  const { toast } = useToast();

  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Live Gmail Status SWR
  const { data: statusData, mutate: mutateStatus } = useSWR(
    workspaceId ? `gmail-status-${workspaceId}` : null,
    () => gmailApi.getStatus(workspaceId).catch(() => null),
    { revalidateOnFocus: false },
  );

  // 2. Live Gmail Messages SWR
  const {
    data: messagesData,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useSWR(
    workspaceId ? `gmail-messages-${workspaceId}` : null,
    () =>
      gmailApi
        .listMessages({ workspaceId, maxResults: 30 })
        .catch(() => ({ messages: [], count: 0, connected: false })),
    { revalidateOnFocus: false },
  );

  const rawThreads: LiveEmailMessage[] = messagesData?.messages ?? [];
  const isConnected = statusData?.connected ?? messagesData?.connected ?? false;

  // Filter threads by category and search
  const filteredThreads = rawThreads.filter((t) => {
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.senderName.toLowerCase().includes(q) ||
        t.company.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedThread =
    filteredThreads.find((t) => t.id === selectedThreadId) || filteredThreads[0] || null;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([mutateStatus(), mutateMessages()]);
      toast({
        tone: 'success',
        title: 'Inbox Synchronized',
        detail: 'Fetched latest email correspondence from Gmail.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: 'Unable to reach Gmail API. Check connector authorization.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getCategoryBadge = (category: LiveEmailMessage['category']) => {
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
            <Badge variant={isConnected ? 'success' : 'warning'} size="sm">
              {isConnected ? 'LIVE GMAIL' : 'CONNECTOR READY'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Autonomous ingestion of recruiter correspondence, interview timelines, and career memory
            claims.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-2xs font-mono px-3 py-1.5 rounded-lg bg-surface-100 border border-border-subtle">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-success' : 'bg-warning animate-pulse'
              }`}
            />
            <span className="text-text-muted">Account:</span>
            <strong className="text-text truncate max-w-[180px]">
              {statusData?.accountEmail || (isConnected ? 'Google Workspace' : 'OAuth Configured')}
            </strong>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5"
          >
            <RefreshCwIcon size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing…' : 'Sync Inbox'}</span>
          </Button>
          <Link href={`/workspace/${workspaceId}/connectors`}>
            <Button variant="secondary" size="sm">
              Manage Connectors
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'INTERVIEW_INVITE', 'STATUS_UPDATE', 'RECRUITER', 'GENERAL'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-action text-white shadow-xs'
                  : 'bg-surface-200 text-text-secondary hover:text-text'
              }`}
            >
              {cat === 'ALL' ? 'All Correspondence' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sender, subject..."
            className="w-full px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {messagesLoading ? (
        <Card className="p-12 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-text-muted font-medium">
            Scanning Gmail messages & extracting career entities…
          </p>
        </Card>
      ) : filteredThreads.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={
              rawThreads.length === 0 ? 'No emails found in connected inbox' : 'No matching emails'
            }
            description={
              rawThreads.length === 0
                ? 'Your Gmail integration is active. No recruiter threads or correspondence were found in the current inbox sweep.'
                : 'No correspondence matches your current search or category filter.'
            }
            action={{
              label: rawThreads.length === 0 ? 'Trigger Sync' : 'Reset Filters',
              onClick: () => {
                if (rawThreads.length === 0) {
                  handleSync();
                } else {
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }
              },
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
                      {thread.receivedAt}
                    </span>
                  </div>

                  <h3 className="text-xs font-medium text-text truncate mb-1">{thread.subject}</h3>

                  <p className="text-2xs text-text-secondary line-clamp-2 leading-relaxed">
                    {thread.preview}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border-subtle/50 text-2xs">
                    {getCategoryBadge(thread.category)}
                    <span className="text-text-muted font-mono">
                      {thread.extractedEntities?.length || 0} entities
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
                    <ClockIcon size={12} /> Received: {selectedThread.receivedAt}
                  </div>
                </div>

                {/* AI Intelligence Extraction Box */}
                {selectedThread.extractedEntities &&
                  selectedThread.extractedEntities.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-accent/5 border border-accent/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                          <SparklesIcon size={15} /> AI Extraction &amp; Memory Ingestion
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
                          (ent: ExtractedEmailEntity, idx: number) => (
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
                    Scanned by{' '}
                    <strong className="text-text">GmailAgent (System 1 Decision Engine)</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/workspace/${workspaceId}/chat?prompt=${encodeURIComponent(
                        `Draft a professional response to this email from ${selectedThread.senderName} (${selectedThread.company}) regarding '${selectedThread.subject}'.`,
                      )}`}
                    >
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
