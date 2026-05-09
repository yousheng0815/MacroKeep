import { NAV_ITEMS, pathForNavHighlight } from "@/components/nav/nav-config";
import { Link, useRouterState } from "@tanstack/react-router";

export function MobileBottomNav() {
  const { pathname, mealDetailNavFrom } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      mealDetailNavFrom: s.location.pathname.startsWith("/meals/")
        ? s.location.state?.navFrom
        : undefined,
    }),
  });
  const highlightPath = pathForNavHighlight(pathname, mealDetailNavFrom);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-om-border bg-om-bg/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
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
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${
                active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
