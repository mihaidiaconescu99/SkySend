import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  Mail,
  Package2,
  Settings,
  UserCog,
  TriangleAlert,
} from "lucide-react";
import type { AdminNavigationItem } from "@/types/admin-navigation";

export const adminNavigationItems: readonly AdminNavigationItem[] = [
  {
    key: "overview",
    label: "Privire generală",
    href: "/admin",
    description: "Rezumat operațional și priorități curente.",
    icon: LayoutDashboard,
  },
  {
    key: "orders",
    label: "Comenzi",
    href: "/admin/orders",
    description: "Administrarea comenzilor și detaliilor operaționale.",
    icon: Package2,
  },
  {
    key: "failed-orders",
    label: "Incidente",
    href: "/admin/failed-orders",
    description: "Cazuri eșuate, motive și pași de rezolvare.",
    icon: TriangleAlert,
  },
  {
    key: "parcel-evaluations",
    label: "Evaluări colete",
    href: "/admin/parcel-evaluations",
    description: "Întrebări și profiluri confirmate pentru colete.",
    icon: ClipboardCheck,
  },
  {
    key: "site-messages",
    label: "Mesaje site",
    href: "/admin/site-messages",
    description: "Inbox public și răspunsuri prin email.",
    icon: Mail,
  },
  {
    key: "statistics",
    label: "Rapoarte",
    href: "/admin/statistics",
    description: "Indicatori operaționali și export CSV.",
    icon: BarChart3,
  },
  {
    key: "access",
    label: "Acces și roluri",
    href: "/admin/access",
    description: "Roluri interne, cereri temporare și securitate MFA.",
    icon: UserCog,
  },
  {
    key: "settings",
    label: "Setări",
    href: "/admin/settings",
    description: "Status platformă, rază, tarife și timpi.",
    icon: Settings,
  },
];

export function getAdminNavigationItem(pathname: string) {
  if (pathname.startsWith("/admin/locker-recoveries")) {
    return (
      adminNavigationItems.find((item) => item.key === "failed-orders") ??
      adminNavigationItems[0]
    );
  }

  const exactMatch = adminNavigationItems.find((item) => item.href === pathname);

  if (exactMatch) {
    return exactMatch;
  }

  return (
    adminNavigationItems.find(
      (item) => item.href !== "/admin" && pathname.startsWith(`${item.href}/`),
    ) ?? adminNavigationItems[0]
  );
}
