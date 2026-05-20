import { isInstalledPwa } from "@/lib/pwa";
import { useCallback, useEffect, useRef, useState } from "react";

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 112;
const PULL_DAMPING = 0.45;

/** Apply to a subtree so PTR ignores touches that start inside it (e.g. drag handles). */
export const BLOCK_PULL_TO_REFRESH_ATTR = "data-block-pull";

function isDocumentAtTop(): boolean {
  return window.scrollY <= 0;
}

/** Nested scroll regions (e.g. photo capture form) should consume the gesture, not window PTR. */
function touchTargetBlocksPull(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  let el: Element | null = target;
  while (el && el !== document.documentElement) {
    if (el.hasAttribute(BLOCK_PULL_TO_REFRESH_ATTR)) return true;
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      if (el.scrollTop > 0) return true;
      if (el.scrollHeight > el.clientHeight + 1) return true;
    }
    el = el.parentElement;
  }
  return false;
}

type UsePullToRefreshOptions = {
  /** When false, listeners are detached and any in-progress pull is cancelled. */
  active?: boolean;
};

export function usePullToRefresh(
  onRefresh: () => void | Promise<unknown>,
  options?: UsePullToRefreshOptions,
) {
  const active = options?.active ?? true;
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const enabledRef = useRef(false);
  const pullingRef = useRef(false);
  const startYRef = useRef(0);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  onRefreshRef.current = onRefresh;
  refreshingRef.current = refreshing;
  pullRef.current = pullPx;

  const deviceEligible =
    typeof window !== "undefined" &&
    isInstalledPwa() &&
    window.matchMedia("(pointer: coarse)").matches;

  const enabled = deviceEligible && active;

  enabledRef.current = enabled;

  const resetPull = useCallback(() => {
    pullingRef.current = false;
    pullRef.current = 0;
    setPullPx(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (!isDocumentAtTop()) return;
      if (touchTargetBlocksPull(e.target)) return;
      const tag = (e.target as Element | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      startYRef.current = e.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      if (!isDocumentAtTop()) {
        resetPull();
        return;
      }

      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startYRef.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPullPx(0);
        return;
      }

      if (e.cancelable) e.preventDefault();
      const next = Math.min(delta * PULL_DAMPING, MAX_PULL_PX);
      pullRef.current = next;
      setPullPx(next);
    };

    const finish = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;

      const pulled = pullRef.current;
      if (pulled < PULL_THRESHOLD_PX) {
        resetPull();
        return;
      }

      void (async () => {
        refreshingRef.current = true;
        setRefreshing(true);
        pullRef.current = PULL_THRESHOLD_PX;
        setPullPx(PULL_THRESHOLD_PX);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          resetPull();
        }
      })();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", finish);
    document.addEventListener("touchcancel", finish);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", finish);
    };
  }, [enabled, resetPull]);

  useEffect(() => {
    if (!active) resetPull();
  }, [active, resetPull]);

  return { enabled, pullPx, refreshing, thresholdPx: PULL_THRESHOLD_PX };
}
