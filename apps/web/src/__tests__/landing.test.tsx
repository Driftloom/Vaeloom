/**
 * Landing page specs — product truth + structural/a11y invariants.
 * Self-contained polyfills so the global jest.setup stays untouched.
 */
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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
  it('has correct title', () => {
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

describe('landing 3D stage wiring', () => {
  /**
   * The agents beat used to render seven invented ids ('researcher',
   * 'scholar', 'planner', 'writer', 'critic', 'journal') that exist nowhere
   * in the product. Six of the seven missed AGENT_HUES and so all rendered
   * the fallback indigo, while the DOM legend showed eight distinct hues and
   * the section's aria-label claimed "Eight specialist agents". The 3D and
   * the product disagreed and nothing caught it.
   *
   * These read the stage source directly: the ids are a literal inside
   * stageScene.ts, and asserting on the rendered canvas is not possible
   * under jsdom (WebGL is stubbed out).
   */
  const stageSource = readFileSync(
    join(process.cwd(), 'src/components/landing/3d/vanilla/stageScene.ts'),
    'utf8',
  );

  it('feeds the agents beat the real shipped agent ids', () => {
    const block = stageSource.slice(
      stageSource.indexOf("id: 'agents'"),
      stageSource.indexOf("id: 'connectors'"),
    );
    // Every real agent must appear. The failure mode this guards is a 3D scene
    // quietly disagreeing with the product, so assert presence of all eight.
    const missing = AGENTS.list.filter((a) => !block.includes(`'${a.id}'`)).map((a) => a.id);
    expect(missing).toEqual([]);
    expect(AGENTS.list).toHaveLength(8);
  });

  it('keeps the beat table and the scene factories in the same order', () => {
    const wc = readFileSync(
      join(process.cwd(), 'src/components/landing/3d/vanilla/worldConstants.ts'),
      'utf8',
    );
    // `{ id: '…',` also matches the inline `{ id: 'cta', cameraFor: … }` entry,
    // which a stricter per-line pattern silently skipped — and a skipped beat
    // is exactly the kind of drift this test exists to catch.
    const fromTable = [...wc.matchAll(/id: '([a-z]+)',/g)].map((m) => m[1]);
    const fromScenes = [...stageSource.matchAll(/id: '([a-z]+)',/g)].map((m) => m[1]);
    expect(fromScenes.length).toBeGreaterThan(0);
    // stageScene's makeMeta order drives which scene gets built at which index;
    // BEATS supplies the z position. A mismatch silently misplaces every
    // scene after the divergence point.
    expect(fromScenes).toEqual(fromTable);
  });

  it('registers a slot for every beat, so the canvas is never dropped', () => {
    const sectionDir = join(process.cwd(), 'src/components/landing/sections');
    const used = new Set<string>();
    readdirSync(sectionDir)
      .filter((f) => f.endsWith('.tsx'))
      .forEach((f) => {
        const src = readFileSync(join(sectionDir, f), 'utf8');
        for (const m of src.matchAll(/<StageSlot\s+beat="([a-z]+)"/g)) used.add(m[1]);
      });
    const beatIds = [...stageSource.matchAll(/id: '([a-z]+)',/g)].map((m) => m[1]);
    const orphans = beatIds.filter((id) => !used.has(id));
    expect(orphans).toEqual([]);
  });

  /**
   * Beats must not ship a captured bitmap.
   *
   * This used to assert the opposite — that every beat had a PNG in
   * `public/landing/beats/`. It could only ever pass for the 7 beats
   * `capture-landing-beats.py` knew about, and the files it did produce were
   * mostly screenshots of the rendered page rather than scene art, so reduced
   * motion painted a ghost nav and a second hero headline over the real ones.
   * A bitmap of a UI cannot be kept in sync with that UI; the live headline had
   * already drifted from the one baked into `hero.png`.
   *
   * So the fallback is CSS-only now, and this guards that decision: if someone
   * reintroduces per-beat image assets, fail with the reason rather than let it
   * rot unnoticed a second time.
   */
  it('ships no per-beat bitmap fallbacks', () => {
    const dir = join(process.cwd(), 'public/landing/beats');
    expect(existsSync(dir)).toBe(false);
  });

  it('keeps the beat fallback free of image assets', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/components/landing/3d/SceneShell.tsx'),
      'utf8',
    )
      // Comments legitimately name the history, so match against code only —
      // otherwise this test just forbids documenting the decision.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    expect(src).not.toMatch(/landing\/beats/);
    expect(src).not.toMatch(/<img\b/);
  });

  /**
   * Scenes must read colour from `scenePalette()`, not from a private
   * `theme === 'dark' ? … : …` literal. Six scenes kept their own copies, so
   * they silently missed the light-theme redesign and their light values
   * drifted below the palette's own contrast floor. Opacity ternaries are
   * fine and expected; only colour literals are banned here.
   */
  it('has no scene bypassing the shared colour palette', () => {
    const dir = join(process.cwd(), 'src/components/landing/3d/vanilla');
    const offenders: string[] = [];
    readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .forEach((f) => {
        const src = readFileSync(join(dir, f), 'utf8');
        // A colour literal assigned to a `const` inside a theme ternary.
        src.split('\n').forEach((line, i) => {
          if (/theme\s*===\s*'dark'\s*\?/.test(line) && /#[0-9a-fA-F]{3,8}/.test(line)) {
            offenders.push(`${f}:${i + 1}`);
          }
        });
      });
    expect(offenders).toEqual([]);
  });
});

describe('landing scene fallbacks', () => {
  it('renders a CSS-only fallback with no bitmap when WebGL is unsupported', async () => {
    const LandingPage = (await import('@/app/page')).default;
    const { container } = render(
      <ThemeProvider>
        <LandingPage />
      </ThemeProvider>,
    );
    // Ambient layers, not assets: every beat paints a fallback element.
    const fallbacks = container.querySelectorAll('.stage-fallback');
    expect(fallbacks.length).toBeGreaterThan(0);
    // ...and none of them is an image.
    expect(container.querySelectorAll('.stage-fallback img')).toHaveLength(0);
    expect(container.querySelectorAll('img[src*="/landing/beats/"]')).toHaveLength(0);
    // The deleted StaticScenes module (hand-drawn SVG) must not be rendered.
    expect(container.querySelector('svg#smc-glow')).toBeNull();
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
