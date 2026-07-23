"use client";

import { useEffect, useState } from "react";
import { AppButton } from "@/components/shared/app-button";
import { Card, CardContent } from "@/components/ui/card";

type DocumentRow = { id: string; document_type: string; document_number: string; generation_status: string; attempt_count: number; last_error_code: string | null; last_error_message: string | null };

export function AdminBillingDocuments({ orderId }: { orderId: string }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const refresh = async () => {
    const response = await fetch(`/api/admin/billing/documents?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" });
    if (response.ok) setDocuments((await response.json()).documents ?? []);
  };
  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/billing/documents?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { documents: [] })
      .then((result) => { if (active) setDocuments(result.documents ?? []); });
    return () => { active = false; };
  }, [orderId]);
  if (!documents.length) return null;
  const retry = async (id: string) => {
    const response = await fetch(`/api/admin/billing/documents/${id}/retry`, { method: "POST" });
    if (response.ok) await refresh();
  };
  return <Card className="rounded-[calc(var(--radius)+0.5rem)]"><CardContent className="grid gap-3 p-5"><p className="font-medium">Documente de facturare</p>{documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border p-4"><div><p className="font-medium">{document.document_number} · {document.generation_status}</p><p className="text-xs text-muted-foreground">Încercări: {document.attempt_count}{document.last_error_code ? ` · ${document.last_error_code}` : ""}</p>{document.last_error_message ? <p className="mt-1 text-xs text-destructive">{document.last_error_message}</p> : null}</div>{document.generation_status === "failed" ? <AppButton type="button" variant="outline" size="sm" onClick={() => retry(document.id)}>Reîncearcă generarea</AppButton> : null}</div>)}</CardContent></Card>;
}
