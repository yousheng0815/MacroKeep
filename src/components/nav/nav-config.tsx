import type { LucideIcon } from "lucide-react";
import { Camera, History, LayoutDashboard, TrendingUp } from "lucide-react";

export type NavItem = {
  to: "/" | "/history" | "/scanner" | "/progress";
  label: string;
  icon: LucideIcon;
};

/** Path used for bottom/sidebar “active” styling (differs from URL on meal detail). */
export function pathForNavHighlight(
  pathname: string,
  mealDetailNavFrom?: NavItem["to"],
): string {
  if (pathname.startsWith("/meals/")) {
    return mealDetailNavFrom ?? "/history";
  }
  return pathname;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/scanner", label: "Add Meal", icon: Camera },
  { to: "/progress", label: "Progress", icon: TrendingUp },
];
