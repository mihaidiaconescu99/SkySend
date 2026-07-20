import Link from "next/link";
import { ArrowLeft, Route } from "lucide-react";
import { NotificăriView } from "@/components/notifications/notifications-view";
import { PageHeader } from "@/components/shared/page-header";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Notificări",
  "Verifică notificările SkySend pentru livrare și cont.",
);

export default function NotificăriPage() {
  return (
    <section className="grid gap-6">
      <Link
        href="/client/settings"
        className="inline-flex size-11 items-center justify-center rounded-full border border-border/80 bg-secondary/45 text-foreground transition hover:border-primary/35 hover:bg-secondary/70 compact-ui:inline-flex expanded-ui:hidden"
        aria-label="Inapoi la cont"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <PageHeader
        eyebrow="Notificări"
        title="Actualizări livrare"
        description="Actualizările comenzii, confirmările de plată și alertele de livrare sunt colectate aici."
        actions={[
          {
            label: "Deschide livrarea activă",
            href: "/client/active-delivery",
            icon: <Route className="size-4" />,
          },
        ]}
      />

      <NotificăriView />
    </section>
  );
}
