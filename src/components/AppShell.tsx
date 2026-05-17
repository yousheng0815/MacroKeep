import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { DesktopSidebar } from "@/components/nav/DesktopSidebar";
import { MobileBottomNav } from "@/components/nav/MobileBottomNav";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useRecords } from "@/hooks/use-records";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, type ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { records, refetch } = useRecords();
  const onPullRefresh = useCallback(() => refetch(), [refetch]);
  const { enabled: pullToRefresh, pullPx, refreshing, thresholdPx } =
    usePullToRefresh(onPullRefresh);
  /** First-run setup only: hide shell nav so users focus on completing the flow. */
  const inFirstRunTutorial =
    pathname === "/tutorial" && !records.onboardingCompleted;
  const settingsActive = pathname.startsWith("/settings");

  return (
    <div className="min-h-dvh bg-mk-bg text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-6xl lg:max-w-screen-2xl">
        {!inFirstRunTutorial ? <DesktopSidebar /> : null}
        <div
          className={`relative flex min-h-dvh min-w-0 flex-1 flex-col ${!inFirstRunTutorial ? "lg:pl-60" : ""}`}
        >
          {pullToRefresh && !inFirstRunTutorial ? (
            <PullToRefreshIndicator
              pullPx={pullPx}
              refreshing={refreshing}
              thresholdPx={thresholdPx}
            />
          ) : null}

          <header
            className={`mk-pwa-no-select sticky top-0 z-30 flex items-center justify-between border-b border-mk-border bg-mk-bg/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+1rem)] backdrop-blur lg:hidden ${inFirstRunTutorial ? "hidden" : ""}`}
          >
            <Link to="/" className="flex min-w-0 max-w-[calc(100%-3.5rem)] items-center">
              <Logo variant="wordmark" />
            </Link>
            <Link
              to="/settings"
              className={`rounded-xl border border-mk-border p-2 transition ${
                settingsActive
                  ? "bg-zinc-900 text-emerald-400 hover:bg-zinc-900"
                  : "bg-mk-surface text-zinc-300 hover:bg-zinc-800"
              }`}
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
            >
              <Settings className="size-5" />
            </Link>
          </header>

          <main
            className={`min-w-0 flex-1 px-4 pt-4 ${inFirstRunTutorial ? "pb-6 lg:px-4 lg:pt-6 lg:pb-6" : "pb-[calc(7rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-10"}`}
          >
            {children}
          </main>

          <div className={`hidden lg:block ${inFirstRunTutorial ? "hidden" : ""}`}>
            <Footer />
          </div>

          {!inFirstRunTutorial ? <MobileBottomNav /> : null}
        </div>
      </div>
    </div>
  );
}
