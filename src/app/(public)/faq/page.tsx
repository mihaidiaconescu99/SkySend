import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Întrebări frecvente",
  "Răspunsuri scurte despre acoperire, validarea traseului, urmărire și plăți în Pitești.",
);

const faqItems = [
  {
    question: "Unde este disponibil SkySend?",
    answer: "SkySend este activ momentan doar în zona de serviciu Pitești.",
  },
  {
    question: "Pot livra în afara Piteștiului?",
    answer: "Nu. Ridicarea și livrarea trebuie să treacă verificarea de acoperire activă.",
  },
  {
    question: "Ce văd destinatarii?",
    answer: "Destinatarii văd starea livrării, ETA și instrucțiunile de predare, nu detalii private de plată sau cont.",
  },
  {
    question: "Cum funcționează plata?",
    answer: "Comanda afișează prețul înainte de lansare. Datele cardului sunt gestionate de Stripe.",
  },
  {
    question: "Ce se întâmplă dacă livrarea nu poate continua?",
    answer: "Comanda afișează o stare clară, astfel încât clientul sau operatorul poate reîncerca, reprograma sau urmări cazul.",
  },
] as const;

export default function FaqPage() {
  return (
    <div className="app-page-spacing grid gap-12 md:gap-16">
      <PageHeader
        eyebrow="Întrebări frecvente"
        title="Răspunsuri scurte pentru serviciul SkySend curent."
        description="Aceste răspunsuri acoperă ce trebuie să știe utilizatorii înainte să creeze sau să urmărească o livrare în Pitești."
        actions={[
          {
            label: "Creează livrare",
            href: "/client/create-delivery",
            variant: "default",
            icon: <ArrowRight className="size-4" />,
          },
          {
            label: "Contact",
            href: "/contact",
            variant: "outline",
          },
        ]}
      />

      <section className="grid gap-4">
        {faqItems.map((item) => (
          <Card key={item.question} className="border-border/80 bg-card/90">
            <CardContent className="grid gap-2 p-5 md:p-6">
              <h2 className="font-heading text-xl tracking-tight">
                {item.question}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {item.answer}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="rounded-[var(--ui-radius-panel)] border border-border/80 bg-card p-6 shadow-[var(--elevation-panel)] md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="type-h2">Începe cu acoperirea, apoi creează comanda.</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Cele mai multe întrebări primesc răspuns verificând dacă traseul
              se potrivește zonei active Pitești.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/#coverage">Verifică zona</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Contact</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
