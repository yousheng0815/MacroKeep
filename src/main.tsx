import { AppToaster } from "@/components/AppToaster";
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

function isInstalledPwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Old builds registered Workbox; unregister once so `/api/*` is never intercepted. */
async function unregisterLegacyServiceWorkers(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) {
    try {
      sessionStorage.removeItem("openmacro:sw-reload-once");
    } catch {
      /* ignore */
    }
    return false;
  }
  await Promise.all(regs.map((r) => r.unregister()));
  if (!navigator.serviceWorker.controller) {
    try {
      sessionStorage.removeItem("openmacro:sw-reload-once");
    } catch {
      /* ignore */
    }
    return false;
  }
  try {
    if (sessionStorage.getItem("openmacro:sw-reload-once") !== "1") {
      sessionStorage.setItem("openmacro:sw-reload-once", "1");
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

async function dismissLaunchSplash() {
  document.body.classList.add("app-ready");
  await waitForNextFrame();
  await waitForNextFrame();
  document.getElementById("pwa-launch")?.remove();
}

void (async () => {
  if (await unregisterLegacyServiceWorkers()) return;

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
