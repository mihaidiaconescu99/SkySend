"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { Input } from "@/components/ui/input";
import { normalizePublicTrackingCode } from "@/lib/recipient-tracking";

export function PublicTrackingCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const normalizedCode = normalizePublicTrackingCode(code);
  const canSubmit = normalizedCode.length >= 8;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Introdu codul comenzii pentru a continua.");
      return;
    }

    const response = await fetch(
      `/api/orders/by-tracking-identifier?identifier=${encodeURIComponent(
        normalizedCode,
      )}`,
    );

    if (!response.ok) {
      setError(
        "Nu am găsit o comandă cu acest cod. Verifică dacă l-ai introdus corect.",
      );
      return;
    }

    router.push(`/tracking/${encodeURIComponent(normalizedCode)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid gap-3 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-background p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor="public-tracking-code">
          Introdu codul comenzii
        </label>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="public-tracking-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            placeholder="Ex: SKY-PIT-70110-943"
            className="h-12 pl-9 font-mono uppercase tracking-normal"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <AppButton type="submit" className="min-h-12" disabled={!canSubmit}>
          Urmărește
          <ArrowRight className="size-4" />
        </AppButton>
      </div>
      {error ? (
        <p className="rounded-[var(--radius)] border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm leading-6 text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

