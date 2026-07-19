"use client";

import { useEffect, useState } from "react";
import { Clock3, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RequestState = { id: string; status: string; reason: string; requested_duration_minutes: number; review_note: string | null; created_at: string } | null;

export function AdminAccessRequestGate() {
  const [requestState, setRequestState] = useState<RequestState>(null);
  const [duration, setDuration] = useState(1440);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/access/requests", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setRequestState(body.request ?? null);
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/access/requests", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (active && ok) setRequestState(body.request ?? null);
      });
    return () => { active = false; };
  }, []);

  async function submit() {
    setBusy(true); setError(null);
    const response = await fetch("/api/access/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duration, reason }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error ?? "Cererea nu a putut fi trimisă.");
    else { setReason(""); await load(); }
    setBusy(false);
  }

  async function cancel() {
    setBusy(true); setError(null);
    const response = await fetch("/api/access/requests", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error ?? "Cererea nu a putut fi anulată.");
    else await load();
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-3xl place-items-center">
        <Card className="w-full border-primary/25">
          <CardHeader><div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div><CardTitle className="mt-3 text-2xl">Solicită acces la Spațiul admin</CardTitle><CardDescription>Poți vedea permanent toate spațiile, dar platforma Admin se deschide numai după aprobarea temporară a unui administrator permanent.</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            {error ? <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-destructive">{error}</p> : null}
            {requestState?.status === "pending" ? (
              <div className="grid gap-4"><div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4"><div><p className="font-medium">Cerere în așteptare</p><p className="mt-1 text-sm text-muted-foreground">Trimisă la {new Date(requestState.created_at).toLocaleString("ro-RO")}</p></div><Badge variant="warning"><Clock3 className="mr-1 size-3" />În așteptare</Badge></div><p className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm leading-6">{requestState.reason}</p><Button variant="outline" onClick={cancel} disabled={busy} className="w-fit"><X className="size-4" />Anulează cererea</Button></div>
            ) : (
              <div className="grid gap-4"><label className="grid gap-2 text-sm">Cât timp ai nevoie?<select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="h-12 rounded-2xl border border-input bg-muted px-4"><option value={60}>1 oră</option><option value={240}>4 ore</option><option value={1440}>1 zi</option><option value={10080}>7 zile</option></select></label><label className="grid gap-2 text-sm">De ce ai nevoie de acces?<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={20} maxLength={1000} rows={6} className="rounded-2xl border border-input bg-muted p-4 outline-none focus:border-primary" placeholder="Descrie operațiunea administrativă și motivul accesului..." /></label><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{reason.trim().length}/1000 · minimum 20</span><Button onClick={submit} disabled={busy || reason.trim().length < 20}>Trimite cererea</Button></div>{requestState && requestState.status !== "cancelled" ? <p className="text-sm text-muted-foreground">Ultima cerere: <strong>{requestState.status}</strong>{requestState.review_note ? ` — ${requestState.review_note}` : ""}</p> : null}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
