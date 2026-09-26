'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Input,
  Badge,
  Select,
  SearchIcon,
  FileTextIcon,
  BrainIcon,
  BriefcaseIcon,
  ClockIcon,
  DatabaseIcon,
  CheckSquareIcon,
  ExternalLinkIcon,
  EmptyState,
} from '@vaeloom/ui-kit';
import { DEMO_SEARCH_RESULTS } from '@/lib/fixtures/search';
import type { FacetedSearchResult } from '@/lib/fixtures/search';

export default function GlobalSearchPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');

  const categories = [
    { id: 'all', label: 'All Results' },
    { id: 'document', label: 'Documents' },
    { id: 'memory', label: 'Memories' },
    { id: 'resume', label: 'Resumes' },
    { id: 'job', label: 'Jobs' },
    { id: 'task', label: 'Tasks' },
    { id: 'entity', label: 'Graph Entities' },
  ];

  const filteredResults = useMemo(() => {
    let results = DEMO_SEARCH_RESULTS;

    if (selectedCategory !== 'all') {
      results = results.filter((r) => r.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.snippet.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return [...results].sort((a, b) => {
      if (sortBy === 'score') return b.matchScore - a.matchScore;
      if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0;
    });
  }, [searchQuery, selectedCategory, sortBy]);

  const getCategoryIcon = (cat: FacetedSearchResult['category']) => {
    switch (cat) {
      case 'document':
        return <FileTextIcon size={16} className="text-action" />;
      case 'memory':
        return <BrainIcon size={16} className="text-accent" />;
      case 'resume':
        return <FileTextIcon size={16} className="text-success" />;
      case 'job':
        return <BriefcaseIcon size={16} className="text-warning" />;
      case 'task':
        return <CheckSquareIcon size={16} className="text-action" />;
      case 'entity':
        return <DatabaseIcon size={16} className="text-accent" />;
      default:
        return <SearchIcon size={16} />;
    }
  };

  const resolveUri = (uri?: string) => {
    if (!uri) return `/workspace/${workspaceId}`;
    return uri.replace('{ws}', workspaceId);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Unified Enterprise Search
            </h1>
            <Badge variant="warning" size="sm">
              DEMO INDEX
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Cross-partition semantic retrieval across memory traces, documents, resumes, and
            autonomous task logs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-2xs font-mono text-text-muted">
          <Badge variant="default" size="sm">
            Indexed Search
          </Badge>
        </div>
      </div>

      {/* Main Search Input */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-text-muted pointer-events-none">
          <SearchIcon size={18} />
        </div>
        <Input
          type="search"
          placeholder="Search memories, documents, jobs, skills, or DAG executions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm py-2.5 pl-10 shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 text-xs text-text-muted hover:text-text"
          >
            Clear
          </button>
        )}
      </div>

      {/* Controls: Category Filter Bar & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const count =
              cat.id === 'all'
                ? DEMO_SEARCH_RESULTS.length
                : DEMO_SEARCH_RESULTS.filter((r) => r.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-action text-white'
                    : 'bg-surface-200 text-text-secondary hover:text-text'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-2xs px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-300 text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-48 shrink-0">
          <Select
            label=""
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: 'Sort: Relevance Score', value: 'score' },
              { label: 'Sort: Date (Newest)', value: 'date' },
              { label: 'Sort: Alphabetical', value: 'title' },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-2xs text-text-muted px-1">
        <span>
          Found <strong>{filteredResults.length}</strong> result
          {filteredResults.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No matching items found"
            description="No entities match your query in this category partition. Try adjusting your search query or selecting 'All Results'."
            action={{
              label: 'Reset Search Filters',
              onClick: () => {
                setSearchQuery('');
                setSelectedCategory('all');
              },
            }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredResults.map((result) => (
            <Card
              key={result.id}
              className="p-4 transition-all hover:border-action/50 hover:shadow-sm group space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-md bg-surface-200 shrink-0 mt-0.5">
                    {getCategoryIcon(result.category)}
                  </div>
                  <div>
                    <span className="text-2xs font-mono uppercase tracking-wider text-text-muted">
                      {result.category}
                    </span>
                    <Link
                      href={resolveUri(result.uri)}
                      className="group-hover:text-action transition-colors block"
                    >
                      <h3 className="text-sm sm:text-base font-semibold text-text flex items-center gap-1.5">
                        {result.title}
                        <ExternalLinkIcon
                          size={12}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </h3>
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Badge variant="primary" size="sm">
                    {Math.round(result.matchScore * 100)}% match
                  </Badge>
                  <span className="text-2xs font-mono text-text-muted flex items-center gap-1">
                    <ClockIcon size={12} /> {result.date}
                  </span>
                </div>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed pl-8">{result.snippet}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle pl-8 text-2xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {result.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-surface-200 text-text font-mono text-2xs"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {result.metadata && (
                  <div className="flex items-center gap-3 text-text-muted font-mono">
                    {Object.entries(result.metadata).map(([k, v]) => (
                      <span key={k}>
                        {k}: <strong className="text-text">{v}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
