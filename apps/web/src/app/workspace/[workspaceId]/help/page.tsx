'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Input,
  Badge,
  Button,
  SearchIcon,
  HelpCircleIcon,
  ShieldIcon,
  PlugIcon,
  CpuIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@vaeloom/ui-kit';
import { DEMO_SHORTCUTS, DEMO_HELP_ARTICLES } from '@/lib/fixtures/help';
import type { HelpArticle } from '@/lib/fixtures/help';

export default function HelpCenterPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedArticle, setExpandedArticle] = useState<string | null>('art-1');

  const categories = [
    { id: 'ALL', label: 'All Topics' },
    { id: 'GETTING_STARTED', label: 'Getting Started' },
    { id: 'AGENTS_AUTONOMY', label: 'Agents & Autonomy' },
    { id: 'CONNECTORS', label: 'Connectors & MCP' },
    { id: 'SECURITY_PRIVACY', label: 'Zero-Trust Security' },
  ];

  const filteredArticles = useMemo(() => {
    let list = DEMO_HELP_ARTICLES;
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
  }, [query, selectedCategory]);

  const filteredShortcuts = useMemo(() => {
    if (!query.trim()) return DEMO_SHORTCUTS;
    const q = query.toLowerCase();
    return DEMO_SHORTCUTS.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.scope.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Documentation & Help Center
            </h1>
            <Badge variant="mono" size="sm">
              DOCUMENTATION (PREVIEW REFERENCE)
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Enterprise architecture manuals, autonomy governance guides, and power-user shortcut
            registries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/workspace/${workspaceId}/settings/security`}>
            <Button variant="outline" size="sm">
              <span className="flex items-center gap-1.5">
                <ShieldIcon size={14} /> Security & MFA
              </span>
            </Button>
          </Link>
          <Link href={`/workspace/${workspaceId}/connectors`}>
            <Button variant="outline" size="sm">
              <span className="flex items-center gap-1.5">
                <PlugIcon size={14} /> Integrations
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-text-muted pointer-events-none">
          <SearchIcon size={18} />
        </div>
        <Input
          type="search"
          placeholder="Search guides, architectural concepts, or shortcuts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-sm py-2.5 pl-10 shadow-sm"
        />
      </div>

      {/* Keyboard Shortcuts Reference */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <CpuIcon size={16} className="text-action" /> Keyboard Shortcuts Cheatsheet
          </h2>
          <span className="text-2xs font-mono text-text-muted">
            Press{' '}
            <kbd className="bg-surface-200 px-1 py-0.5 rounded border border-border-subtle">?</kbd>{' '}
            anywhere to trigger
          </span>
        </div>

        <Card className="p-0 overflow-hidden border-border-strong">
          <div className="divide-y divide-border-subtle">
            {filteredShortcuts.map((sc, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 text-xs hover:bg-surface-100 transition-colors gap-2"
              >
                <div className="flex items-center gap-3">
                  <kbd className="font-mono text-xs font-semibold px-2 py-1 rounded bg-surface-200 border border-border-strong text-text shadow-2xs shrink-0">
                    {sc.key}
                  </kbd>
                  <span className="text-text font-medium">{sc.description}</span>
                </div>
                <span className="text-2xs font-mono text-text-muted px-2 py-0.5 rounded bg-surface-200/50 self-start sm:self-auto">
                  Scope: {sc.scope}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Documentation Articles */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
            <HelpCircleIcon size={16} className="text-action" /> Architectural Guides & Manuals
          </h2>

          {/* Topic Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-action text-white'
                    : 'bg-surface-200 text-text-secondary hover:text-text'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <Card className="p-6 text-center text-xs text-text-muted">
            No guides match your query. Try a different search term.
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredArticles.map((article: HelpArticle) => {
              const isExpanded = expandedArticle === article.id;

              return (
                <Card
                  key={article.id}
                  className="p-4 transition-all border-border-strong hover:border-action/40"
                >
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedArticle(isExpanded ? null : article.id)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          {article.category.replace('_', ' ')}
                        </Badge>
                        <span className="text-2xs font-mono text-text-muted flex items-center gap-1">
                          <ClockIcon size={12} /> {article.readTime}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-text pt-0.5">
                        {article.title}
                      </h3>
                      <p className="text-xs text-text-secondary">{article.summary}</p>
                    </div>

                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse guide' : 'Expand guide'}
                      className="p-1 rounded text-text-muted hover:text-text"
                    >
                      {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border-subtle text-xs text-text leading-relaxed whitespace-pre-line bg-surface-100 p-4 rounded-lg font-sans">
                      {article.content}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Support & Sovereign Rights Banner */}
      <Card className="p-5 border-border-strong bg-surface-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text">
              Zero-Trust Verification & Enterprise Support
            </h3>
            <p className="text-xs text-text-secondary">
              Review machine-generated evidence, verify cryptographic deletion receipts, or audit
              API contracts.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href={`/workspace/${workspaceId}/settings`}>
              <Button variant="outline" size="sm">
                Workspace Audit
              </Button>
            </Link>
            <Link href={`/workspace/${workspaceId}/vault`}>
              <Button variant="primary" size="sm">
                Audit Keys
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
