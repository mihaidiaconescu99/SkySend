"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { BillingDocumentSummary } from "@/types/billing";

export function OrderBillingDocuments({ orderId }: { orderId: string }) {
  const [documents, setDocuments] = useState<BillingDocumentSummary[] | null>(null);
  useEffect(() => {
    void fetch(`/api/billing/documents?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { documents: [] })
      .then((result) => setDocuments(result.documents ?? []));
  }, [orderId]);
  if (!documents?.length) return null;
  return (
    <SectionCard eyebrow="Facturare" title="Documente" description="Factura originală și documentele de corecție sunt păstrate separat.">
      <div className="grid gap-3">
        {documents.map((document) => (
          <div key={document.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius)] border bg-background p-4">
            <div className="flex items-center gap-3"><FileText className="size-5" /><div><p className="font-medium">{document.type === "invoice" ? "Factură" : "Document de corecție"} {document.number}</p><p className="text-sm text-muted-foreground">{(document.amountMinor / 100).toFixed(2)} {document.currency}{document.refundReason ? ` · ${document.refundReason}` : ""}</p></div></div>
            {document.status === "ready" && document.downloadHref ? <a href={document.downloadHref} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius)] border px-3 text-sm font-medium"><Download className="size-4" />Descarcă PDF</a> : <StatusBadge label={document.status === "failed" ? "Generare eșuată" : "PDF în curs de generare"} tone={document.status === "failed" ? "destructive" : "info"} />}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
