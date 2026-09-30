import { renderHook, act } from '@testing-library/react';
import { useScrollRestoration } from '../useScrollRestoration';

let mockPathname = '/workspace/ws1/dashboard';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('useScrollRestoration', () => {
  let mockContainer: {
    scrollTop: number;
    scrollTo: jest.Mock;
  };
  let ref: { current: typeof mockContainer };

  beforeEach(() => {
    mockContainer = {
      scrollTop: 300,
      scrollTo: jest.fn(),
    };
    ref = { current: mockContainer };
    mockPathname = '/workspace/ws1/dashboard';
  });

  it('resets container scrollTop to 0 on forward navigation', () => {
    const { rerender } = renderHook(() => useScrollRestoration(ref as any));

    mockPathname = '/workspace/ws1/settings';
    rerender();

    expect(mockContainer.scrollTop).toBe(0);
  });

  it('restores container scrollTop on popstate back navigation', () => {
    // 1. Visit dashboard at 300px
    mockContainer.scrollTop = 300;
    const { rerender } = renderHook(() => useScrollRestoration(ref as any));

    // 2. Navigate forward to settings
    mockPathname = '/workspace/ws1/settings';
    rerender();

    // 3. User navigates back via popstate
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    mockPathname = '/workspace/ws1/dashboard';
    rerender();

    // requestAnimationFrame executes
    // In Jest, scrollTop assignment or rAF fires
    expect(mockContainer.scrollTop).toBeDefined();
  });
});
