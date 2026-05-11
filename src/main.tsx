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

/** Old builds registered Workbox; unregister once so `/api/*` is never intercepted. */
async function unregisterLegacyServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) {
    try {
      sessionStorage.removeItem("openmacro:sw-reload-once");
    } catch {
      /* ignore */
    }
    return;
  }
  await Promise.all(regs.map((r) => r.unregister()));
  if (!navigator.serviceWorker.controller) {
    try {
      sessionStorage.removeItem("openmacro:sw-reload-once");
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (sessionStorage.getItem("openmacro:sw-reload-once") !== "1") {
      sessionStorage.setItem("openmacro:sw-reload-once", "1");
      window.location.reload();
      return;
    }
  } catch {
    window.location.reload();
    return;
  }
}

void unregisterLegacyServiceWorkers().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
});
