'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, RefObject } from 'react';

export interface UseChatAutoScrollOptions {
  /** Px from the bottom that still counts as "the user is at the bottom". */
  threshold?: number;
  /**
   * Gates *automatic* scrolling only. Manual scrolling always updates the model, so
   * pausing auto-scroll (e.g. while the composer is being edited) cannot leave the
   * hook believing the user is somewhere they are not.
   */
  enabled?: boolean;
  /** While tokens stream in, jumps must be 'instant' — see the deps effect. */
  streaming?: boolean;
}

export interface UseChatAutoScrollResult {
  handleScroll: () => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  showNewMessages: boolean;
  isNearBottom: boolean;
}

function distanceFromBottom(el: HTMLElement): number {
  // iOS rubber-banding and other overscroll can push scrollTop past
  // scrollHeight - clientHeight and report a *negative* distance. Left unclamped the
  // threshold comparison flips sign and the hook treats a bouncing container as
  // "scrolled far away", which is what makes a chat fight the user's own drag.
  return Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
}

export function useChatAutoScroll(
  scrollRef: RefObject<HTMLElement | null>,
  deps: DependencyList,
  options: UseChatAutoScrollOptions = {},
): UseChatAutoScrollResult {
  const { threshold = 120, enabled = true, streaming = false } = options;

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessages, setShowNewMessages] = useState(false);

  // `isNearBottom` is the render side of the model; these refs are the read side.
  // The effects below read the near-bottom value without listing it in their own
  // dependency arrays — doing so would re-scroll on every state write — so the two
  // are always written together, exclusively through commitNearBottom.
  const nearBottomRef = useRef(true);
  const isFirstRunRef = useRef(true);
  const hasObservedRef = useRef(false);

  const commitNearBottom = useCallback((next: boolean) => {
    nearBottomRef.current = next;
    setIsNearBottom(next);
    if (next) {
      setShowNewMessages(false);
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    commitNearBottom(distanceFromBottom(el) < threshold);
  }, [scrollRef, threshold, commitNearBottom]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      // Idempotent: re-issuing a scroll is always "at the bottom" again, whether the
      // request came from the deps effect, the ResizeObserver, or the jump pill.
      commitNearBottom(true);
      setShowNewMessages(false);
    },
    [scrollRef, commitNearBottom],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      // The first pass runs before layout (scrollHeight is frequently 0) and, on a
      // restored session, before the browser has re-applied the saved scrollTop.
      // Scrolling here stomps that position, so only re-sync the model from the DOM.
      commitNearBottom(distanceFromBottom(el) < threshold);
      return;
    }

    if (nearBottomRef.current) {
      // 'instant' forces a synchronous layout, and chat callers pass a deps list that
      // changes on every streamed token, so one scrollTo per delta means one forced
      // reflow per delta. Smooth is right for discrete changes, instant for a stream
      // that would otherwise queue animations it can never finish.
      scrollToBottom(streaming ? 'instant' : 'smooth');
    } else {
      setShowNewMessages(true);
    }
    // WHY the suppression is still required: `deps` *is* the caller's change signal by
    // contract — it is spread into the dependency position — so no static list written
    // here can satisfy the rule. `enabled`/`streaming`/`threshold` are listed
    // explicitly because flipping any of them is a genuine reason to re-evaluate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, streaming, threshold, ...deps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      // ResizeObserver always delivers one notification straight after observe().
      // Acting on it would re-introduce exactly the mount-time forced scroll the deps
      // effect above deliberately skips.
      if (!hasObservedRef.current) {
        hasObservedRef.current = true;
        return;
      }
      if (!nearBottomRef.current) {
        setShowNewMessages(true);
        return;
      }
      scrollToBottom(streaming ? 'instant' : 'smooth');
    });

    observer.observe(el);
    // The scroller's own border box does not change when its content grows, so the
    // content wrapper has to be observed too — that is what covers an expanding
    // <details>, the auto-growing composer, and a lazy image finishing its load.
    const content = el.firstElementChild;
    if (content) observer.observe(content);

    return () => {
      observer.disconnect();
      hasObservedRef.current = false;
    };
  }, [scrollRef, enabled, streaming, scrollToBottom]);

  return { handleScroll, scrollToBottom, showNewMessages, isNearBottom };
}
