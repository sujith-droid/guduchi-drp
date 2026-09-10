import { useState, useEffect, useRef, useCallback } from "react";

/**
 * usePullToRefresh
 * Attaches to a scrollable container. When the user pulls down from the top,
 * calls `onRefresh()`. Returns { pullDistance, isRefreshing, containerRef }.
 *
 * Pass `scrollRef` (a ref to an external scroll element like #main-scroll from Layout)
 * to attach listeners there instead of using the returned containerRef.
 */
export function usePullToRefresh(onRefresh, { threshold = 72, enabled = true, scrollRef = null } = {}) {
  const containerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pullingRef = useRef(false);

  const getScrollEl = useCallback(() => {
    return (scrollRef && scrollRef.current) || containerRef.current;
  }, [scrollRef]);

  const handleTouchStart = useCallback((e) => {
    if (!enabled) return;
    const el = getScrollEl();
    if (el && el.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }
  }, [enabled, getScrollEl]);

  const handleTouchMove = useCallback((e) => {
    if (!pullingRef.current || startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      const dist = Math.min(delta * 0.45, threshold * 1.5);
      setPullDistance(dist);
      if (dist > 5) e.preventDefault();
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    startYRef.current = null;
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = getScrollEl();
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, getScrollEl]);

  return { pullDistance, isRefreshing, containerRef };
}