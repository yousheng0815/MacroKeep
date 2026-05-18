import type { LucideIcon } from "lucide-react";
import { CirclePlus, History, LayoutDashboard, TrendingUp } from "lucide-react";
import { paths, type NavTabPath } from "@/lib/routes";

export type NavItem = {
  to: NavTabPath;
  label: string;
  icon: LucideIcon;
};

/** Path used for bottom/sidebar “active” styling (differs from URL on meal detail). */
export function pathForNavHighlight(
  pathname: string,
  mealDetailNavFrom?: NavTabPath,
): string {
  if (pathname.startsWith("/meals/")) {
    return mealDetailNavFrom ?? paths.history;
  }
  return pathname;
}

export const NAV_ITEMS: NavItem[] = [
  { to: paths.home, label: "Dashboard", icon: LayoutDashboard },
  { to: paths.history, label: "History", icon: History },
  { to: paths.add.root, label: "Add Meal", icon: CirclePlus },
  { to: paths.progress.root, label: "Progress", icon: TrendingUp },
];
