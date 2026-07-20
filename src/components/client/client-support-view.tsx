"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, LoaderCircle, LockKeyhole, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadMessageFiles } from "@/lib/attachments/client";
import { cn } from "@/lib/utils";

type Profile = { full_name?: string | null; email?: string | null; avatar_url?: string | null };
type Attachment = { id: string; original_name: string };
type Summary = { id: string; title: string; mode: string; last_message_at: string; support_tickets?: Array<{ id: string; status: string; assigned_operator_profile_id: string | null }> };
type Detail = { id: string; client_profile?: Profile | null; support_tickets?: Array<{ id: string; status: string; assigned_operator_profile_id: string | null; assigned_operator?: Profile | null }>; assistant_messages?: Array<{ id: string; author_type: string; body: string; created_at: string; author_profile?: Profile | null; file_attachments?: Attachment[] }> };

function Avatar({ profile, label }: { profile?: Profile | null; label: string }) {
  return profile?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt="" className="size-8 shrink-0 rounded-full border object-cover" />
  ) : <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background text-xs font-semibold">{label}</span>;
}

export function ClientSupportView() {
  const [items, setItems] = useState<Summary[]>([]);
  const [current, setCurrent] = useState<Detail | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/assistant/conversations", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setItems(payload.conversations ?? []);
  }, []);
  const select = useCallback(async (id: string) => {
    const response = await fetch(`/api/assistant/conversations/${id}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setCurrent(payload.conversation);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const messages = useMemo(() => (current?.assistant_messages ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)), [current]);
  const ticket = current?.support_tickets?.[0];
  const closed = ticket?.status === "closed";

  async function send() {
    if (!current || !body.trim() || closed || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/assistant/conversations/${current.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "send_failed");
      if (files.length && payload.message?.id) await uploadMessageFiles({ scope: "support", parentId: payload.message.id, files });
      setBody("");
      setFiles([]);
      await select(current.id);
      await load();
    } catch {
      setFeedback("Mesajul sau una dintre imagini nu a putut fi trimisă.");
    } finally { setSending(false); }
  }

  return (
    <section className="app-container grid gap-5 py-6 expanded-ui:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="rounded-[var(--ui-radius-panel)] border bg-card p-3">
        <h1 className="px-2 font-heading text-2xl">Suport SkySend</h1>
        <p className="mb-4 px-2 text-sm text-muted-foreground">Conversațiile tale rămân în istoric 90 de zile.</p>
        <div className="grid gap-1">{items.map((item) => <button key={item.id} type="button" onClick={() => void select(item.id)} className={cn("block w-full rounded-xl p-3 text-left hover:bg-muted", current?.id === item.id && "bg-muted")}><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.support_tickets?.[0]?.status === "closed" ? "Închis" : item.support_tickets?.[0]?.assigned_operator_profile_id ? "Preluat" : item.support_tickets?.[0] ? "În așteptare" : "Asistent AI"}</p></button>)}</div>
      </aside>
      <main className="flex min-h-[38rem] min-w-0 flex-col overflow-hidden rounded-[var(--ui-radius-panel)] border bg-card">
        {current ? <>
          <header className="border-b p-5"><h2 className="font-heading text-xl">Conversație suport</h2><p className="text-sm text-muted-foreground">{ticket ? closed ? "Închisă · disponibilă în istoric" : ticket.assigned_operator_profile_id ? "Operator asignat" : "Așteaptă preluarea de către un operator" : "Asistent AI"}</p></header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5">{messages.map((message) => {
            const mine = message.author_type === "client";
            const system = message.author_type === "system" || message.author_type === "assistant";
            if (system) return <div key={message.id} className="mx-auto max-w-xl rounded-full bg-muted px-4 py-2 text-center text-xs text-muted-foreground">{message.body}</div>;
            return <div key={message.id} className={cn("flex max-w-[88%] items-end gap-2", mine && "ml-auto flex-row-reverse")}><Avatar profile={message.author_profile ?? (mine ? current.client_profile : ticket?.assigned_operator)} label={mine ? "C" : "O"} /><div className={cn("rounded-2xl px-3.5 py-2.5 text-sm shadow-sm", mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}><p className="whitespace-pre-wrap leading-6">{message.body}</p>{message.file_attachments?.length ? <div className="mt-2 grid gap-1">{message.file_attachments.map((attachment) => <a key={attachment.id} href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="text-xs underline">{attachment.original_name}</a>)}</div> : null}<time className="mt-1 block text-[10px] opacity-65">{new Date(message.created_at).toLocaleString("ro-RO")}</time></div></div>;
          })}</div>
          {ticket ? <div className="border-t p-4">{closed ? <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="size-4" />Conversația este închisă și nu mai acceptă mesaje.</div> : <div className="grid gap-3">{files.length ? <div className="flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">{file.name}<button type="button" onClick={() => setFiles((currentFiles) => currentFiles.filter((item) => item !== file))}><X className="size-3" /></button></span>)}</div> : null}<div className="flex items-end gap-2"><label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border"><ImagePlus className="size-4" /><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 2))} /></label><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Răspunde în conversație…" className="min-h-11 flex-1 rounded-xl border bg-background p-2.5 text-sm" /><Button className="h-11" onClick={() => void send()} disabled={!body.trim() || sending}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}Trimite</Button></div><p className="text-[11px] text-muted-foreground">Maximum 2 imagini, 25 MB fiecare.</p></div>}{feedback ? <p className="mt-2 text-sm text-destructive">{feedback}</p> : null}</div> : null}
        </> : <div className="grid flex-1 place-items-center p-8 text-center text-muted-foreground">Deschide o conversație pentru a vedea istoricul.</div>}
      </main>
    </section>
  );
}
