import type { RegisteredRouter } from "@tanstack/react-router";

/** Leave a transient sub-flow without leaving it on the history stack. */
export function exitSubflow(
  router: RegisteredRouter,
  fallbackTo: string,
): void {
  if (router.history.canGoBack()) {
    router.history.back();
    return;
  }
  void router.navigate({ to: fallbackTo, replace: true });
}
