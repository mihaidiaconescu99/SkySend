"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { assistantFaq, normalizeAssistantText } from "@/lib/ai/skysend-assistant-knowledge";

const categoryLabels: Record<string, string> = {
  general: "General",
  delivery: "Livrare",
  handoff: "Predare și ridicare",
  "meeting-points": "Puncte de întâlnire",
  parcels: "Colete",
  payments: "Plăți și facturi",
  security: "Siguranță",
  tracking: "Tracking",
  cancellations: "Anulări și rambursări",
  technical: "Probleme tehnice",
  account: "Cont",
  support: "Suport",
  "assistant-limits": "Limitele assistant-ului",
};

export function FaqContent() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeAssistantText(query);
  const groups = useMemo(() => {
    const filtered = assistantFaq.filter((item) =>
      !normalizedQuery || normalizeAssistantText(
        `${item.title} ${item.aliases.join(" ")} ${item.keywords.join(" ")} ${item.body}`,
      ).includes(normalizedQuery),
    );
    const grouped = new Map<string, typeof assistantFaq>();
    for (const item of filtered) {
      grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [normalizedQuery]);

  return (
    <section className="grid gap-8">
      <label className="grid gap-2">
        <span className="text-sm font-medium">Caută în cele {assistantFaq.length} de întrebări</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: card, PIN, locker, anulare, greutate..."
          className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary"
        />
      </label>

      {groups.length ? groups.map(([category, items]) => (
        <div key={category} className="grid gap-4">
          <h2 className="type-h2">{categoryLabels[category] ?? category}</h2>
          {items.map((item) => (
            <Card key={item.id} className="border-border/80 bg-card/90">
              <CardContent className="grid gap-2 p-5 md:p-6">
                <h3 className="font-heading text-xl tracking-tight">{item.title}</h3>
                <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.body}</p>
                {item.href ? (
                  <Link href={item.href} className="mt-1 text-sm font-semibold text-primary hover:underline">
                    Deschide pagina relevantă
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )) : (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Nu am găsit o întrebare pentru această căutare. Încearcă termeni mai scurți sau întreabă assistant-ul.
        </p>
      )}
    </section>
  );
}

