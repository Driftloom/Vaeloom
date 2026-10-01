import '@testing-library/jest-dom';

/**
 * jsdom implements neither `window.matchMedia` nor `Element.prototype.scrollIntoView`.
 *
 * `chat-a11y.test.tsx` discovered both gaps and stubbed them in a local `beforeAll`.
 * Every future component test hits the same two walls, and each suite that works
 * around them invents a different constant — so one component can render two
 * different layouts depending on which test file mounted it. Defining them here
 * gives the whole suite one environment, and lets a test narrow a case by
 * resizing `window` rather than by replacing the function.
 *
 * `matchMedia` evaluates the media features this app queries against the jsdom
 * viewport rather than returning a hardcoded boolean. A stub that answers `true`
 * to everything would put a 375px phone layout and a 1440px desktop layout in the
 * same branch, which is how "the rail renders as the static rail" assertions come
 * to depend on an unrelated stub.
 */
const FEATURE_RESOLVERS = {
  'min-width': () => `${window.innerWidth}px`,
  'max-width': () => `${window.innerWidth}px`,
  'min-height': () => `${window.innerHeight}px`,
  'max-height': () => `${window.innerHeight}px`,
  orientation: () => (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'),
  // The theme class is what the app itself toggles, so it — not a fixed answer —
  // is the honest source for the colour-scheme query.
  'prefers-color-scheme': () =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  'prefers-contrast': () => 'no-preference',
  'prefers-reduced-motion': () => 'no-preference',
  hover: () => 'hover',
  pointer: () => 'fine',
};

const LENGTH_UNITS_PX = { px: 1, rem: 16, em: 16, pt: 96 / 72, in: 96, cm: 96 / 2.54 };

function toPx(value) {
  const match = /^(-?\d*\.?\d+)([a-z]+)$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = LENGTH_UNITS_PX[match[2].toLowerCase()];
  if (!Number.isFinite(amount) || unit === undefined) return null;
  return amount * unit;
}

function evaluateFeature(feature) {
  const colon = feature.indexOf(':');
  const name = (colon === -1 ? feature : feature.slice(0, colon)).trim().toLowerCase();
  const value = colon === -1 ? '' : feature.slice(colon + 1).trim();
  const resolve = Object.prototype.hasOwnProperty.call(FEATURE_RESOLVERS, name)
    ? FEATURE_RESOLVERS[name]
    : undefined;
  // An unrecognised feature is a capability jsdom does not have, so it must not
  // silently match: a test that believed it was in a print or 3D-hover context
  // would otherwise render the desktop branch.
  if (!resolve) return false;

  const actual = String(resolve());
  if (name.endsWith('-width') || name.endsWith('-height')) {
    const actualPx = toPx(actual);
    const wantedPx = toPx(value);
    if (actualPx === null || wantedPx === null) return false;
    return name.startsWith('min-') ? actualPx >= wantedPx : actualPx <= wantedPx;
  }
  return actual.trim().toLowerCase() === value.toLowerCase();
}

function evaluateQuery(query) {
  return query.split(',').some((alternative) => {
    let body = alternative.trim();
    if (body === '') return false;

    let negated = false;
    if (/^not\s+/i.test(body)) {
      negated = true;
      body = body.replace(/^not\s+/i, '');
    }

    // `screen and (…)` / `only screen` carry a media type; a bare `(feature)` list
    // does not, and defaults to `all`.
    let typeMatches = true;
    const typeMatch = /^(?:only\s+)?([a-z-]+)/i.exec(body);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      typeMatches = type === 'all' || type === 'screen';
      body = body.slice(typeMatch[0].length);
    }

    const features = Array.from(body.matchAll(/\(([^()]*)\)/g), (m) => evaluateFeature(m[1]));
    const matched = typeMatches && features.every(Boolean);
    return negated ? !matched : matched;
  });
}

function mediaQueryList(media) {
  return {
    media,
    // Re-read on every access: a test that resizes `window` between assertions must
    // see the new answer without re-installing the stub.
    get matches() {
      return evaluateQuery(media);
    },
    onchange: null,
    // jsdom has no viewport change to notify about, so these stay inert rather
    // than pretending a listener fired.
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (media) => mediaQueryList(String(media)),
});

/* jsdom performs no layout, so there is no scroll position to move. Components
   that call `scrollIntoView` (the composer's active-option effect, the rail) only
   need it to exist for the effect to run to completion. */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
