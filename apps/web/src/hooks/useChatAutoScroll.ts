'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChatAutoScrollOptions {
  threshold?: number;
}

export function useChatAutoScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  deps: unknown[],
  options: ChatAutoScrollOptions = {},
) {
  const { threshold = 120 } = options;
  const isNearBottomRef = useRef(true);
  const [showNewMessages, setShowNewMessages] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowNewMessages(false);
    }
  }, [scrollRef, threshold]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      isNearBottomRef.current = true;
      setShowNewMessages(false);
    },
    [scrollRef],
  );

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('instant');
    } else {
      setShowNewMessages(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    handleScroll,
    scrollToBottom,
    showNewMessages,
    isNearBottomRef,
  };
}
