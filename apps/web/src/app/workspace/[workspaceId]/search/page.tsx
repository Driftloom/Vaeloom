'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import {
  Card,
  Input,
  Badge,
  Select,
  SearchIcon,
  FileTextIcon,
  BrainIcon,
  BriefcaseIcon,
  DatabaseIcon,
  Spinner,
  ExternalLinkIcon,
  EmptyState,
} from '@vaeloom/ui-kit';
import { PageHeader } from '@/components/shared/Page';
import { FilterPills } from '@/components/shared/FilterPills';
import { ErrorState } from '@/components/shared/ErrorState';
import { searchApi, type SearchResponse, type SearchResult } from '@/lib/api-client';

export default function GlobalSearchPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');

  // Debounce input to reduce search load
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const categories = [
    { value: 'all', label: 'All Sources', sourceKey: undefined },
    { value: 'documents', label: 'Documents', sourceKey: 'documents' },
    { value: 'memories', label: 'Memories', sourceKey: 'memories' },
    { value: 'resumes', label: 'Resumes', sourceKey: 'resumes' },
    { value: 'jobs', label: 'Jobs', sourceKey: 'jobs' },
    { value: 'entities', label: 'Graph Entities', sourceKey: 'entities' },
  ] as const;

  const activeSourceKey = useMemo(() => {
    const found = categories.find((c) => c.value === selectedCategory);
    return found?.sourceKey ? [found.sourceKey] : undefined;
  }, [selectedCategory]);

  // Live Vector / Hybrid Search SWR
  const {
    data: searchData,
    isLoading,
    error,
    mutate: revalidateSearch,
  } = useSWR<SearchResponse>(
    workspaceId && debouncedQuery
      ? `search-${workspaceId}-${debouncedQuery}-${selectedCategory}`
      : null,
    () =>
      searchApi.all({
        query: debouncedQuery,
        sources: activeSourceKey,
        filters: { workspace_id: workspaceId },
        limit: 30,
      }),
    { revalidateOnFocus: false },
  );

  const rawResults: SearchResult[] = searchData?.results ?? [];

  const sortedResults = useMemo(() => {
    const list = [...rawResults];
    if (sortBy === 'score') {
      list.sort((a, b) => b.score - a.score);
    }
    return list;
  }, [rawResults, sortBy]);

  const getCategoryIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'documents':
      case 'document':
        return <FileTextIcon size={16} className="text-action" />;
      case 'memories':
      case 'memory':
        return <BrainIcon size={16} className="text-accent" />;
      case 'resumes':
      case 'resume':
        return <FileTextIcon size={16} className="text-success" />;
      case 'jobs':
      case 'job':
        return <BriefcaseIcon size={16} className="text-warning" />;
      case 'entities':
      case 'entity':
        return <DatabaseIcon size={16} className="text-accent" />;
      default:
        return <SearchIcon size={16} />;
    }
  };

  const resolveTargetUri = (item: SearchResult): string => {
    const src = item.source.toLowerCase();
    if (src.includes('document')) return `/workspace/${workspaceId}/files`;
    if (src.includes('memory') || src.includes('entit')) return `/workspace/${workspaceId}/memory`;
    if (src.includes('resume')) return `/workspace/${workspaceId}/resume`;
    if (src.includes('job')) return `/workspace/${workspaceId}/jobs`;
    return `/workspace/${workspaceId}`;
  };

  const getResultTitle = (item: SearchResult): string => {
    if (item.metadata?.['title']) return String(item.metadata['title']);
    if (item.metadata?.['name']) return String(item.metadata['name']);
    if (item.metadata?.['filename']) return String(item.metadata['filename']);
    return item.text.slice(0, 60) + '...';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <PageHeader
        title="Unified Enterprise Search"
        eyebrow="Live pgvector"
        description="Cross-partition semantic vector retrieval across memory traces, documents, resumes, and knowledge entities."
        actions={
          <Badge variant="default" size="sm">
            Zero-Trust Filtered
          </Badge>
        }
      />

      {/* Main Search Input */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-text-muted pointer-events-none">
          <SearchIcon size={18} />
        </div>
        <label htmlFor="global-search" className="sr-only">
          Search across documents, memories, jobs, resumes, and skills
        </label>
        <Input
          id="global-search"
          type="search"
          placeholder="Search across documents, memories, jobs, resumes, and skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm py-2.5 pl-10 shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 text-xs text-text-muted hover:text-text cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Controls: Category Filter Bar & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <FilterPills
          options={categories.map((c) => ({ value: c.value, label: c.label }))}
          value={selectedCategory}
          onChange={setSelectedCategory}
          ariaLabel="Filter search results by source"
          className="overflow-x-auto pb-1"
        />

        <div className="w-48 shrink-0">
          <label htmlFor="search-sort" className="sr-only">
            Sort search results
          </label>
          <Select
            id="search-sort"
            label=""
            value={sortBy}
            onChange={setSortBy}
            options={[
              { label: 'Sort: Relevance Score', value: 'score' },
              { label: 'Sort: Natural Index', value: 'default' },
            ]}
          />
        </div>
      </div>

      {/* Results Summary Counter */}
      <div className="flex items-center justify-between text-xs text-text-muted px-1">
        <span>
          Found <strong>{sortedResults.length}</strong> matching item
          {sortedResults.length === 1 ? '' : 's'}
          {debouncedQuery && <span> for &ldquo;{debouncedQuery}&rdquo;</span>}
        </span>
      </div>

      {/* Results Content State */}
      {isLoading ? (
        <Card className="p-12 text-center space-y-3">
          <Spinner size="md" className="text-primary" />
          <p className="text-xs text-text-muted font-medium">
            Executing hybrid vector search across workspace…
          </p>
        </Card>
      ) : !debouncedQuery ? (
        <Card className="p-12 text-center space-y-3">
          <SearchIcon size={28} className="mx-auto text-text-muted" />
          <h3 className="text-sm font-semibold text-text">Type to search your workspace</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Search for technical skills, job opportunities, document snippets, interview notes, or
            knowledge graph relations.
          </p>
        </Card>
      ) : error ? (
        <ErrorState
          title="Search failed"
          message="We couldn't retrieve results for your query. This is a connection or server issue, not an empty result."
          onRetry={() => revalidateSearch()}
        />
      ) : sortedResults.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="No matching items found"
            description="No entities match your query in this partition. Try searching for a different keyword or switching to 'All Sources'."
            action={{
              label: 'Reset Filters',
              onClick: () => {
                setSearchQuery('');
                setSelectedCategory('all');
              },
            }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedResults.map((result) => {
            const title = getResultTitle(result);
            const targetUri = resolveTargetUri(result);
            const scorePct = Math.min(100, Math.round(result.score * 100));

            return (
              <Card
                key={result.id}
                className="p-4 transition-all hover:border-action/50 hover:shadow-sm group space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-md bg-surface-200 shrink-0 mt-0.5">
                      {getCategoryIcon(result.source)}
                    </div>
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-text-muted">
                        {result.source}
                      </span>
                      <Link
                        href={targetUri}
                        className="group-hover:text-action transition-colors block"
                      >
                        <h3 className="text-sm sm:text-base font-semibold text-text flex items-center gap-1.5">
                          {title}
                          <ExternalLinkIcon
                            size={12}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </h3>
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Badge variant={scorePct > 80 ? 'success' : 'primary'} size="sm">
                      {scorePct}% match
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed pl-8">{result.text}</p>

                {result.metadata && Object.keys(result.metadata).length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border-subtle pl-8 text-xs font-mono text-text-muted">
                    {Object.entries(result.metadata)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <span key={k}>
                          {k}: <strong className="text-text">{String(v)}</strong>
                        </span>
                      ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
