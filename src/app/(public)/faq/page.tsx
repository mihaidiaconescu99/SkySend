import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaqContent } from "@/app/(public)/faq/faq-content";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Întrebări frecvente",
  "Răspunsuri verificate despre livrare, colete, plăți, tracking și utilizarea SkySend.",
);

export default function FaqPage() {
  return (
    <div className="app-page-spacing grid gap-12 md:gap-16">
      <PageHeader
        eyebrow="Întrebări frecvente"
        title="Răspunsuri oficiale pentru serviciul SkySend."
        description="FAQ-ul este generat din aceeași bază de cunoștințe folosită de AI Assistant și de tabul Ajutor. Sursa canonică este în limba română."
        actions={[
          {
            label: "Creează livrare",
            href: "/client/create-delivery",
            variant: "default",
            icon: <ArrowRight className="size-4" />,
          },
          { label: "Contact", href: "/contact", variant: "outline" },
        ]}
      />

      <FaqContent />

      <section className="rounded-[var(--ui-radius-panel)] border border-border/80 bg-card p-6 shadow-[var(--elevation-panel)] md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="type-h2">Ai un incident concret?</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Descrie problema în assistant. Un tichet se creează numai după ce confirmi explicit trimiterea către un operator.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/#coverage">Verifică zona</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/contact">Contact</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
