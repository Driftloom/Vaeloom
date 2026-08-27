/**
 * Landing page specs — product truth + structural/a11y invariants.
 * Self-contained polyfills so the global jest.setup stays untouched.
 */
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/hooks/useTheme';

// AuthRedirectProbe (and any nav hooks) need App Router context.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ---- Polyfills (jsdom gaps) ---------------------------------------------
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  class MockIO {
    observe = () => {};
    unobserve = () => {};
    disconnect = () => {};
    takeRecords = () => [];
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  // @ts-expect-error test polyfill
  window.IntersectionObserver = window.IntersectionObserver ?? MockIO;
  // @ts-expect-error test polyfill
  globalThis.IntersectionObserver = globalThis.IntersectionObserver ?? MockIO;
});

// R3F chunks are lazily pulled by SceneShell; stub canvas contexts so the
// WebGL gate resolves to "unsupported" deterministically in jsdom.
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type: string) {
  if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null;
  return origGetContext.call(this, type as never);
} as typeof HTMLCanvasElement.prototype.getContext;

// ---- Product truth --------------------------------------------------------
import { AGENTS, CONNECTORS, HERO, TRUST } from '@/lib/landing/copy';

describe('landing copy product truth', () => {
  it('positions Vaeloom as a memory system, not a chatbot', () => {
    expect(HERO.eyebrow.toLowerCase()).toContain('memory system');
    expect(HERO.titleB).toMatch(/education and career/i);
  });

  it('lists exactly the eight canonical MVP agents', () => {
    expect(AGENTS.list).toHaveLength(8);
    const names = AGENTS.list.map((a) => a.name);
    [
      'Orchestrator',
      'Organization Agent',
      'Memory Agent',
      'Resume Agent',
      'ATS Agent',
      'Job Search Agent',
      'Gmail Agent',
      'Scheduler Agent',
    ].forEach((n) => expect(names).toContain(n));
  });

  it('never grants Gmail send autonomy', () => {
    const gmail = AGENTS.list.find((a) => a.id === 'gmail')!;
    expect(gmail.autonomy.toLowerCase()).toContain('drafts');
    expect(gmail.autonomy.toLowerCase()).toContain('never');
  });

  it('shows only real MVP connectors', () => {
    const names = CONNECTORS.items.map((c) => c.name);
    ['Gmail', 'GitHub', 'Google Drive', 'VS Code'].forEach((n) => expect(names).toContain(n));
    expect(JSON.stringify(CONNECTORS.items)).not.toMatch(/slack|notion|linkedin/i);
  });

  it('makes no compliance certification claims', () => {
    const blob = JSON.stringify({ ...TRUST });
    expect(blob).not.toMatch(/SOC ?2|ISO ?27001|HIPAA|GDPR certified/i);
  });
});

// ---- Structural / a11y invariants -----------------------------------------

describe('landing static scenes', () => {
  it('static graph fallback renders labeled SVG without canvas', async () => {
    const { StaticGraph } = await import('@/components/landing/3d/StaticScenes');
    const { container } = render(<StaticGraph />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('static orbit fallback exposes agent chips', async () => {
    const { StaticOrbit } = await import('@/components/landing/3d/StaticScenes');
    const labels = [
      { id: 'orchestrator', name: 'Orchestrator' },
      { id: 'resume', name: 'Resume' },
    ];
    render(
      <StaticOrbit
        labels={labels}
        activeIndex={0}
        colors={{ orchestrator: '#818cf8', resume: '#34d399' }}
      />,
    );
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('renders the full landing page with heading hierarchy and CTAs', async () => {
    const LandingPage = (await import('@/app/page')).default;
    const { container } = render(
      <ThemeProvider>
        <LandingPage />
      </ThemeProvider>,
    );

    // Exactly one h1, before any h2
    const h1 = container.querySelectorAll('h1');
    expect(h1).toHaveLength(1);
    const h2s = Array.from(container.querySelectorAll('h2'));
    expect(h2s.length).toBeGreaterThanOrEqual(5);

    // Primary conversion paths exist
    const signupLinks = container.querySelectorAll<HTMLAnchorElement>('a[href="/signup"]');
    expect(signupLinks.length).toBeGreaterThanOrEqual(2);

    // Nav anchors resolve to real section ids (dead-link guard)
    const ids = new Set(Array.from(container.querySelectorAll('[id]')).map((el) => el.id));
    ['#problem', '#how-it-works', '#memory', '#agents', '#career', '#trust', '#faq'].forEach(
      (hash) => expect(ids.has(hash.slice(1))).toBe(true),
    );
    // Old dead pricing anchor must be gone
    expect(container.querySelector('a[href="#pricing"]')).toBeNull();
    // False SOC 2 claim must be gone
    expect(container.textContent).not.toMatch(/SOC ?2/i);
    // Canvases only mount client-side post-gate: none in SSR/jsdom pass
    expect(container.querySelectorAll('canvas').length).toBe(0);
  });
});
