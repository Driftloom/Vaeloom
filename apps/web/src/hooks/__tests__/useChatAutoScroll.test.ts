import { renderHook, act } from '@testing-library/react';
import { useChatAutoScroll } from '../useChatAutoScroll';
import type { UseChatAutoScrollOptions } from '../useChatAutoScroll';

/**
 * Geometry is kept internally consistent: a browser never reports
 * `scrollTop > scrollHeight - clientHeight` outside of overscroll, so the tests
 * only use real, reachable scroll offsets. The one exception is a dedicated
 * overscroll case, which is the only way to exercise the Math.max(0, …) clamp.
 */
const CONTENT_HEIGHT = 1200;
const VIEWPORT_HEIGHT = 400;
const MAX_SCROLL_TOP = CONTENT_HEIGHT - VIEWPORT_HEIGHT; // 800

interface Geometry {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly targets: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    const i = this.targets.indexOf(target);
    if (i >= 0) this.targets.splice(i, 1);
  }

  disconnect(): void {
    this.targets.length = 0;
    this.disconnected = true;
  }

  /** Stand-in for the browser delivering a resize notification. */
  emit(): void {
    this.callback([], this);
  }
}

function lastObserver(): MockResizeObserver {
  const instances = MockResizeObserver.instances;
  const observer = instances[instances.length - 1];
  if (!observer) throw new Error('expected a ResizeObserver to have been constructed');
  return observer;
}

interface Scroller {
  el: HTMLDivElement;
  scrollTo: jest.Mock<void, [ScrollToOptions]>;
  geometry: Geometry;
}

function createScroller(overrides: Partial<Geometry> = {}): Scroller {
  const geometry: Geometry = {
    scrollTop: MAX_SCROLL_TOP,
    scrollHeight: CONTENT_HEIGHT,
    clientHeight: VIEWPORT_HEIGHT,
    ...overrides,
  };

  const el = document.createElement('div');
  // The real chat wraps the transcript in a child div; the hook observes it so that
  // content growth is detectable at all.
  el.appendChild(document.createElement('div'));

  const scrollTo = jest.fn<void, [ScrollToOptions]>();
  Object.defineProperties(el, {
    scrollTop: { get: () => geometry.scrollTop, configurable: true },
    scrollHeight: { get: () => geometry.scrollHeight, configurable: true },
    clientHeight: { get: () => geometry.clientHeight, configurable: true },
    scrollTo: { value: scrollTo, configurable: true },
  });

  return { el, scrollTo, geometry };
}

interface HookProps {
  deps: unknown[];
  ref: { current: HTMLDivElement | null };
  options?: UseChatAutoScrollOptions;
}

function renderAutoScroll(initialProps: HookProps) {
  return renderHook(
    (props: HookProps) => useChatAutoScroll(props.ref, props.deps, props.options ?? {}),
    { initialProps },
  );
}

describe('useChatAutoScroll', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    MockResizeObserver.instances = [];
    globalThis.ResizeObserver = MockResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  describe('mount', () => {
    it('does not scroll on mount, so a restored scroll position survives', () => {
      const scroller = createScroller();

      renderAutoScroll({ deps: [1], ref: { current: scroller.el } });

      expect(scroller.scrollTo).not.toHaveBeenCalled();
    });

    it('measures near-bottom from the DOM instead of assuming it', () => {
      // 1200 - 200 - 400 = 600px from the bottom: a restored mid-transcript position.
      const scroller = createScroller({ scrollTop: 200 });

      const { result } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });

      expect(result.current.isNearBottom).toBe(false);
      expect(scroller.scrollTo).not.toHaveBeenCalled();
    });

    it('is a no-op when the ref has not been attached yet', () => {
      const { result, rerender } = renderAutoScroll({ deps: [1], ref: { current: null } });

      expect(result.current.isNearBottom).toBe(true);
      expect(result.current.showNewMessages).toBe(false);

      act(() => {
        result.current.handleScroll();
      });
      expect(result.current.isNearBottom).toBe(true);

      rerender({ deps: [2], ref: { current: null } });
      expect(result.current.showNewMessages).toBe(false);
    });
  });

  describe('deps changes', () => {
    it('scrolls to bottom when near bottom and deps change', () => {
      const scroller = createScroller();

      const { rerender } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });
      expect(scroller.scrollTo).not.toHaveBeenCalled();

      rerender({ deps: [2], ref: { current: scroller.el } });

      expect(scroller.scrollTo).toHaveBeenCalledTimes(1);
      expect(scroller.scrollTo).toHaveBeenCalledWith({
        top: CONTENT_HEIGHT,
        behavior: 'smooth',
      });
    });

    it('jumps instantly while streaming and smoothly otherwise', () => {
      const streaming = createScroller();
      const idle = createScroller();

      const streamingHook = renderAutoScroll({
        deps: [1],
        ref: { current: streaming.el },
        options: { streaming: true },
      });
      streamingHook.rerender({
        deps: [2],
        ref: { current: streaming.el },
        options: { streaming: true },
      });
      expect(streaming.scrollTo).toHaveBeenLastCalledWith({
        top: CONTENT_HEIGHT,
        behavior: 'instant',
      });

      const idleHook = renderAutoScroll({
        deps: [1],
        ref: { current: idle.el },
        options: { streaming: false },
      });
      idleHook.rerender({ deps: [2], ref: { current: idle.el }, options: { streaming: false } });
      expect(idle.scrollTo).toHaveBeenLastCalledWith({
        top: CONTENT_HEIGHT,
        behavior: 'smooth',
      });
    });

    it('preserves scroll position and flags showNewMessages when scrolled up', () => {
      // 1200 - 200 - 400 = 600px from the bottom, far past the 120px threshold.
      const scroller = createScroller({ scrollTop: 200 });

      const { result, rerender } = renderAutoScroll({
        deps: [1],
        ref: { current: scroller.el },
      });

      act(() => {
        result.current.handleScroll();
      });
      expect(result.current.isNearBottom).toBe(false);

      const scrollTopBefore = scroller.geometry.scrollTop;
      rerender({ deps: [2], ref: { current: scroller.el } });

      // Preserved means untouched: no scrollTo was issued and scrollTop did not move.
      expect(scroller.scrollTo).not.toHaveBeenCalled();
      expect(scroller.geometry.scrollTop).toBe(scrollTopBefore);
      expect(result.current.showNewMessages).toBe(true);
    });

    it('resets showNewMessages when user scrolls back to bottom', () => {
      const scroller = createScroller({ scrollTop: 200 });

      const { result, rerender } = renderAutoScroll({
        deps: [1],
        ref: { current: scroller.el },
      });

      act(() => {
        result.current.handleScroll();
      });
      rerender({ deps: [2], ref: { current: scroller.el } });
      expect(result.current.showNewMessages).toBe(true);

      // 1200 - 700 - 400 = 100px from the bottom: inside the 120px threshold.
      scroller.geometry.scrollTop = 700;
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.isNearBottom).toBe(true);
      expect(result.current.showNewMessages).toBe(false);
    });

    it('treats an overscrolled container as at the bottom', () => {
      // Raw distance is 1200 - 810 - 400 = -10, which browsers only produce while
      // rubber-banding; the clamp is what keeps the threshold comparison sane.
      const scroller = createScroller({ scrollTop: 810 });

      const { result } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });
      act(() => {
        result.current.handleScroll();
      });

      expect(result.current.isNearBottom).toBe(true);
      expect(result.current.showNewMessages).toBe(false);
    });

    it('does not auto-scroll while disabled but still tracks manual scrolling', () => {
      const scroller = createScroller();

      const { result, rerender } = renderAutoScroll({
        deps: [1],
        ref: { current: scroller.el },
        options: { enabled: false },
      });

      scroller.geometry.scrollTop = 200;
      act(() => {
        result.current.handleScroll();
      });
      expect(result.current.isNearBottom).toBe(false);

      scroller.geometry.scrollTop = MAX_SCROLL_TOP;
      act(() => {
        result.current.handleScroll();
      });
      expect(result.current.isNearBottom).toBe(true);

      rerender({ deps: [2], ref: { current: scroller.el }, options: { enabled: false } });
      expect(scroller.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('content growth', () => {
    it('ignores the first ResizeObserver notification', () => {
      const scroller = createScroller();
      renderAutoScroll({ deps: [1], ref: { current: scroller.el } });

      const observer = lastObserver();
      expect(observer.targets).toHaveLength(2);

      // Browsers always fire once on observe(); that must not scroll.
      act(() => {
        observer.emit();
      });
      expect(scroller.scrollTo).not.toHaveBeenCalled();
    });

    it('scrolls when observed content grows and the user is at the bottom', () => {
      const scroller = createScroller();
      const { rerender } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });

      const observer = lastObserver();
      act(() => {
        observer.emit();
      });

      // A streamed token grew the content without any deps change.
      scroller.geometry.scrollHeight = 1400;
      act(() => {
        observer.emit();
      });

      expect(scroller.scrollTo).toHaveBeenCalledTimes(1);
      expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 1400, behavior: 'smooth' });

      // A discrete deps change still routes through the deps path.
      rerender({ deps: [2], ref: { current: scroller.el } });
      expect(scroller.scrollTo).toHaveBeenCalledTimes(2);
    });

    it('flags new messages when content grows while the user is scrolled up', () => {
      const scroller = createScroller({ scrollTop: 200 });
      const { result } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });
      act(() => {
        result.current.handleScroll();
      });

      const observer = lastObserver();
      act(() => {
        observer.emit();
      });

      act(() => {
        observer.emit();
      });

      expect(scroller.scrollTo).not.toHaveBeenCalled();
      expect(result.current.showNewMessages).toBe(true);
    });

    it('disconnects the observer on unmount', () => {
      const scroller = createScroller();
      const { unmount } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });

      const observer = lastObserver();
      expect(observer.disconnected).toBe(false);

      unmount();

      expect(observer.disconnected).toBe(true);
    });

    it('does not observe at all when disabled', () => {
      const scroller = createScroller();
      renderAutoScroll({
        deps: [1],
        ref: { current: scroller.el },
        options: { enabled: false },
      });

      expect(MockResizeObserver.instances).toHaveLength(0);
    });
  });

  describe('scrollToBottom', () => {
    it('resets the model and is idempotent', () => {
      const scroller = createScroller({ scrollTop: 200 });
      const { result } = renderAutoScroll({ deps: [1], ref: { current: scroller.el } });

      act(() => {
        result.current.handleScroll();
      });
      act(() => {
        result.current.scrollToBottom();
      });
      expect(result.current.isNearBottom).toBe(true);
      expect(result.current.showNewMessages).toBe(false);

      act(() => {
        result.current.scrollToBottom('instant');
      });
      expect(scroller.scrollTo).toHaveBeenCalledTimes(2);
      expect(scroller.scrollTo).toHaveBeenNthCalledWith(1, {
        top: CONTENT_HEIGHT,
        behavior: 'smooth',
      });
      expect(scroller.scrollTo).toHaveBeenNthCalledWith(2, {
        top: CONTENT_HEIGHT,
        behavior: 'instant',
      });
    });

    it('is a no-op when the ref has not been attached yet', () => {
      const { result } = renderAutoScroll({ deps: [1], ref: { current: null } });

      act(() => {
        result.current.scrollToBottom('instant');
      });

      expect(result.current.isNearBottom).toBe(true);
    });
  });
});
