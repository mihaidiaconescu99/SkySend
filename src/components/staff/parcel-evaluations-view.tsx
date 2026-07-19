"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, LogOut, PackageSearch, RefreshCw, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Profile = { id: string; full_name: string | null; email: string | null; avatar_url: string | null };
type EvaluationMessage = { id: string; author_type: string; message_kind: string; reply_to_message_id: string | null; body: string; created_at: string; author_profile?: Profile | null; file_attachments?: Array<{ id: string; original_name: string }> };
type Evaluation = { id: string; status: string; initial_description: string; parcel_snapshot: Record<string, unknown>; weight_kg: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null; warnings: string[]; assigned_operator_profile_id: string | null; assigned_operator?: Profile | null; client_profile?: Profile | null; created_at: string; updated_at: string; parcel_evaluation_messages?: EvaluationMessage[] };

const warnings = [["fragile", "Fragil"], ["temperature", "Temperatură"], ["liquid", "Lichide"], ["humidity", "Umiditate"], ["orientation", "Orientare"]] as const;
const statusLabels: Record<string, string> = { requested: "Nouă", in_review: "În evaluare", waiting_customer: "Așteaptă clientul", customer_replied: "Răspuns primit", finalized: "Finalizată", cancelled: "Anulată" };

export function ParcelEvaluationsView() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState("");
  const [role, setRole] = useState("");
  const [question, setQuestion] = useState("");
  const [draft, setDraft] = useState({ weightKg: "", lengthCm: "", widthCm: "", heightCm: "", warnings: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/staff/parcel-evaluations", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) {
      setEvaluations(payload.evaluations ?? []);
      setProfileId(payload.identity?.profileId ?? "");
      setRole(payload.identity?.role ?? "");
      setSelectedId((current) => current && payload.evaluations.some((item: Evaluation) => item.id === current) ? current : payload.evaluations[0]?.id ?? null);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const selected = useMemo(() => evaluations.find((item) => item.id === selectedId) ?? null, [evaluations, selectedId]);
  const thread = useMemo(() => (selected?.parcel_evaluation_messages ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)), [selected]);
  const pendingQuestion = useMemo(() => thread.find((message) => message.message_kind === "question" && !thread.some((candidate) => candidate.message_kind === "answer" && candidate.reply_to_message_id === message.id)), [thread]);
  const closed = selected ? ["finalized", "cancelled"].includes(selected.status) : true;
  const readOnly = Boolean(selected?.assigned_operator_profile_id && selected.assigned_operator_profile_id !== profileId && role !== "admin");
  const volume = Number(draft.lengthCm) * Number(draft.widthCm) * Number(draft.heightCm);

  function choose(evaluation: Evaluation) {
    setSelectedId(evaluation.id);
    setDraft({ weightKg: evaluation.weight_kg ? String(evaluation.weight_kg) : "", lengthCm: evaluation.length_cm ? String(evaluation.length_cm) : "", widthCm: evaluation.width_cm ? String(evaluation.width_cm) : "", heightCm: evaluation.height_cm ? String(evaluation.height_cm) : "", warnings: evaluation.warnings ?? [] });
    setQuestion(""); setFeedback(null);
  }
  async function mutate(path: string, body: Record<string, unknown>) {
    setBusy(true); setFeedback(null);
    try {
      const response = await fetch(path, { method: body.body && !body.action ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setQuestion(""); await load(); setFeedback(body.action === "finalize" ? "Profilul final a fost aplicat livrării clientului." : "Actualizare salvată.");
    } catch (error) { setFeedback(error instanceof Error && error.message === "active_question_exists" ? "Există deja o întrebare fără răspuns." : "Acțiunea nu a putut fi finalizată."); }
    finally { setBusy(false); }
  }
  async function finalize() {
    if (!selected) return;
    const values = [draft.weightKg, draft.lengthCm, draft.widthCm, draft.heightCm].map(Number);
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) { setFeedback("Completează toate valorile cu numere pozitive."); return; }
    await mutate(`/api/staff/parcel-evaluations/${selected.id}`, { action: "finalize", weightKg: values[0], lengthCm: values[1], widthCm: values[2], heightCm: values[3], warnings: draft.warnings });
  }

  return (
    <section className="app-container grid gap-5 py-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="rounded-[var(--ui-radius-panel)] border bg-card p-3"><div className="mb-4 flex items-start justify-between gap-2 px-2"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Operator</p><h1 className="font-heading text-2xl">Evaluări colete</h1></div><Button size="icon" variant="ghost" onClick={() => void load()}><RefreshCw className="size-4" /></Button></div><div className="grid gap-1.5">{evaluations.length ? evaluations.map((evaluation) => <button key={evaluation.id} type="button" onClick={() => choose(evaluation)} className={cn("rounded-2xl border p-3 text-left", selected?.id === evaluation.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted")}><div className="flex items-start gap-2"><PackageSearch className="mt-0.5 size-4 shrink-0 text-primary" /><div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold">{evaluation.initial_description}</p><p className="mt-1 truncate text-xs text-muted-foreground">{evaluation.client_profile?.full_name || evaluation.client_profile?.email || "Client"}</p><p className="mt-1 text-[11px] text-primary">{statusLabels[evaluation.status] ?? evaluation.status}</p></div></div></button>) : <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Nu există cereri de evaluare.</p>}</div></aside>
      <main className="min-h-[42rem] min-w-0 overflow-hidden rounded-[var(--ui-radius-panel)] border bg-card">{selected ? <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="flex min-h-[42rem] min-w-0 flex-col border-r"><header className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><p className="text-xs text-muted-foreground">{statusLabels[selected.status] ?? selected.status}</p><h2 className="font-heading text-xl">Cerere {selected.id.slice(0, 8)}</h2>{readOnly ? <p className="mt-1 text-xs text-muted-foreground">Preluată de {selected.assigned_operator?.full_name || selected.assigned_operator?.email || "alt operator"}; disponibilă doar pentru citire.</p> : null}</div>{selected.assigned_operator_profile_id && !closed && !readOnly ? <Button size="sm" variant="outline" onClick={() => void mutate(`/api/staff/parcel-evaluations/${selected.id}`, { action: "release" })}><LogOut className="size-4" />Eliberează</Button> : null}</header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-5"><div className="rounded-2xl border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descriere client</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.initial_description}</p></div>{thread.filter((message) => message.message_kind !== "request").map((message) => <div key={message.id} className={cn("max-w-[88%] rounded-2xl border bg-card p-3 text-sm", ["operator", "admin"].includes(message.author_type) && "ml-auto border-primary/25 bg-primary/5", message.author_type === "system" && "mx-auto text-center text-xs text-muted-foreground")}><p className="whitespace-pre-wrap leading-6">{message.body}</p>{message.file_attachments?.length ? <div className="mt-2">{message.file_attachments.map((attachment) => <a key={attachment.id} href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="mr-2 text-xs text-primary underline">{attachment.original_name}</a>)}</div> : null}<time className="mt-1 block text-[10px] text-muted-foreground">{new Date(message.created_at).toLocaleString("ro-RO")}</time></div>)}</div>{!closed && !readOnly ? <div className="border-t p-4"><div className="flex items-end gap-2"><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={pendingQuestion ? "Așteaptă răspunsul clientului…" : "Întrebare nouă pentru client…"} disabled={Boolean(pendingQuestion)} className="min-h-16 flex-1 rounded-xl border bg-background p-3 text-sm" /><Button disabled={!question.trim() || busy || Boolean(pendingQuestion)} onClick={() => void mutate(`/api/staff/parcel-evaluations/${selected.id}/messages`, { body: question.trim() })}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}Trimite</Button></div></div> : null}</div><aside className="grid content-start gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profil final</p><h3 className="mt-1 font-heading text-xl">Date colet</h3></div><div className="grid grid-cols-2 gap-3">{[["weightKg", "Greutate kg"], ["lengthCm", "Lungime cm"], ["widthCm", "Lățime cm"], ["heightCm", "Înălțime cm"]].map(([field, label]) => <label key={field} className="grid gap-1.5 text-xs text-muted-foreground">{label}<input type="number" min="0.01" step="0.01" disabled={closed || readOnly} value={draft[field as keyof typeof draft] as string} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground" /></label>)}</div><div className="rounded-xl bg-muted p-3 text-sm"><span className="text-muted-foreground">Volum:</span> {Number.isFinite(volume) && volume > 0 ? `${volume.toLocaleString("ro-RO")} cm³` : "—"}</div><div className="flex flex-wrap gap-2">{warnings.map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs"><input type="checkbox" disabled={closed || readOnly} checked={draft.warnings.includes(value)} onChange={() => setDraft((current) => ({ ...current, warnings: current.warnings.includes(value) ? current.warnings.filter((item) => item !== value) : [...current.warnings, value] }))} />{label}</label>)}</div>{!closed && !readOnly ? <Button disabled={busy} onClick={() => void finalize()}><CheckCircle2 className="size-4" />Finalizează evaluarea</Button> : null}{feedback ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{feedback}</p> : null}</aside></div> : <div className="grid min-h-[42rem] place-items-center p-8 text-center"><div><PackageSearch className="mx-auto size-8 text-primary" /><h2 className="mt-3 font-heading text-2xl">Alege o evaluare</h2></div></div>}</main>
    </section>
  );
}
