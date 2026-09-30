import { renderHook } from '@testing-library/react';
import { useScrollLock } from '../useScrollLock';

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.body.style.touchAction = '';
  });

  it('locks body overflow and touchAction when active', () => {
    const { rerender } = renderHook(({ locked }) => useScrollLock(locked), {
      initialProps: { locked: true },
    });

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');

    rerender({ locked: false });

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
  });

  it('restores previous body style on unmount', () => {
    document.body.style.overflow = 'auto';

    const { unmount } = renderHook(() => useScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
  });

  it('does nothing when locked is false', () => {
    renderHook(() => useScrollLock(false));

    expect(document.body.style.overflow).toBe('');
  });

  it('handles nested/stacked locks without premature unlocking', () => {
    const hook1 = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    const hook2 = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    hook2.unmount();
    // Still locked by hook1
    expect(document.body.style.overflow).toBe('hidden');

    hook1.unmount();
    // Now unlocked
    expect(document.body.style.overflow).toBe('');
  });
});
