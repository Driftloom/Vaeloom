'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, Modal, Select, Skeleton, ConfirmationDialog, Input } from '@vaeloom/ui-kit';
import { Tabs } from '@/components/shared/Tabs';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/Page';
import useSWR, { mutate } from 'swr';
import {
  marketplaceApi,
  type MarketplaceListingItem,
  type WorkspacePluginInstallItem,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { EnterpriseGated, useEnterpriseEnabled } from '@/components/shared/EnterpriseGated';

const CATEGORIES = ['All', 'AI', 'Analytics', 'Data', 'Integration', 'Productivity', 'Security'];

export default function MarketplacePage() {
  const enterpriseEnabled = useEnterpriseEnabled();
  if (!enterpriseEnabled) {
    return <EnterpriseGated feature="Marketplace" />;
  }
  return <MarketplaceContent />;
}

function MarketplaceContent() {
  const { toast } = useToast();
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
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
      // Read-only. This fetcher used to POST marketplaceApi.seed() whenever the
      // catalog came back empty, so every browser that loaded an empty
      // marketplace wrote to the backend from a GET, and the seed failure was
      // swallowed. Seeding is now an explicit operator action.
      return await marketplaceApi.getListings({
        category: catParam,
        search: searchParam,
        page: 1,
        page_size: 50,
      });
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

  // Install state comes only from real marketplace install records; the
  // connector-config and prefix-id paths this used to piggyback on belonged to
  // listings the backend no longer mints.
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

    const filteredListings = listings.filter(filterCatalogItem);

    let baseList: MarketplaceListingItem[] = filteredListings;

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
  }, [listings, view, installedListingsMap, category, search, sortBy]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Extend your workspace with community plugins, enterprise connectors, and autonomous agent tools."
        actions={
          <Tabs
            tabs={[
              { id: 'browse', label: 'Browse Catalog' },
              { id: 'installed', label: `Installed (${installedListingsMap.size})` },
            ]}
            activeTab={view}
            onChange={(id: string) => setView(id as 'browse' | 'installed')}
          />
        }
      />

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
              onChange={(v: string) => setSortBy(v as 'popular' | 'rating' | 'name')}
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
              onChange={(val: string) => setSearch(val)}
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
              : listingsError
                ? 'The marketplace catalog could not be loaded, so there is nothing to show.'
                : category !== 'All' || search.trim()
                  ? 'No plugins match your current filters.'
                  : 'The marketplace catalog is empty on this deployment. It is populated by an operator, not by loading this page.'}
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
                        variant={isInstalled ? 'success' : 'neutral'}
                        label={isInstalled ? 'Installed' : 'Free'}
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
                    {listing.rating != null && (
                      <span className="text-xs flex items-center gap-1 text-warning font-mono ml-auto">
                        ★ {Number(listing.rating).toFixed(1)}
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
                    {isInstalled ? 'Uninstall' : 'Install'}
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
                <span className="text-xs font-mono text-text-muted ml-2">{ratingInput} / 5</span>
              </div>
              <Input
                placeholder="Write an optional review…"
                value={reviewInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setReviewInput(e.target.value)
                }
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
                {installedListingsMap.has(selectedListing.id) ? 'Uninstall' : 'Install Plugin'}
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
