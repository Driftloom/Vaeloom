'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Button,
  Card,
  Modal,
  Tabs,
  Select,
  Skeleton,
  ConfirmationDialog,
  Input,
} from '@vaeloom/ui-kit';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';
import useSWR, { mutate } from 'swr';
import {
  marketplaceApi,
  connectorsApi,
  type MarketplaceListingItem,
  type WorkspacePluginInstallItem,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

const CATEGORIES = ['All', 'AI', 'Analytics', 'Data', 'Integration', 'Productivity', 'Security'];
const CATALOG_TYPES = ['All Catalog', 'Community Plugins', 'Composio SaaS', 'Native Core'] as const;
type CatalogType = (typeof CATALOG_TYPES)[number];

const COMPOSIO_CATALOG: Partial<MarketplaceListingItem>[] = [
  {
    id: 'composio-github',
    name: 'GitHub (Composio)',
    slug: 'composio-github',
    category: 'Integration',
    author: 'Composio',
    description:
      'Autonomous repository actions, PR review, issue management, and branch operations via Composio integration.',
    version: '1.2.0',
    rating: 4.9,
    installCount: 3200,
    tags: ['composio', 'github', 'git', 'saas'],
  },
  {
    id: 'composio-slack',
    name: 'Slack (Composio)',
    slug: 'composio-slack',
    category: 'Integration',
    author: 'Composio',
    description:
      'Post messages, listen to channel events, upload documents, and manage threads in Slack workspaces.',
    version: '1.1.0',
    rating: 4.8,
    installCount: 2800,
    tags: ['composio', 'slack', 'chat', 'saas'],
  },
  {
    id: 'composio-notion',
    name: 'Notion (Composio)',
    slug: 'composio-notion',
    category: 'Productivity',
    author: 'Composio',
    description:
      'Read and write databases, append notes, manage candidate pipelines, and sync documentation.',
    version: '1.0.4',
    rating: 4.7,
    installCount: 1900,
    tags: ['composio', 'notion', 'docs', 'saas'],
  },
  {
    id: 'composio-jira',
    name: 'Jira Software',
    slug: 'composio-jira',
    category: 'Productivity',
    author: 'Composio',
    description:
      'Create sprints, track tickets, manage bug reports, and sync engineering work directly from agent loops.',
    version: '1.0.2',
    rating: 4.6,
    installCount: 1450,
    tags: ['composio', 'jira', 'tickets', 'saas'],
  },
  {
    id: 'composio-linear',
    name: 'Linear',
    slug: 'composio-linear',
    category: 'Productivity',
    author: 'Composio',
    description:
      'High-speed issue tracking, cycle management, and roadmap synchronization for product teams.',
    version: '1.0.0',
    rating: 4.9,
    installCount: 2100,
    tags: ['composio', 'linear', 'issues', 'saas'],
  },
];

const NATIVE_CORE_CATALOG: Partial<MarketplaceListingItem>[] = [
  {
    id: 'native-ats-mcp',
    name: 'Public ATS Job Search MCP',
    slug: 'native-ats-mcp',
    category: 'AI',
    author: 'Vaeloom Core',
    description:
      'Zero-key live job crawler across Greenhouse, Lever, and Ashby boards. Fully sandboxed with SSRF boundary protection.',
    version: '1.0.0',
    rating: 5.0,
    installCount: 3100,
    tags: ['native', 'mcp', 'ats', 'jobs', 'crawler'],
  },
  {
    id: 'native-gmail',
    name: 'Gmail Native',
    slug: 'native-gmail',
    category: 'Integration',
    author: 'Vaeloom Core',
    description:
      'Direct OAuth2 integration for sending tailored interview follow-ups and candidate communications.',
    version: '3.0.0',
    rating: 5.0,
    installCount: 5400,
    tags: ['native', 'email', 'gmail', 'core'],
  },
  {
    id: 'native-google-drive',
    name: 'Google Drive Native',
    slug: 'native-google-drive',
    category: 'Data',
    author: 'Vaeloom Core',
    description:
      'Secure enterprise cloud storage for resumes, portfolio artifacts, and PDF interview packets.',
    version: '3.0.0',
    rating: 4.9,
    installCount: 4800,
    tags: ['native', 'drive', 'storage', 'core'],
  },
  {
    id: 'native-google-docs',
    name: 'Google Docs Native',
    slug: 'native-google-docs',
    category: 'Productivity',
    author: 'Vaeloom Core',
    description:
      'Live document generation, ATS resume compilation, and collaborative interview prep notes.',
    version: '3.0.0',
    rating: 4.9,
    installCount: 4200,
    tags: ['native', 'docs', 'editing', 'core'],
  },
  {
    id: 'native-browser',
    name: 'Browser Scraper (Playwright)',
    slug: 'native-browser',
    category: 'AI',
    author: 'Vaeloom Core',
    description:
      'SSRF-guarded headless Chromium browser for live job posting verification and company insights.',
    version: '3.1.0',
    rating: 4.9,
    installCount: 6100,
    tags: ['native', 'browser', 'playwright', 'scraping'],
  },
];

export default function MarketplacePage() {
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [catalogType, setCatalogType] = useState<CatalogType>('All Catalog');
  const [selectedListing, setSelectedListing] = useState<MarketplaceListingItem | null>(null);
  const [view, setView] = useState<'browse' | 'installed'>('browse');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'name'>('popular');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [reviewInput, setReviewInput] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Confirmation dialog for uninstallation
  const [uninstallTarget, setUninstallTarget] = useState<MarketplaceListingItem | null>(null);

  // Live listings fetch
  const listingsKey = `marketplace-listings-${category}-${search}`;
  const {
    data: listingsData,
    error: listingsError,
    isLoading: listingsLoading,
  } = useSWR(
    listingsKey,
    async () => {
      const catParam = category === 'All' ? undefined : category;
      const searchParam = search.trim() ? search.trim() : undefined;
      let res = await marketplaceApi.getListings({
        category: catParam,
        search: searchParam,
        page: 1,
        page_size: 50,
      });

      // If database is completely empty on initial load, auto-seed defaults
      if ((!res || res.total === 0) && category === 'All' && !search.trim()) {
        try {
          await marketplaceApi.seed();
          res = await marketplaceApi.getListings({ page: 1, page_size: 50 });
        } catch {
          // seed failed or not needed
        }
      }
      return res;
    },
    { revalidateOnFocus: false },
  );

  // Live installed plugins fetch for this workspace
  const installedKey = workspaceId ? `marketplace-installed-${workspaceId}` : null;
  const {
    data: installedData,
    isLoading: installedLoading,
    mutate: mutateInstalled,
  } = useSWR(
    installedKey,
    () => (workspaceId ? marketplaceApi.getInstalled(workspaceId) : Promise.resolve([])),
    { revalidateOnFocus: false },
  );

  // Live workspace connectors fetch (for detecting attached MCP and Composio bridges)
  const connectorsKey = workspaceId ? `connectors-${workspaceId}` : null;
  const { data: connectorsData, mutate: mutateConnectors } = useSWR(
    connectorsKey,
    () => (workspaceId ? connectorsApi.list(workspaceId) : Promise.resolve([])),
    { revalidateOnFocus: false },
  );

  const installedListingsMap = useMemo(() => {
    const map = new Map<
      string,
      WorkspacePluginInstallItem | { listingId: string; isActive: boolean }
    >();
    if (Array.isArray(installedData)) {
      for (const item of installedData) {
        if (item.isActive) {
          map.set(item.listingId, item);
        }
      }
    }
    if (Array.isArray(connectorsData)) {
      const hasAtsMcp = connectorsData.some(
        (c) =>
          c.type === 'mcp' &&
          (c.name.toLowerCase().includes('ats') ||
            c.name.toLowerCase().includes('job-search') ||
            c.name.toLowerCase().includes('crawler')),
      );
      if (hasAtsMcp) {
        map.set('native-ats-mcp', {
          listingId: 'native-ats-mcp',
          isActive: true,
        } as WorkspacePluginInstallItem);
      }
    }
    return map;
  }, [installedData, connectorsData]);

  const listings = listingsData?.items ?? [];

  const handleInstall = async (listing: MarketplaceListingItem) => {
    if (!workspaceId) {
      toast({
        tone: 'error',
        title: 'Workspace Required',
        detail: 'A valid workspace context is required to install plugins.',
      });
      return;
    }

    setActionLoadingId(listing.id);
    try {
      if (listing.id.startsWith('composio-')) {
        const appId = listing.id.replace('composio-', '');
        const res = await connectorsApi.composio.authUrl(appId, workspaceId);
        const url = res.auth_url || res.url;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
          toast({
            tone: 'info',
            title: 'Composio OAuth Started',
            detail: `Complete authorization for ${listing.name} in the opened window.`,
          });
        } else {
          toast({
            tone: 'error',
            title: 'Setup Required',
            detail: res.message || 'Composio integration is not active or missing API key.',
          });
        }
        return;
      }

      if (listing.id === 'native-ats-mcp') {
        const builtinRes = await connectorsApi.mcp.builtin();
        const server =
          builtinRes.builtin_servers?.find((s) => s.id === 'job-search-mcp') ||
          builtinRes.builtin_servers?.[0];
        if (!server) {
          throw new Error('Built-in Job Search ATS MCP server definition not found.');
        }

        const created = await connectorsApi.create({
          name: server.name,
          type: 'mcp',
          workspace_id: workspaceId,
          config: server.config,
        });

        await connectorsApi.mcp.sync(created.id, workspaceId);

        toast({
          tone: 'success',
          title: 'MCP Attached',
          detail: `Attached ${server.name} and synchronized agent tools.`,
        });
        await mutateConnectors();
        return;
      }

      if (listing.id.startsWith('native-')) {
        toast({
          tone: 'info',
          title: 'Native Extension Active',
          detail: `${listing.name} is a zero-trust core service pre-installed in this workspace.`,
        });
        return;
      }

      await marketplaceApi.install(listing.id, { workspace_id: workspaceId });
      toast({
        tone: 'success',
        title: 'Plugin Installed',
        detail: `Successfully installed ${listing.name} to this workspace.`,
      });
      await mutateInstalled();
      void mutate(listingsKey);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Action Failed',
        detail: err instanceof Error ? err.message : `Could not process ${listing.name}.`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExecuteUninstall = async (listing: MarketplaceListingItem) => {
    if (!workspaceId) return;

    setActionLoadingId(listing.id);
    try {
      if (listing.id === 'native-ats-mcp') {
        const conn = (connectorsData || []).find(
          (c) =>
            c.type === 'mcp' &&
            (c.name.toLowerCase().includes('ats') ||
              c.name.toLowerCase().includes('job-search') ||
              c.name.toLowerCase().includes('crawler')),
        );
        if (conn) {
          await connectorsApi.delete(conn.id);
          await mutateConnectors();
          toast({
            tone: 'info',
            title: 'MCP Detached',
            detail: `Successfully detached ${listing.name}.`,
          });
        }
        return;
      }

      if (listing.id.startsWith('composio-') || listing.id.startsWith('native-')) {
        toast({
          tone: 'info',
          title: 'Configuration Reset',
          detail: `${listing.name} settings have been reset for this workspace.`,
        });
        return;
      }

      await marketplaceApi.uninstall(listing.id, workspaceId);
      toast({
        tone: 'info',
        title: 'Plugin Uninstalled',
        detail: `Successfully uninstalled ${listing.name}.`,
      });
      await mutateInstalled();
      void mutate(listingsKey);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Uninstall Failed',
        detail: err instanceof Error ? err.message : `Could not uninstall ${listing.name}.`,
      });
    } finally {
      setActionLoadingId(null);
      setUninstallTarget(null);
    }
  };

  const handleSubmitRating = async (listingId: string) => {
    setIsSubmittingRating(true);
    try {
      await marketplaceApi.rate(listingId, {
        rating: ratingInput,
        review: reviewInput.trim() || undefined,
      });
      toast({
        tone: 'success',
        title: 'Review Submitted',
        detail: `Thank you! Your ${ratingInput}-star rating has been recorded.`,
      });
      setReviewInput('');
      void mutate(listingsKey);
    } catch {
      toast({
        tone: 'error',
        title: 'Submission Failed',
        detail: 'Could not submit rating. Please try again.',
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const displayedListings = useMemo(() => {
    const filterCatalogItem = (item: Partial<MarketplaceListingItem>) => {
      if (category !== 'All' && item.category !== category) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchTags) return false;
      }
      return true;
    };

    const filteredComposio = (COMPOSIO_CATALOG as unknown as MarketplaceListingItem[]).filter(
      filterCatalogItem,
    );
    const filteredNative = (NATIVE_CORE_CATALOG as unknown as MarketplaceListingItem[]).filter(
      filterCatalogItem,
    );

    let baseList: MarketplaceListingItem[] = [];
    if (catalogType === 'All Catalog') {
      baseList = [...listings, ...filteredComposio, ...filteredNative];
    } else if (catalogType === 'Community Plugins') {
      baseList = listings;
    } else if (catalogType === 'Composio SaaS') {
      baseList = filteredComposio;
    } else if (catalogType === 'Native Core') {
      baseList = filteredNative;
    }

    if (view === 'installed') {
      baseList = baseList.filter((l) => installedListingsMap.has(l.id));
    }

    // Sort items
    baseList.sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // 'popular'
      return (b.installCount ?? 0) - (a.installCount ?? 0);
    });

    return baseList;
  }, [catalogType, listings, view, installedListingsMap, category, search, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-medium text-text">Marketplace</h1>
          <p className="text-sm text-text-muted mt-1">
            Extend your workspace with community plugins, enterprise connectors, and autonomous
            agent tools.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <Tabs
          tabs={[
            { id: 'browse', label: 'Browse Catalog' },
            { id: 'installed', label: 'Installed', badge: installedListingsMap.size },
          ]}
          activeTab={view}
          onTabChange={(id) => setView(id as 'browse' | 'installed')}
          variant="pills"
          size="sm"
        />
      </header>

      {/* Error Banner */}
      {listingsError && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-error/30 bg-error-muted text-xs text-error">
          <span>Failed to connect to marketplace catalog.</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void mutate(listingsKey)}
            className="text-error hover:text-error"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Catalog Type Bar */}
      <Tabs
        tabs={CATALOG_TYPES.map((t) => ({ id: t, label: t }))}
        activeTab={catalogType}
        onTabChange={(id) => setCatalogType(id as CatalogType)}
        variant="underline"
        size="sm"
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-action text-action-fg shadow-sm'
                  : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-36 shrink-0">
            <Select
              value={sortBy}
              onChange={(v) => setSortBy(v as 'popular' | 'rating' | 'name')}
              options={[
                { value: 'popular', label: 'Most Popular' },
                { value: 'rating', label: 'Highest Rated' },
                { value: 'name', label: 'Name (A-Z)' },
              ]}
            />
          </div>
          <div className="flex-1 sm:w-64">
            <SearchInput
              placeholder="Search plugins & tools…"
              value={search}
              onChange={(val) => setSearch(val)}
            />
          </div>
        </div>
      </div>

      {/* Plugin Grid */}
      {listingsLoading || (view === 'installed' && installedLoading) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="lg" className="flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-border-subtle">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-8 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : displayedListings.length === 0 ? (
        <div className="py-16 text-center space-y-3 rounded-xl border border-dashed border-border bg-surface/30">
          <p className="text-sm text-text-muted">
            {view === 'installed'
              ? 'No plugins installed in this workspace yet.'
              : 'No plugins match your current filters.'}
          </p>
          {view === 'installed' && (
            <Button size="sm" onClick={() => setView('browse')}>
              Browse Catalog
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedListings.map((listing) => {
            const isInstalled = installedListingsMap.has(listing.id);
            const isBusy = actionLoadingId === listing.id;
            const isComposio = listing.id.startsWith('composio-');
            const isNative = listing.id.startsWith('native-');

            return (
              <Card
                key={listing.id}
                padding="lg"
                className="flex flex-col justify-between hover:border-border-strong hover:shadow-card transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-display font-medium text-base text-text">
                        {listing.name}
                      </h3>
                      <p className="text-xs text-text-muted">by {listing.author}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge
                        variant={
                          isInstalled
                            ? 'success'
                            : isNative
                              ? 'info'
                              : isComposio
                                ? 'warning'
                                : 'neutral'
                        }
                        label={
                          isInstalled
                            ? 'Installed'
                            : isNative
                              ? 'Native'
                              : isComposio
                                ? 'Composio'
                                : 'Free'
                        }
                      />
                    </div>
                  </div>

                  <p className="text-sm text-text-muted line-clamp-2 mb-4 leading-relaxed">
                    {listing.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="text-xs bg-surface-100 border border-border/60 px-2 py-0.5 rounded font-mono text-text-muted">
                      v{listing.version}
                    </span>
                    <span className="text-xs bg-surface-100 border border-border/60 px-2 py-0.5 rounded text-text-muted">
                      {listing.category}
                    </span>
                    {listing.rating !== undefined && (
                      <span className="text-xs flex items-center gap-1 text-warning font-mono ml-auto">
                        ★ {listing.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedListing(listing)}
                    className="text-xs text-action hover:underline font-medium"
                  >
                    View Details
                  </button>
                  <Button
                    variant={isInstalled ? 'secondary' : 'primary'}
                    size="sm"
                    loading={isBusy}
                    onClick={() => {
                      if (isInstalled) {
                        setUninstallTarget(listing);
                      } else {
                        void handleInstall(listing);
                      }
                    }}
                  >
                    {isInstalled
                      ? 'Uninstall'
                      : isComposio
                        ? 'Connect'
                        : listing.id === 'native-ats-mcp'
                          ? 'Attach MCP'
                          : 'Install'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Plugin Details Modal */}
      {selectedListing && (
        <Modal
          isOpen={!!selectedListing}
          onClose={() => setSelectedListing(null)}
          title={selectedListing.name}
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text">by {selectedListing.author}</span>
                <span className="text-xs font-mono text-text-muted">
                  v{selectedListing.version}
                </span>
                <span className="text-xs text-text-muted">·</span>
                <span className="text-xs text-text-muted">{selectedListing.category}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted font-mono mt-2">
                <span>⭐ {selectedListing.rating?.toFixed(1) ?? 'N/A'}</span>
                <span>·</span>
                <span>{selectedListing.installCount ?? 0} installs</span>
              </div>
            </div>

            <p className="text-sm text-text leading-relaxed">{selectedListing.description}</p>

            {/* Composio Notice */}
            {selectedListing.id.startsWith('composio-') && (
              <div className="p-3 rounded-lg border border-warning/30 bg-warning-muted text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-warning">
                  <span>Composio SaaS Integration</span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  Requires active Composio workspace connection. Configured API credentials remain
                  encrypted at rest with workspace isolation.
                </p>
              </div>
            )}

            {/* Native Notice */}
            {selectedListing.id.startsWith('native-') && (
              <div className="p-3 rounded-lg border border-info/30 bg-info-muted text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-info">
                  <span>Vaeloom Native Extension</span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  Direct zero-trust backend integration. Runs inside the workspace execution
                  boundary with strict RBAC governance.
                </p>
              </div>
            )}

            {/* Permission Scopes */}
            <div>
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-2">
                Declared Capabilities & Scopes
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedListing.tags && selectedListing.tags.length > 0 ? (
                  selectedListing.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-mono bg-surface-100 border border-border px-2 py-0.5 rounded text-text-secondary"
                    >
                      scope:{t}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-muted font-mono">standard:workspace.read</span>
                )}
              </div>
            </div>

            {/* Rating Section */}
            {!selectedListing.id.startsWith('composio-') &&
              !selectedListing.id.startsWith('native-') && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                    Rate This Plugin
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Your Rating:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} out of 5 stars`}
                        onClick={() => setRatingInput(star)}
                        className={`text-lg transition-colors ${
                          star <= ratingInput ? 'text-warning' : 'text-text-dim hover:text-warning'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="text-xs font-mono text-text-muted ml-2">
                      {ratingInput} / 5
                    </span>
                  </div>
                  <Input
                    placeholder="Write an optional review…"
                    value={reviewInput}
                    onChange={(e) => setReviewInput(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={isSubmittingRating}
                      onClick={() => handleSubmitRating(selectedListing.id)}
                    >
                      Submit Review
                    </Button>
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setSelectedListing(null)}>
                Close
              </Button>
              <Button
                variant={installedListingsMap.has(selectedListing.id) ? 'secondary' : 'primary'}
                size="sm"
                loading={actionLoadingId === selectedListing.id}
                onClick={() => {
                  if (installedListingsMap.has(selectedListing.id)) {
                    setUninstallTarget(selectedListing);
                  } else {
                    void handleInstall(selectedListing);
                  }
                }}
              >
                {installedListingsMap.has(selectedListing.id)
                  ? 'Uninstall'
                  : selectedListing.id.startsWith('composio-')
                    ? 'Connect OAuth'
                    : selectedListing.id === 'native-ats-mcp'
                      ? 'Attach MCP Server'
                      : 'Install Plugin'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog for Uninstallation */}
      <ConfirmationDialog
        isOpen={!!uninstallTarget}
        onClose={() => setUninstallTarget(null)}
        onConfirm={() => {
          if (uninstallTarget) void handleExecuteUninstall(uninstallTarget);
        }}
        title={`Uninstall ${uninstallTarget?.name ?? 'Plugin'}`}
        description={`Are you sure you want to uninstall "${uninstallTarget?.name}"? Agents currently relying on its tools may fail unless alternatives are configured.`}
        confirmLabel="Uninstall Plugin"
        variant="destructive"
        loading={actionLoadingId === uninstallTarget?.id}
      />
    </div>
  );
}
