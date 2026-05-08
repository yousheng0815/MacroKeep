import { Camera, FolderOpen, History, LayoutDashboard } from "lucide-react";

export type NavItem = {
  to: "/" | "/history" | "/scanner" | "/drive";
  label: string;
  icon: typeof LayoutDashboard;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/scanner", label: "Add Meal", icon: Camera },
  { to: "/drive", label: "Drive", icon: FolderOpen },
];
