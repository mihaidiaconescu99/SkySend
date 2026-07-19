import type { LucideIcon } from "lucide-react";
import type { DashboardRole } from "@/types/roles";

export type DashboardNavItem = {
  label: string;
  shortLabel?: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export type DashboardNavGroups = {
  primary: readonly DashboardNavItem[];
  secondary: readonly DashboardNavItem[];
  workspaces: readonly DashboardNavItem[];
  mobile?: readonly DashboardNavItem[];
};

export type RoleNavigation = Record<DashboardRole, DashboardNavGroups>;
