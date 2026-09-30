'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Card,
  Badge,
  Button,
  BrainIcon,
  CheckIcon,
  ClockIcon,
  SparklesIcon,
  RefreshCwIcon,
} from '@vaeloom/ui-kit';
import { gmailApi, type LiveEmailMessage, type ExtractedEmailEntity } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { FilterPills } from '@/components/shared/FilterPills';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Correspondence' },
  { value: 'INTERVIEW_INVITE', label: 'INTERVIEW INVITE' },
  { value: 'STATUS_UPDATE', label: 'STATUS UPDATE' },
  { value: 'RECRUITER', label: 'RECRUITER' },
  { value: 'GENERAL', label: 'GENERAL' },
];

export default function EmailIntelligencePage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';
  const { toast } = useToast();

  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Live Gmail Status SWR. The fetcher must NOT swallow the rejection: a
  // `.catch(() => null)` here made a 500 indistinguishable from "not connected".
  const {
    data: statusData,
    error: statusError,
    mutate: mutateStatus,
  } = useSWR(
    workspaceId ? `gmail-status-${workspaceId}` : null,
    () => gmailApi.getStatus(workspaceId),
    { revalidateOnFocus: false },
  );

  // 2. Live Gmail Messages SWR. Same reason: the old catch returned
  // `{messages: [], connected: false}`, a shape indistinguishable from a
  // successful empty sweep, so a failure rendered "Your Gmail integration is
  // active" as an empty state.
  const {
    data: messagesData,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useSWR(
    workspaceId ? `gmail-messages-${workspaceId}` : null,
    () => gmailApi.listMessages({ workspaceId, maxResults: 30 }),
    { revalidateOnFocus: false },
  );

  const rawThreads: LiveEmailMessage[] = messagesData?.messages ?? [];
  const isConnected = statusData?.connected ?? messagesData?.connected ?? false;
  const accountEmail = statusData?.accountEmail?.trim() || '';

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
      <PageHeader
        eyebrow="Recruiter Triage"
        title="Email Intelligence"
        description="Autonomous ingestion of recruiter correspondence, interview timelines, and career memory claims."
        actions={
          <>
            <Badge variant={isConnected ? 'success' : 'warning'} size="sm">
              {isConnected ? 'LIVE GMAIL' : 'CONNECTOR READY'}
            </Badge>
            <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-surface-100 border border-border-subtle">
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-success' : 'bg-warning animate-pulse'
                }`}
              />
              <span className="text-text-muted">Account:</span>
              {accountEmail ? (
                <strong className="text-text truncate max-w-48">{accountEmail}</strong>
              ) : (
                <span className="text-text-dim">not reported</span>
              )}
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
          </>
        }
      />

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <FilterPills
          options={CATEGORY_OPTIONS}
          value={categoryFilter}
          onChange={setCategoryFilter}
          ariaLabel="Filter correspondence by category"
        />
        <div className="w-full sm:w-64">
          <label htmlFor="email-search" className="sr-only">
            Search correspondence by sender, company or subject
          </label>
          <input
            id="email-search"
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
        <LoadingSpinner text="Scanning Gmail messages & extracting career entities…" />
      ) : messagesError ? (
        <ErrorState
          title="Failed to load inbox"
          message={
            (messagesError as Error).message ||
            'The Gmail connector did not return messages. No claim is being made about inbox contents.'
          }
          onRetry={() => {
            void mutateMessages();
          }}
        />
      ) : statusError ? (
        <ErrorState
          title="Failed to load Gmail connection status"
          message={
            (statusError as Error).message ||
            'The connector status could not be read, so the account and connection state below are unknown.'
          }
          onRetry={() => {
            void mutateStatus();
          }}
        />
      ) : filteredThreads.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title={
              rawThreads.length === 0 ? 'No emails found in connected inbox' : 'No matching emails'
            }
            description={
              rawThreads.length === 0
                ? isConnected
                  ? 'Gmail is connected and the sweep returned no recruiter threads or other correspondence. This says nothing about unread mail outside the sweep window.'
                  : 'No Gmail connection is reported for this workspace, so no messages were retrieved.'
                : 'No correspondence matches your current search or category filter.'
            }
            action={{
              label: rawThreads.length === 0 ? 'Trigger Sync' : 'Reset Filters',
              onClick: () => {
                if (rawThreads.length === 0) {
                  void handleSync();
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
          <ul className="lg:col-span-5 space-y-2.5">
            {filteredThreads.map((thread) => {
              const isSelected = thread.id === selectedThread?.id;

              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isSelected
                        ? 'bg-action/10 border-action/60 shadow-xs'
                        : 'bg-surface border-border-subtle hover:border-border-strong hover:bg-surface-100'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="flex items-center gap-1.5 truncate">
                        {!thread.isRead && (
                          <>
                            <span
                              aria-hidden="true"
                              className="w-1.5 h-1.5 rounded-full bg-action shrink-0"
                            />
                            <span className="sr-only">Unread: </span>
                          </>
                        )}
                        <span className="font-semibold text-xs text-text truncate">
                          {thread.company} — {thread.senderName}
                        </span>
                      </span>
                      <span className="text-xs font-mono text-text-muted shrink-0">
                        {thread.receivedAt}
                      </span>
                    </span>

                    <span className="block text-xs font-medium text-text truncate mb-1">
                      {thread.subject}
                    </span>

                    <span className="block text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {thread.preview}
                    </span>

                    <span className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border-subtle/50 text-xs">
                      {getCategoryBadge(thread.category)}
                      <span className="text-text-muted font-mono">
                        {thread.extractedEntities?.length || 0} entities
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Right Column: Selected Thread & AI Extraction Detail (7 cols) */}
          {selectedThread && (
            <div className="lg:col-span-7 space-y-4">
              <Card className="p-5 space-y-4 border-border-strong">
                {/* Email Header */}
                <div className="space-y-2 border-b border-border-subtle pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text">{selectedThread.company}</span>
                      <span className="text-text-muted text-xs" aria-hidden="true">
                        •
                      </span>
                      <span className="text-xs text-text-secondary">
                        {selectedThread.senderName}
                      </span>
                      <code className="text-xs font-mono text-text-muted bg-surface-200 px-1 rounded">
                        &lt;{selectedThread.senderEmail}&gt;
                      </code>
                    </div>
                    {getCategoryBadge(selectedThread.category)}
                  </div>

                  <h2 className="text-base sm:text-lg font-bold text-text">
                    {selectedThread.subject}
                  </h2>

                  <div className="text-xs font-mono text-text-muted flex items-center gap-1">
                    <ClockIcon size={12} aria-hidden="true" /> Received: {selectedThread.receivedAt}
                  </div>
                </div>

                {/* AI Intelligence Extraction Box */}
                {selectedThread.extractedEntities &&
                  selectedThread.extractedEntities.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-ai-proposed/5 border border-ai-proposed/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-ai-proposed">
                          <SparklesIcon size={15} aria-hidden="true" /> AI Extraction &amp; Memory
                          Ingestion
                        </div>
                        <Link
                          href={`/workspace/${workspaceId}/memory`}
                          className="text-xs text-action hover:underline flex items-center gap-1"
                        >
                          <BrainIcon size={12} aria-hidden="true" /> View Memory Graph
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
                                <span className="text-xs font-mono uppercase text-text-muted mr-1.5">
                                  [{ent.type}]
                                </span>
                                <span className="font-medium text-text">{ent.label}:</span>{' '}
                                <span className="text-text-secondary">{ent.value}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs shrink-0 font-mono">
                                <span className="text-success flex items-center gap-0.5">
                                  <CheckIcon size={12} aria-hidden="true" /> Ingested
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
                  <div className="text-xs text-text-muted">
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
                          <SparklesIcon size={14} aria-hidden="true" /> Draft AI Response
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
