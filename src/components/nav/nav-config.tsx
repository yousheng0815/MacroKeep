import type { LucideIcon } from "lucide-react";
import { CirclePlus, History, LayoutDashboard, TrendingUp } from "lucide-react";
import { paths, type NavTabPath } from "@/lib/routes";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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

const NAV_ITEM_DEFS: { to: NavTabPath; labelKey: string; icon: LucideIcon }[] =
  [
    { to: paths.home, labelKey: "nav.dashboard", icon: LayoutDashboard },
    { to: paths.history, labelKey: "nav.history", icon: History },
    { to: paths.add.root, labelKey: "nav.addMeal", icon: CirclePlus },
    { to: paths.progress.root, labelKey: "nav.progress", icon: TrendingUp },
  ];

export function useNavItems(): NavItem[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      NAV_ITEM_DEFS.map(({ to, labelKey, icon }) => ({
        to,
        label: t(labelKey),
        icon,
      })),
    [t],
  );
}
