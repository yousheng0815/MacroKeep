import { useCallback, useEffect, useRef } from "react";

const OVERLAY_STATE_KEY = "macrokeepOverlay";

/**
 * Pushes a history entry while `open` so the system back gesture pops the overlay.
 * Call the returned `dismiss` from UI close actions; it runs `history.back()` when needed.
 */
export function useHistoryOverlay(open: boolean, onClose: () => void) {
  const historyPushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    window.history.pushState(
      { [OVERLAY_STATE_KEY]: true },
      "",
      window.location.href,
    );
    historyPushedRef.current = true;

    const onPopState = () => {
      historyPushedRef.current = false;
      onClose();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
    };
  }, [open, onClose]);

  const dismiss = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      window.history.back();
      return;
    }
    onClose();
  }, [onClose]);

  return dismiss;
}
