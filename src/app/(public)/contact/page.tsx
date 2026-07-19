import { ArrowRight, BriefcaseBusiness, LifeBuoy } from "lucide-react";
import { ContactMessageForm } from "@/components/contact/contact-message-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/constants/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Contact",
  "Contacteaza SkySend pentru suport sau intrebari comerciale despre serviciul curent din Pitesti.",
);

const contactTypes = [
  {
    title: "Suport",
    body: "Intrebari despre fluxul comenzii, acoperire, urmarire sau starea livrarii.",
    icon: LifeBuoy,
  },
  {
    title: "Comercial",
    body: "Parteneriate, integrari logistice sau operatiuni locale.",
    icon: BriefcaseBusiness,
  },
] as const;

export default function ContactPage() {
  return (
    <div className="app-page-spacing grid gap-12 md:gap-16">
      <PageHeader
        eyebrow="Contact"
        title="Trimite un mesaj echipei SkySend."
        description="Foloseste aceasta pagina pentru suport SkySend sau intrebari comerciale legate de serviciul activ din Pitesti."
        actions={[
          {
            label: "Creeaza livrare",
            href: "/client/create-delivery",
            variant: "default",
            icon: <ArrowRight className="size-4" />,
          },
          {
            label: "Intrebari frecvente",
            href: "/faq",
            variant: "outline",
          },
        ]}
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <Card className="rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]">
          <CardContent className="grid gap-5 p-6 md:p-8">
            <div className="space-y-2">
              <h2 className="type-h2">Completeaza informatiile esentiale.</h2>
              <p className="text-sm leading-7 text-muted-foreground">
                Include emailul, subiectul si orice referinta de comanda daca
                mesajul este despre o livrare activa.
              </p>
            </div>

            <ContactMessageForm />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {contactTypes.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-[var(--ui-radius-card)] border border-border/80 bg-card p-5"
              >
                <Icon className="size-5 text-primary" />
                <h2 className="mt-4 font-heading text-xl tracking-tight">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
              </div>
            );
          })}

          <div className="rounded-[var(--ui-radius-card)] border border-border/80 bg-secondary/35 p-5">
            <p className="text-sm text-muted-foreground">Email</p>
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="mt-2 block font-heading text-xl tracking-tight text-foreground transition-colors hover:text-primary"
            >
              {siteConfig.supportEmail}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

