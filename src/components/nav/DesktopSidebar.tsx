import { Logo } from "@/components/Logo";
import { NAV_ITEMS, pathForNavHighlight } from "@/components/nav/nav-config";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";

export function DesktopSidebar() {
  const { pathname, mealDetailNavFrom } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      mealDetailNavFrom: s.location.pathname.startsWith("/meals/")
        ? s.location.state?.navFrom
        : undefined,
    }),
  });
  const highlightPath = pathForNavHighlight(pathname, mealDetailNavFrom);
  const settingsActive = pathname.startsWith("/settings");

  return (
    <aside className="mk-pwa-no-select fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-mk-border bg-mk-bg lg:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <Link to="/" className="flex min-w-0 items-center">
          <Logo variant="wordmark" />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pt-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/"
              ? highlightPath === "/"
              : highlightPath.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-emerald-400/15 text-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-mk-border p-3">
        <Link
          to="/settings"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
            settingsActive
              ? "bg-zinc-900 text-emerald-400"
              : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
          }`}
          aria-current={settingsActive ? "page" : undefined}
        >
          <Settings className="size-5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
