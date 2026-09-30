import { renderHook, act } from '@testing-library/react';
import { useChatAutoScroll } from '../useChatAutoScroll';

describe('useChatAutoScroll', () => {
  let mockElement: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    scrollTo: jest.Mock;
  };
  let ref: { current: typeof mockElement };

  beforeEach(() => {
    mockElement = {
      scrollTop: 800,
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTo: jest.fn(),
    };
    ref = { current: mockElement };
  });

  it('scrolls to bottom when near bottom and deps change', () => {
    const { rerender } = renderHook(({ deps }) => useChatAutoScroll(ref as any, deps), {
      initialProps: { deps: [1] },
    });

    expect(mockElement.scrollTo).toHaveBeenCalledWith({
      top: 1000,
      behavior: 'instant',
    });

    rerender({ deps: [2] });

    expect(mockElement.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('preserves scroll position and flags showNewMessages when scrolled up', () => {
    // User is scrolled far from bottom: scrollHeight(1000) - scrollTop(200) - clientHeight(200) = 600 > 120
    mockElement.scrollTop = 200;

    const { result, rerender } = renderHook(({ deps }) => useChatAutoScroll(ref as any, deps), {
      initialProps: { deps: [1] },
    });

    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.isNearBottomRef.current).toBe(false);

    rerender({ deps: [2] });

    expect(result.current.showNewMessages).toBe(true);
  });

  it('resets showNewMessages when user scrolls back to bottom', () => {
    mockElement.scrollTop = 200;

    const { result, rerender } = renderHook(({ deps }) => useChatAutoScroll(ref as any, deps), {
      initialProps: { deps: [1] },
    });

    act(() => {
      result.current.handleScroll();
    });

    rerender({ deps: [2] });
    expect(result.current.showNewMessages).toBe(true);

    // Scroll back to bottom
    mockElement.scrollTop = 850;
    act(() => {
      result.current.handleScroll();
    });

    expect(result.current.showNewMessages).toBe(false);
  });
});
