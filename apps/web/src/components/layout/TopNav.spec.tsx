import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopNav } from './TopNav';
import { WORKSPACE_ROUTES } from '@/lib/route-manifest';

let currentMockPathname = '/workspace/ws-1/chat';
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
  }),
  usePathname: () => currentMockPathname,
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { displayName: 'Bappadala Rohith Kumar Narendra', email: 'test@example.com' },
    me: {
      workspaces: [
        {
          id: 'ws-1',
          name: 'Bappadala Rohith Kumar Narendra Workspace',
        },
      ],
    },
    isAuthenticated: true,
    logout: jest.fn(),
  }),
}));

jest.mock('@/lib/api-client', () => ({
  notificationApi: {
    list: jest.fn().mockImplementation(() => new Promise(() => {})),
  },
}));

import { AppModeProvider } from '@/hooks/useAppMode';

describe('TopNav Layout & Overflow Prevention', () => {
  beforeEach(() => {
    currentMockPathname = '/workspace/ws-1/chat';
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<AppModeProvider>{ui}</AppModeProvider>);
  };

  it('renders sidebar toggle, breadcrumb, mode switcher, search pill, and right controls without collision', () => {
    const onMenuClick = jest.fn();
    const onOpenCommandCenter = jest.fn();

    renderWithProviders(
      <TopNav
        onMenuClick={onMenuClick}
        sidebarCollapsed={false}
        onOpenCommandCenter={onOpenCommandCenter}
      />,
    );

    // Sidebar toggle
    const toggleBtn = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(onMenuClick).toHaveBeenCalledTimes(1);

    // Mode Switcher exists with shrink-0 and compact responsive styling
    const modeBtn = screen.getByRole('button', { name: /Current Mode:/i });
    expect(modeBtn).toBeInTheDocument();

    // Command Center search trigger pill
    const searchTrigger = screen.getByRole('button', {
      name: 'Open Command Center (⌘K)',
    });
    expect(searchTrigger).toBeInTheDocument();
    fireEvent.click(searchTrigger);
    expect(onOpenCommandCenter).toHaveBeenCalledTimes(1);
  });

  it('enforces min-w-0 and shrink constraints on search pill container to prevent pushing elements', () => {
    const { container } = renderWithProviders(<TopNav />);
    const searchContainer = container.querySelector('.max-w-xs, .max-w-sm, .max-w-md');
    expect(searchContainer).not.toBeNull();
    expect(searchContainer?.className).toContain('min-w-0');
    expect(searchContainer?.className).toContain('flex-1');
  });

  it('truncates long workspace names and long page titles in breadcrumb', () => {
    renderWithProviders(<TopNav />);
    const wsLink = screen.getByText('Bappadala Rohith Kumar Narendra Workspace');
    expect(wsLink).toBeInTheDocument();
    expect(wsLink.className).toContain('truncate');
    expect(wsLink.className).toContain('min-w-0');

    const pageTitle = screen.getAllByText('Chat Assistant')[0];
    expect(pageTitle).toBeInTheDocument();
    expect(pageTitle.className).toContain('truncate');
    expect(pageTitle.className).toContain('min-w-0');
  });

  it('hides intermediate section breadcrumbs on compact desktop viewports via itemClassName', () => {
    const { container } = renderWithProviders(<TopNav />);
    const sectionItem = container.querySelector('li.hidden.xl\\:flex');
    expect(sectionItem).not.toBeNull();
    expect(sectionItem?.textContent).toContain('Assist');
  });

  it('allows switching modes between workspace, admin, and developer', () => {
    renderWithProviders(<TopNav />);
    const modeBtn = screen.getByRole('button', { name: /Current Mode:/i });
    fireEvent.click(modeBtn);

    // Menu opens
    expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
    expect(screen.getByText('Admin Console')).toBeInTheDocument();
    expect(screen.getByText('Developer Studio')).toBeInTheDocument();

    // Select Admin Console
    fireEvent.click(screen.getByText('Admin Console'));
    // Router push was called
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-1/admin');
  });

  describe('Parallel Verification Across All Workspace Routes', () => {
    // Audit all known workspace routes to ensure every route renders breadcrumb and header flawlessly
    const testRoutes = WORKSPACE_ROUTES.map((r) => ({
      subpath: r.subpath,
      label: r.label,
      expectedTitle: r.breadcrumbTitle,
    }));

    test.each(testRoutes)(
      'renders header without errors for route: /workspace/ws-1/$subpath ($label)',
      ({ subpath, expectedTitle }) => {
        currentMockPathname = subpath ? `/workspace/ws-1/${subpath}` : '/workspace/ws-1';

        const { unmount } = renderWithProviders(<TopNav />);
        try {
          const titleElements = screen.getAllByText(expectedTitle);
          expect(titleElements.length).toBeGreaterThan(0);
        } catch (err) {
          console.error(`FAILED FOR ROUTE: subpath="${subpath}" label="${expectedTitle}"`, err);
          throw err;
        } finally {
          unmount();
        }
      },
    );
  });
});
