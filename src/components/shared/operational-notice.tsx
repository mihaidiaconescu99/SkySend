"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { OperationalStatusSnapshot } from "@/types/operational-status";

export function OperationalNotice() {
  const pathname = usePathname();
  const [status, setStatus] = useState<OperationalStatusSnapshot | null>(null);

  useEffect(() => {
    if (pathname !== "/client/create-delivery") return;

    void fetch("/api/operational-status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setStatus)
      .catch(() => undefined);
  }, [pathname]);

  if (pathname !== "/client/create-delivery") return null;
  if (status?.weather.level !== "warning") return null;

  return (
    <details className="fixed bottom-4 right-4 z-50 max-w-sm rounded-[var(--radius)] border border-amber-400/40 bg-background/95 p-3 text-sm shadow-xl backdrop-blur">
      <summary className="cursor-pointer font-medium">Avertizare meteo</summary>
      <p className="mt-2 leading-6 text-muted-foreground">Condițiile meteo pot produce întârzieri temporare. Serviciul rămâne disponibil.</p>
    </details>
  );
}
