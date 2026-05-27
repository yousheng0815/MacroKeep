import { useCallback, useEffect, useRef } from "react";

const OVERLAY_STATE_KEY = "macrokeepOverlay";

/**
 * Pushes a history entry while `open` so the system back gesture pops the overlay.
 * The URL does not change. Call the returned `dismiss` from UI close actions.
 */
export function useHistoryOverlay(open: boolean, onClose: () => void) {
  const historyPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
      onCloseRef.current();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);

  const dismiss = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, []);

  return dismiss;
}
