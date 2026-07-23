"use client";

import { useEffect, useState } from "react";
import type { OperationalStatusSnapshot } from "@/types/operational-status";

export function OperationalNotice() {
  const [status, setStatus] = useState<OperationalStatusSnapshot | null>(null);
  useEffect(() => {
    void fetch("/api/operational-status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setStatus)
      .catch(() => undefined);
  }, []);
  if (status?.weather.level !== "warning") return null;
  return (
    <details className="fixed bottom-4 right-4 z-50 max-w-sm rounded-[var(--radius)] border border-amber-400/40 bg-background/95 p-3 text-sm shadow-xl backdrop-blur">
      <summary className="cursor-pointer font-medium">Avertizare meteo</summary>
      <p className="mt-2 leading-6 text-muted-foreground">Condițiile meteo pot produce întârzieri temporare. Serviciul rămâne disponibil.</p>
    </details>
  );
}
