import type { LucideIcon } from "lucide-react";

export type AdminSectionKey =
  | "overview"
  | "orders"
  | "parcel-evaluations"
  | "failed-orders"
  | "contact-messages"
  | "site-messages"
  | "statistics"
  | "access"
  | "settings";

export type AdminNavigationItem = {
  key: AdminSectionKey;
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
};
