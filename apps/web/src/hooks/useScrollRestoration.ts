'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const scrollHistoryMap = new Map<string, number>();

/**
 * Route-aware scroll position manager for container-based scroll architecture.
 * - Saves scrollTop of the target container before route transitions.
 * - On popstate (browser Back/Forward), restores the previous scrollTop.
 * - On push transitions, resets scrollTop to 0 smoothly.
 */
export function useScrollRestoration(containerRef: React.RefObject<HTMLElement | null>): void {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const isPopStateRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      isPopStateRef.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pathname) return;

    // Save previous route scroll position
    if (prevPathRef.current && prevPathRef.current !== pathname) {
      scrollHistoryMap.set(prevPathRef.current, el.scrollTop);
    }

    if (isPopStateRef.current) {
      // Restore position if available
      const savedPosition = scrollHistoryMap.get(pathname);
      if (typeof savedPosition === 'number') {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = savedPosition;
          }
        });
      }
      isPopStateRef.current = false;
    } else if (prevPathRef.current !== pathname) {
      // Reset to top on standard navigation
      el.scrollTop = 0;
    }

    prevPathRef.current = pathname;
  }, [pathname, containerRef]);
}
