export type PublicNavItem = {
  label: string;
  labelKey:
    | "nav.howItWorks"
    | "nav.pricing"
    | "nav.tracking"
    | "nav.contact";
  href:
    | "/"
    | "/how-it-works"
    | "/pricing"
    | "/tracking"
    | "/contact";
};

export const publicNavigation: PublicNavItem[] = [
  {
    label: "Cum funcționează",
    labelKey: "nav.howItWorks",
    href: "/how-it-works",
  },
  { label: "Tarife", labelKey: "nav.pricing", href: "/pricing" },
  { label: "Urmărește comanda", labelKey: "nav.tracking", href: "/tracking" },
  { label: "Contact", labelKey: "nav.contact", href: "/contact" },
];
