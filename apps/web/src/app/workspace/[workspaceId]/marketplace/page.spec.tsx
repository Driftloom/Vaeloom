/**
 * Marketpalce listings reach the grid from the backend catalog only, and the
 * backend mints plain ids (`marketplace_service.py` returns `str(l.id)` UUIDs
 * and seed slugs like `slack-connector`). `composio-` / `native-` prefixed ids
 * were invented by the previous build for lookup branches no listing could ever
 * take, so this suite pins that every listing goes through one grid path, one
 * badge pair, one install path, and one detail modal.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import MarketplacePage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-test-marketplace' }),
}));

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/components/shared/EnterpriseGated', () => ({
  useEnterpriseEnabled: () => true,
  EnterpriseGated: ({ feature }: { feature?: string }) => <div>Feature disabled: {feature}</div>,
}));

jest.mock('swr', () => {
  const react = jest.requireActual('react');
  return {
    __esModule: true,
    mutate: jest.fn(),
    default: (key: unknown, fetcher?: () => Promise<unknown>) => {
      const cacheKey = Array.isArray(key) ? key.join('|') : String(key);
      const [data, setData] = react.useState<unknown>(undefined);
      const [error, setError] = react.useState<unknown>(undefined);
      react.useEffect(() => {
        let active = true;
        setData(undefined);
        setError(undefined);
        if (!fetcher) return undefined;
        fetcher().then(
          (value) => {
            if (active) setData(value);
          },
          (err: unknown) => {
            if (active) setError(err);
          },
        );
        return () => {
          active = false;
        };
      }, [cacheKey]);
      return {
        data,
        error,
        isLoading: data === undefined && error === undefined,
        mutate: jest.fn(),
      };
    },
  };
});

const mockListings: Array<Record<string, unknown>> = [
  {
    id: 'composio-firecrawl',
    name: 'Firecrawl SaaS App',
    author: 'Composio',
    category: 'Integration',
    description: 'Scrapes company pages into workspace documents.',
    tags: ['scrape', 'integration'],
    version: '1.0.0',
    rating: 4.5,
    installCount: 12,
  },
  {
    id: 'native-ats-mcp',
    name: 'Native ATS MCP',
    author: 'Vaeloom',
    category: 'Integration',
    description: 'Built-in ATS MCP server with no external dependency.',
    tags: [],
    version: '2.0.0',
    rating: null,
    installCount: 3,
  },
];

jest.mock('@/lib/api-client', () => ({
  marketplaceApi: {
    getListings: jest.fn().mockImplementation(async () => ({ items: mockListings })),
    getInstalled: jest.fn().mockResolvedValue([]),
    install: jest.fn().mockResolvedValue({ id: 'inst-1', listingId: 'list-1', isActive: true }),
    uninstall: jest.fn().mockResolvedValue(undefined),
    rate: jest.fn().mockResolvedValue({ rating: 5 }),
    seed: jest.fn().mockResolvedValue({}),
  },
  connectorsApi: {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'conn-1' }),
    delete: jest.fn().mockResolvedValue(undefined),
    mcp: {
      builtin: jest.fn().mockResolvedValue({ builtin_servers: [] }),
      sync: jest.fn(),
    },
    composio: {
      authUrl: jest.fn().mockResolvedValue({ auth_url: 'https://composio.example/oauth' }),
      sync: jest.fn(),
    },
  },
}));

/**
 * The listing card is the plain div Card that both contains the listing title
 * and is the closest `bg-surface` ancestor of it.
 */
function listingCard(title: string): HTMLElement {
  const heading = screen.getByText(title);
  const card = heading.closest('div.bg-surface');
  if (!card) throw new Error(`No card surface found for ${title}`);
  return card as HTMLElement;
}

/** The last button of a listing card is its install action ("View Details" first). */
function installAction(card: HTMLElement): HTMLButtonElement {
  const buttons = within(card).getAllByRole('button');
  if (buttons.length === 0) throw new Error('Card exposes no action button');
  return buttons[buttons.length - 1] as HTMLButtonElement;
}

describe('marketplace page', () => {
  it('renders the grid from the listed titles only', async () => {
    const { container } = render(<MarketplacePage />);

    await screen.findByText('Firecrawl SaaS App');
    screen.getByText('Native ATS MCP');
    expect(container.querySelectorAll('h3')).toHaveLength(2);
  });

  it('badges listings only as Installed or Free, never as a Composio or Native tier', async () => {
    render(<MarketplacePage />);

    const badges = (await screen.findAllByRole('status')).map((badge) => badge.textContent);
    expect(badges).toEqual(['Free', 'Free']);
  });

  it('sends composio- and native- prefixed installs through marketplaceApi.install like every other listing', async () => {
    const marketplaceApi = jest.requireMock('@/lib/api-client').marketplaceApi;
    const connectorsApi = jest.requireMock('@/lib/api-client').connectorsApi;

    render(<MarketplacePage />);

    await screen.findByText('Firecrawl SaaS App');

    fireEvent.click(installAction(listingCard('Firecrawl SaaS App')));
    await waitFor(() => expect(marketplaceApi.install).toHaveBeenCalledTimes(1));
    expect(marketplaceApi.install.mock.calls[0]).toEqual([
      'composio-firecrawl',
      { workspace_id: 'ws-test-marketplace' },
    ]);

    fireEvent.click(installAction(listingCard('Native ATS MCP')));
    await waitFor(() => expect(marketplaceApi.install).toHaveBeenCalledTimes(2));
    expect(marketplaceApi.install.mock.calls[1]).toEqual([
      'native-ats-mcp',
      { workspace_id: 'ws-test-marketplace' },
    ]);

    expect(connectorsApi.composio.authUrl).not.toHaveBeenCalled();
    expect(connectorsApi.mcp.builtin).not.toHaveBeenCalled();
  });

  it('shows one rating flow per detail modal and no native or composio notices', async () => {
    render(<MarketplacePage />);

    await screen.findByText('Native ATS MCP');
    fireEvent.click(
      within(listingCard('Native ATS MCP')).getByRole('button', { name: 'View Details' }),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Native ATS MCP' });
    expect(within(dialog).queryByText('Vaeloom Native Extension')).toBeNull();
    expect(within(dialog).queryByText('Composio SaaS Integration')).toBeNull();
    expect(within(dialog).getByText('Rate This Plugin')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Install Plugin' })).toBeInTheDocument();
  });
});
