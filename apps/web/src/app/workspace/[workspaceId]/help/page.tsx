'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, Input, Button, SearchIcon, ChevronDownIcon, ChevronUpIcon } from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { FilterPills } from '@/components/shared/FilterPills';
import { WORKSPACE_ROUTES } from '@/lib/route-manifest';

interface LiveHelpArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: string;
  readTime: string;
  link?: string;
}

interface LiveShortcut {
  key: string;
  description: string;
  scope: string;
}

const SYSTEM_SHORTCUTS: LiveShortcut[] = [
  {
    key: '⌘ + K / Ctrl + K',
    description: 'Open Global Command Center & Omnisearch',
    scope: 'Global',
  },
  {
    key: '⌘ + B / Ctrl + B',
    description: 'Toggle Navigation Sidebar collapsed state',
    scope: 'Global',
  },
  { key: 'Esc', description: 'Dismiss modal, drawer, or active prompt popover', scope: 'Global' },
  {
    key: 'Ctrl + Enter',
    description: 'Save and submit modal form or active editor',
    scope: 'Forms & Modals',
  },
  {
    key: 'Tab / Shift + Tab',
    description: 'Move focus between the Approve and Reject controls on a pending proposal',
    scope: 'Approvals',
  },
  {
    key: 'A / R',
    description:
      'Approve or reject the focused approval card without reaching for the mouse. The card must have focus (Tab to it); the buttons display the same hint.',
    scope: 'Approvals',
  },
  { key: 'Space', description: 'Play / pause audio or preview in media views', scope: 'Workspace' },
];

export default function HelpCenterPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedArticle, setExpandedArticle] = useState<string | null>('art-nav');

  // Dynamically generate documentation topics from canonical WORKSPACE_ROUTES
  const dynamicArticles: LiveHelpArticle[] = useMemo(() => {
    const coreGuides: LiveHelpArticle[] = [
      {
        id: 'art-nav',
        category: 'GETTING_STARTED',
        title: 'Vaeloom Autonomous Operating System Overview',
        summary:
          'Understand the multi-agent architecture, unified routing brain, and zero-trust data partitioning.',
        content: `Vaeloom coordinates specialized AI agents (JobSearchAgent, ResumeBuilderAgent, GmailAgent, ApplicationAgent) through a unified ReAct reasoning loop. All agent operations are scoped strictly per workspace with Row-Level Security (RLS) enforcement at the database level.`,
        readTime: '3 min read',
      },
      {
        id: 'art-dual-brain',
        category: 'AGENTS_AUTONOMY',
        title: 'Cognitive Architecture: Fast Triage vs Generative Synthesis',
        summary: 'Deterministic <50ms action triage combined with grounded System 2 LLM reasoning.',
        content: `Deterministic fast-paths evaluate safety constraints and classification before routing complex requests to generative frontier models. Destructive actions (like submitting applications or modifying external files) trigger human-in-the-loop (HITL) approval gates.`,
        readTime: '4 min read',
        link: `/workspace/${workspaceId}/cognition`,
      },
      {
        id: 'art-mcp',
        category: 'CONNECTORS',
        title: 'Model Context Protocol (MCP) & Composio SaaS Bridges',
        summary: 'How to connect verified local stdio servers and external OAuth integrations.',
        content: `Integrate standard Model Context Protocol v2 servers and OAuth SaaS tools. Tools are dynamically registered with parameter schemas and verified before autonomous execution.`,
        readTime: '5 min read',
        link: `/workspace/${workspaceId}/connectors`,
      },
      {
        id: 'art-zero-trust',
        category: 'SECURITY_PRIVACY',
        title: 'Zero-Trust Security, Sovereign Keys & Data Rights',
        summary: 'Cryptographic DID identity, local vault encryption, and automated audit logging.',
        content: `All private secrets and provider keys are encrypted with AES-256-GCM. Workspace isolation guarantees that one workspace's agents and tools can never access or leak data to another tenant.`,
        readTime: '4 min read',
        link: `/workspace/${workspaceId}/vault`,
      },
    ];

    // Append route-specific mini-guides
    const routeGuides: LiveHelpArticle[] = WORKSPACE_ROUTES.filter((r) => r.subpath).map(
      (route) => ({
        id: `route-${route.id}`,
        category:
          route.section === 'Operations'
            ? 'AGENTS_AUTONOMY'
            : route.section === 'Assist'
              ? 'GETTING_STARTED'
              : 'CONNECTORS',
        title: `${route.label} Guide`,
        summary: route.description || `Documentation and quick tips for using ${route.label}.`,
        content: `Access ${route.label} at /workspace/${workspaceId}/${route.subpath}. This module operates under ${route.dataMode.toUpperCase()} mode with verified backend API integration.`,
        readTime: '2 min read',
        link: `/workspace/${workspaceId}/${route.subpath}`,
      }),
    );

    return [...coreGuides, ...routeGuides];
  }, [workspaceId]);

  const categories = [
    { value: 'ALL', label: 'All Topics' },
    { value: 'GETTING_STARTED', label: 'Getting Started' },
    { value: 'AGENTS_AUTONOMY', label: 'Agents & Autonomy' },
    { value: 'CONNECTORS', label: 'Connectors & MCP' },
    { value: 'SECURITY_PRIVACY', label: 'Zero-Trust Security' },
  ];

  const filteredArticles = useMemo(() => {
    let list = dynamicArticles;
    if (selectedCategory !== 'ALL') {
      list = list.filter((a) => a.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q),
      );
    }
    return list;
  }, [dynamicArticles, query, selectedCategory]);

  const filteredShortcuts = useMemo(() => {
    if (!query.trim()) return SYSTEM_SHORTCUTS;
    const q = query.toLowerCase();
    return SYSTEM_SHORTCUTS.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.scope.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <PageHeader
        title="Documentation &amp; Help Center"
        eyebrow="Static docs"
        description="Product documentation, keyboard shortcuts, and architecture guides."
        actions={
          <Link
            href={`/workspace/${workspaceId}/chat?prompt=${encodeURIComponent('Explain how Vaeloom agents collaborate on career progression and ATS tailoring.')}`}
          >
            <Button variant="outline" size="sm">
              Ask AI Copilot
            </Button>
          </Link>
        }
      />

      {/* Search Input */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-text-muted pointer-events-none">
          <SearchIcon size={18} />
        </div>
        <label htmlFor="help-search" className="sr-only">
          Search guides, architectural concepts, or keyboard shortcuts
        </label>
        <Input
          id="help-search"
          type="search"
          placeholder="Search guides, architectural concepts, or keyboard shortcuts..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          className="text-sm py-2.5 pl-10 shadow-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 text-xs text-text-muted hover:text-text cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <FilterPills
        options={categories}
        value={selectedCategory}
        onChange={setSelectedCategory}
        ariaLabel="Filter documentation by category"
      />

      {/* Articles Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-text uppercase tracking-wider">
          Articles &amp; Architecture Guides ({filteredArticles.length})
        </h2>

        {filteredArticles.length === 0 ? (
          <Card className="p-8 text-center text-text-muted text-xs">
            No documentation matching your search criteria.
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredArticles.map((art) => {
              const isExpanded = expandedArticle === art.id;
              const bodyId = `help-article-body-${art.id}`;

              return (
                <Card key={art.id} className="p-4 transition-all hover:border-action/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase text-action font-semibold">
                          {art.category.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-text-muted">• {art.readTime}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-text">{art.title}</h3>
                      <p className="text-xs text-text-secondary">{art.summary}</p>
                    </div>

                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={bodyId}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${art.title}`}
                      onClick={() => setExpandedArticle(isExpanded ? null : art.id)}
                      className="p-1 text-text-muted hover:text-text"
                    >
                      {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      id={bodyId}
                      className="pt-3 mt-3 border-t border-border-subtle text-xs text-text leading-relaxed space-y-2"
                    >
                      <p>{art.content}</p>
                      {art.link && (
                        <div className="pt-1">
                          <Link
                            href={art.link}
                            className="text-action hover:underline font-medium inline-flex items-center gap-1"
                          >
                            Open {art.title} Module &rarr;
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="space-y-4 pt-4 border-t border-border-subtle">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text uppercase tracking-wider">
            Operational Keyboard Shortcuts ({filteredShortcuts.length})
          </h2>
          <span className="text-xs text-text-muted font-mono">Platform Standard</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredShortcuts.map((sc) => (
            <Card
              key={sc.key}
              className="p-3.5 flex items-center justify-between gap-3 bg-surface-100"
            >
              <div>
                <p className="text-xs font-medium text-text">{sc.description}</p>
                <span className="text-xs text-text-muted font-mono">{sc.scope}</span>
              </div>
              <kbd className="px-2 py-1 rounded bg-surface border border-border-strong font-mono text-xs text-text shrink-0 shadow-2xs">
                {sc.key}
              </kbd>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
