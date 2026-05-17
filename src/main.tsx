import { AppToaster } from "@/components/AppToaster";
import { sweepExpiredMealPhotosFromCache } from "@/lib/meal-photo-cache-db";
import { isInstalledPwa } from "@/lib/pwa";
import { router } from "@/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const SW_RELOAD_ONCE_KEY = "macrokeep:sw-reload-once";

/** Keep the in-app wordmark splash visible at least this long (iOS native splash is not controllable). */
const LAUNCH_SPLASH_MIN_MS = 850;
const launchStartedAt = performance.now();

/** Unregister service workers so `/api/*` is never intercepted. */
async function unregisterServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) {
    try {
      sessionStorage.removeItem(SW_RELOAD_ONCE_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
  await Promise.all(regs.map((r) => r.unregister()));
  if (!navigator.serviceWorker.controller) {
    try {
      sessionStorage.removeItem(SW_RELOAD_ONCE_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    if (sessionStorage.getItem(SW_RELOAD_ONCE_KEY) !== "1") {
      sessionStorage.setItem(SW_RELOAD_ONCE_KEY, "1");
      window.location.reload();
      return true;
    }
  } catch {
    window.location.reload();
    return true;
  }
  return false;
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dismissLaunchSplash() {
  document.body.classList.add("app-ready");
  await waitForNextFrame();
  await waitForNextFrame();

  const remaining =
    LAUNCH_SPLASH_MIN_MS - (performance.now() - launchStartedAt);
  if (remaining > 0) {
    await waitMs(remaining);
  }

  document.getElementById("pwa-launch")?.remove();
}

void (async () => {
  if (await unregisterServiceWorkers()) return;

  void sweepExpiredMealPhotosFromCache();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <AppToaster />
      </QueryClientProvider>
    </StrictMode>,
  );

  if (isInstalledPwa()) {
    await dismissLaunchSplash();
  } else {
    document.getElementById("pwa-launch")?.remove();
    document.body.classList.add("app-ready");
  }
})();
