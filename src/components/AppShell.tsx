import { Footer } from "@/components/Footer";
import { Logo } from "@/components/Logo";
import { DesktopSidebar } from "@/components/nav/DesktopSidebar";
import { MobileBottomNav } from "@/components/nav/MobileBottomNav";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inOnboarding = pathname === "/tutorial";
  const settingsActive = pathname.startsWith("/settings");

  return (
    <div className="min-h-dvh bg-om-bg text-zinc-100">
      <div className="mx-auto flex min-h-dvh max-w-6xl lg:max-w-none">
        {!inOnboarding ? <DesktopSidebar /> : null}
        <div
          className={`relative flex min-h-dvh min-w-0 flex-1 flex-col ${!inOnboarding ? "lg:pl-60" : ""}`}
        >
          <header
            className={`sticky top-0 z-30 flex items-center justify-between border-b border-om-border bg-om-bg/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+1rem)] backdrop-blur lg:hidden ${inOnboarding ? "hidden" : ""}`}
          >
            <Link to="/" className="flex items-center gap-2">
              <Logo />
            </Link>
            <Link
              to="/settings"
              className={`rounded-xl border border-om-border p-2 transition ${
                settingsActive
                  ? "bg-zinc-900 text-emerald-400 hover:bg-zinc-900"
                  : "bg-om-surface text-zinc-300 hover:bg-zinc-800"
              }`}
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
            >
              <Settings className="size-5" />
            </Link>
          </header>

          <main
            className={`min-w-0 flex-1 px-4 pt-4 ${inOnboarding ? "pb-6 lg:px-4 lg:pt-6 lg:pb-6" : "pb-28 lg:px-8 lg:pt-8 lg:pb-10"}`}
          >
            {children}
          </main>

          <div className={`hidden lg:block ${inOnboarding ? "hidden" : ""}`}>
            <Footer />
          </div>

          {!inOnboarding ? <MobileBottomNav /> : null}
        </div>
      </div>
    </div>
  );
}
