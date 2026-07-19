import { ShieldCheck } from "lucide-react";
import { PublicSection } from "@/components/layout/public-section";
import { PublicTrackingCodeForm } from "@/components/recipient/public-tracking-code-form";
import { Card, CardContent } from "@/components/ui/card";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Urmărește comanda",
  "Introdu codul comenzii pentru a vedea starea livrării SkySend.",
);

export default function TrackingPage() {
  return (
    <PublicSection
      id="tracking"
      eyebrow="Urmărire live"
      title="Urmărește comanda"
      description="Introdu codul comenzii pentru a vedea starea livrării."
    >
      <Card className="rounded-[var(--ui-radius-panel)]">
        <CardContent className="grid gap-6 p-6 md:p-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="max-w-2xl">
              <p className="font-medium text-foreground">Ai un cod de comandă?</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Introdu codul primit de la expeditor. Urmărirea publică arată
                starea, ETA-ul și progresul fără date private despre cont sau plată.
              </p>
            </div>
          </div>

          <PublicTrackingCodeForm />

          <div className="flex items-start gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background">
              <ShieldCheck className="size-4 text-foreground" />
            </span>
            <p className="text-sm leading-6 text-muted-foreground">
              Urmărirea publică afișează doar starea livrării, ETA-ul și
              progresul. Nu afișează date de plată, cont, email, telefon sau
              note interne.
            </p>
          </div>
        </CardContent>
      </Card>
    </PublicSection>
  );
}
