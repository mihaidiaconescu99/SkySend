import {
  ClipboardCheck,
  CreditCard,
  Bell,
  LayoutDashboard,
  Package2,
  MapPinned,
  Radar,
  Route,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Wrench,
  Mail,
} from "lucide-react";
import { roleHomePaths } from "@/constants/roles";
import type { RoleNavigation } from "@/types/navigation";
import type { DashboardRole } from "@/types/roles";

const workspaceItems = {
  client: {
    label: "Spațiu client",
    href: roleHomePaths.client,
    description: "Solicitări, urmărire și vizibilitate asupra serviciului.",
    icon: UserRound,
  },
  admin: {
    label: "Spațiu admin",
    href: roleHomePaths.admin,
    description: "Controale comerciale și supravegherea rețelei.",
    icon: ShieldCheck,
  },
  operator: {
    label: "Spațiu operator",
    href: roleHomePaths.operator,
    description: "Suport, evaluări de colete și mesaje de pe site.",
    icon: Wrench,
  },
} as const;

export const clientDashboardNavigation = {
  primary: [
    {
      label: "Creează livrare",
      shortLabel: "Trimite",
      href: "/client/create-delivery",
      description: "Pornește o livrare nouă cu drona.",
      icon: Route,
    },
    {
      label: "Livrare activă",
      shortLabel: "Live",
      href: "/client/active-delivery",
      description: "Deschide livrarea live curentă.",
      icon: Radar,
    },
    {
      label: "Comenzi",
      shortLabel: "Comenzi",
      href: "/client/orders",
      description: "Istoric și detalii pentru comenzi.",
      icon: Package2,
    },
    {
      label: "Locații salvate",
      shortLabel: "Locații",
      href: "/client/saved-places",
      description: "Adrese favorite pentru pickup și livrare.",
      icon: MapPinned,
    },
    {
      label: "Plăți",
      shortLabel: "Plăți",
      href: "/client/payment-methods",
      description: "Carduri și istoric de plăți.",
      icon: CreditCard,
    },
  ],
  secondary: [
    {
      label: "Notificări",
      shortLabel: "Alerte",
      href: "/client/notifications",
      description: "Actualizări despre livrări și cont.",
      icon: Bell,
    },
    {
      label: "Setări",
      shortLabel: "Cont",
      href: "/client/settings",
      description: "Profil și preferințe.",
      icon: Settings,
    },
  ],
  workspaces: [
    workspaceItems.client,
    workspaceItems.admin,
    workspaceItems.operator,
  ],
  mobile: [
    {
      label: "Creează livrare",
      shortLabel: "Creează",
      href: "/client/create-delivery",
      description: "Pornește o livrare.",
      icon: Route,
    },
    {
      label: "Livrare activă",
      shortLabel: "Livrare",
      href: "/client/active-delivery",
      description: "Urmărire live.",
      icon: Radar,
    },
    {
      label: "Comenzi",
      shortLabel: "Comenzi",
      href: "/client/orders",
      description: "Istoric comenzi.",
      icon: Package2,
    },
    {
      label: "Urmărește comanda",
      shortLabel: "Tracking",
      href: "/tracking",
      description: "Cod public de urmărire.",
      icon: MapPinned,
    },
    {
      label: "Setări",
      shortLabel: "Setări",
      href: "/client/settings",
      description: "Setările contului.",
      icon: UserRound,
    },
  ],
} as const;

export const adminDashboardNavigation = {
  primary: [
    {
      label: "Centru operațional",
      href: "/admin",
      description: "Hartă, comenzi live și alerte urgente.",
      icon: LayoutDashboard,
    },
    {
      label: "Comenzi",
      href: "/admin/orders",
      description: "Administrarea comenzilor și detaliilor operaționale.",
      icon: Package2,
    },
    {
      label: "Comenzi eșuate",
      href: "/admin/failed-orders",
      description: "Livrări nereușite, motive și pași de rezolvare.",
      icon: TriangleAlert,
    },
    {
      label: "Evaluări colete",
      href: "/admin/parcel-evaluations",
      description: "Cereri reale de evaluare și profile confirmate de operator.",
      icon: ClipboardCheck,
    },
    {
      label: "Mesaje de pe site",
      href: "/admin/site-messages",
      description: "Inbox public cu răspunsuri email prin SkySend.",
      icon: Mail,
    },
  ],
  secondary: [
    {
      label: "Recuperare lockere",
      href: "/admin/locker-recoveries",
      description: "Incidente cu locker detașat și recuperare fizică.",
      icon: MapPinned,
    },
    {
      label: "Statistici",
      href: "/admin/statistics",
      description: "Rapoarte operaționale și exporturi.",
      icon: Radar,
    },
    {
      label: "Setări",
      href: "/admin/settings",
      description: "Reguli operaționale simple pentru platformă.",
      icon: Settings,
    },
  ],
  workspaces: [
    workspaceItems.admin,
    workspaceItems.client,
    workspaceItems.operator,
  ],
} as const;

export const operatorDashboardNavigation = {
  primary: [
    {
      label: "Prezentare generală",
      href: "/operator#overview",
      description: "Acces rapid la fluxurile zilnice ale operatorului.",
      icon: LayoutDashboard,
    },
    {
      label: "Evaluări colete",
      href: "/operator/parcel-evaluations",
      description: "Clarifică și confirmă greutatea și dimensiunile coletelor.",
      icon: ClipboardCheck,
    },
    {
      label: "Mesaje de pe site",
      href: "/operator/site-messages",
      description: "Răspunde prin email solicitărilor publice.",
      icon: Mail,
    },
  ],
  secondary: [
    {
      label: "Suport clienți",
      href: "/operator/support",
      description: "Coada unificată pentru contacte și escaladări AI.",
      icon: Bell,
    },
  ],
  workspaces: [
    workspaceItems.admin,
    workspaceItems.operator,
    workspaceItems.client,
  ],
} as const;

export const dashboardNavigation: RoleNavigation = {
  client: clientDashboardNavigation,
  admin: adminDashboardNavigation,
  operator: operatorDashboardNavigation,
};

export function getDashboardNavigation(role: DashboardRole) {
  return dashboardNavigation[role];
}

export function getDashboardMobileNavigation(role: DashboardRole) {
  return dashboardNavigation[role].mobile ?? [];
}
