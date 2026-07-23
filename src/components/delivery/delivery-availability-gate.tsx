"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { OperationalStatusSnapshot } from "@/types/operational-status";

export function DeliveryAvailabilityGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<OperationalStatusSnapshot | null>(null);
  useEffect(() => {
    void fetch("/api/operational-status", { cache: "no-store" })
      .then((response) => response.json())
      .then(setStatus);
  }, []);
  if (!status) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin" /></div>;
  if (status.effectiveStatus !== "active") {
    return (
      <section className="flex min-h-[70vh] items-center justify-center p-6 text-center">
        <div className="max-w-2xl rounded-[calc(var(--radius)+1rem)] border bg-card p-8 shadow-[var(--elevation-card)]">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Disponibilitate SkySend</p>
          <h1 className="mt-4 font-heading text-4xl tracking-tight">Operațiuni suspendate temporar</h1>
          <p className="mt-4 leading-7 text-muted-foreground">Crearea livrărilor va reveni automat când platforma este din nou Active. Comenzile, trackingul și suportul rămân accesibile.</p>
        </div>
      </section>
    );
  }
  return children;
}
