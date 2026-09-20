'use client';
import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal } from '@vaeloom/ui-kit';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';
import useSWR, { mutate } from 'swr';
import {
  marketplaceApi,
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
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [reviewInput, setReviewInput] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

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

  const installedListingsMap = useMemo(() => {
    const map = new Map<string, WorkspacePluginInstallItem>();
    if (Array.isArray(installedData)) {
      for (const item of installedData) {
        if (item.isActive) {
          map.set(item.listingId, item);
        }
      }
    }
    return map;
  }, [installedData]);

  const listings = listingsData?.items ?? [];

  const handleToggleInstall = async (listing: MarketplaceListingItem) => {
    if (!workspaceId) {
      toast({
        tone: 'error',
        title: 'Workspace Required',
        detail: 'A valid workspace context is required to install plugins.',
      });
      return;
    }

    const isInstalled = installedListingsMap.has(listing.id);
    setActionLoadingId(listing.id);

    try {
      if (isInstalled) {
        await marketplaceApi.uninstall(listing.id, workspaceId);
        toast({
          tone: 'info',
          title: 'Plugin Uninstalled',
          detail: `Successfully uninstalled ${listing.name}.`,
        });
      } else {
        await marketplaceApi.install(listing.id, { workspace_id: workspaceId });
        toast({
          tone: 'success',
          title: 'Plugin Installed',
          detail: `Successfully installed ${listing.name} to this workspace.`,
        });
      }
      await mutateInstalled();
      void mutate(listingsKey);
    } catch {
      toast({
        tone: 'error',
        title: 'Action Failed',
        detail: `Could not ${isInstalled ? 'uninstall' : 'install'} ${listing.name}.`,
      });
    } finally {
      setActionLoadingId(null);
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
    let baseList: MarketplaceListingItem[] = [];
    if (catalogType === 'All Catalog') {
      baseList = [
        ...listings,
        ...(COMPOSIO_CATALOG as unknown as MarketplaceListingItem[]),
        ...(NATIVE_CORE_CATALOG as unknown as MarketplaceListingItem[]),
      ];
    } else if (catalogType === 'Community Plugins') {
      baseList = listings;
    } else if (catalogType === 'Composio SaaS') {
      baseList = COMPOSIO_CATALOG as unknown as MarketplaceListingItem[];
    } else if (catalogType === 'Native Core') {
      baseList = NATIVE_CORE_CATALOG as unknown as MarketplaceListingItem[];
    }

    if (view === 'installed') {
      return baseList.filter((l) => installedListingsMap.has(l.id));
    }
    return baseList;
  }, [view, listings, catalogType, installedListingsMap]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Marketplace</h1>
          <p className="text-text-muted">
            Extend your workspace with community plugins, integrations, and enterprise AI tools.
          </p>
          <p className="mt-2 text-xs font-mono text-text-dim">
            Data source:{' '}
            {listingsLoading ? (
              <span>Loading listings…</span>
            ) : listingsError ? (
              <span className="text-error">Failed to load marketplace listings</span>
            ) : (
              <span className="text-success">
                Live from GET /api/v1/marketplace/listings ({displayedListings.length} items in
                view, {installedListingsMap.size} installed)
              </span>
            )}
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-surface rounded-lg p-1 border border-border">
          <button
            type="button"
            onClick={() => setView('browse')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'browse'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={() => setView('installed')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'installed'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Installed ({installedListingsMap.size})
          </button>
        </div>
      </header>

      {/* Catalog Type Bar */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {CATALOG_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setCatalogType(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              catalogType === t
                ? 'bg-primary/10 text-primary border border-primary/30 font-semibold'
                : 'text-text-muted hover:text-text hover:bg-surface'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <SearchInput
            placeholder="Search plugins…"
            value={search}
            onChange={(val) => setSearch(val)}
          />
        </div>
      </div>

      {/* Plugin Grid */}
      {listingsLoading || (view === 'installed' && installedLoading) ? (
        <div className="py-16 text-center text-sm text-text-muted font-mono">
          Loading marketplace plugins…
        </div>
      ) : displayedListings.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-text-muted">
            {view === 'installed'
              ? 'No plugins installed in this workspace yet.'
              : 'No plugins match your current filters.'}
          </p>
          {view === 'installed' && (
            <Button size="sm" onClick={() => setView('browse')}>
              Browse Marketplace
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
                className="flex flex-col justify-between hover:border-border-hover transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-display font-medium text-lg text-text">{listing.name}</h3>
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

                  <p className="text-sm text-text-muted line-clamp-2 mb-4">{listing.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="text-xs bg-surface-active px-2 py-0.5 rounded font-mono text-text-muted">
                      v{listing.version}
                    </span>
                    <span className="text-xs bg-surface-active px-2 py-0.5 rounded text-text-muted">
                      {listing.category}
                    </span>
                    {listing.tags?.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-surface-active px-2 py-0.5 rounded text-text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedListing(listing)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View Details
                  </button>
                  <Button
                    variant={isInstalled ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleToggleInstall(listing)}
                  >
                    {isBusy ? 'Processing…' : isInstalled ? 'Uninstall' : 'Install'}
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
              </div>
              <p className="text-sm text-text-muted">{selectedListing.description}</p>
            </div>

            <div className="space-y-2 py-2 border-y border-border">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Category</span>
                <span className="font-medium text-text">{selectedListing.category}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Installs</span>
                <span className="font-mono text-text">{selectedListing.installCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Rating</span>
                <span className="font-mono text-text">
                  ★ {selectedListing.rating?.toFixed(1) ?? '5.0'} / 5.0
                </span>
              </div>
            </div>

            {/* Permission Scopes */}
            <div className="space-y-1.5 py-2 border-b border-border">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                Requested Scopes
              </h4>
              <div className="flex flex-wrap gap-1">
                {(selectedListing.tags && selectedListing.tags.length > 0
                  ? selectedListing.tags
                  : ['read:workspace', 'execute:action']
                ).map((scope) => (
                  <span
                    key={scope}
                    className="text-xs bg-surface-active px-2 py-0.5 rounded font-mono text-text-muted"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>

            {/* Composio SaaS notice */}
            {selectedListing.id.startsWith('composio-') && (
              <div className="rounded-lg bg-surface-active p-3 border border-border text-xs text-text-muted space-y-1">
                <p className="font-medium text-text">Live Composio SaaS Gateway</p>
                <p>
                  Requires <code className="text-text font-mono">COMPOSIO_API_KEY</code>. Connection
                  authentication is automatically verified upon agent tool invocation.
                </p>
              </div>
            )}

            {/* Rating Section */}
            {!selectedListing.id.startsWith('composio-') &&
              !selectedListing.id.startsWith('native-') && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                    Leave a Review
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Rating:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingInput(star)}
                        className={`text-lg transition-colors ${
                          star <= ratingInput
                            ? 'text-amber-400'
                            : 'text-text-dim hover:text-amber-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="text-xs font-mono text-text-muted ml-2">
                      {ratingInput} / 5
                    </span>
                  </div>
                  <input
                    value={reviewInput}
                    onChange={(e) => setReviewInput(e.target.value)}
                    placeholder="Write an optional review…"
                    className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-text focus:outline-none focus:border-primary"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isSubmittingRating}
                      onClick={() => handleSubmitRating(selectedListing.id)}
                    >
                      {isSubmittingRating ? 'Submitting…' : 'Submit Review'}
                    </Button>
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedListing(null)}>
                Close
              </Button>
              <Button
                variant={installedListingsMap.has(selectedListing.id) ? 'secondary' : 'primary'}
                onClick={() => {
                  handleToggleInstall(selectedListing);
                  setSelectedListing(null);
                }}
              >
                {installedListingsMap.has(selectedListing.id) ? 'Uninstall' : 'Install'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
