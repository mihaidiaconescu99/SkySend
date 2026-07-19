"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, LoaderCircle, Mail, MailOpen, RefreshCw, Reply, RotateCcw, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Attachment = { id: string; original_name: string; content_type: string; size_bytes: number };
type Email = { id: string; direction: "inbound" | "outbound"; sender_email: string; subject: string; body_text: string | null; body_html: string | null; delivery_status: string; created_at: string; file_attachments?: Attachment[] };
type SiteMessage = { id: string; sender_email: string; sender_name: string | null; subject: string; body: string; category: string | null; status: "new" | "read" | "replied" | "archived"; last_message_at: string; created_at: string; contact_message_emails?: Email[] };

const filters = [
  ["all", "Toate"], ["new", "Noi"], ["read", "Citite"], ["replied", "Cu răspuns"], ["archived", "Arhivate"],
] as const;

export function SiteMessagesView() {
  const [status, setStatus] = useState<(typeof filters)[number][0]>("all");
  const [messages, setMessages] = useState<SiteMessage[]>([]);
  const [selected, setSelected] = useState<SiteMessage | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/staff/site-messages?status=${status}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setMessages(payload.messages ?? []);
    } finally { setLoading(false); }
  }, [status]);
  const openMessage = useCallback(async (id: string) => {
    const response = await fetch(`/api/staff/site-messages/${id}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) { setSelected(payload.message); setFeedback(null); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadList(), 0);
    return () => window.clearTimeout(timer);
  }, [loadList]);

  const thread = useMemo(() => {
    if (!selected) return [];
    return [
      { id: `initial-${selected.id}`, direction: "inbound" as const, sender_email: selected.sender_email, subject: selected.subject, body_text: selected.body, body_html: null, delivery_status: "received", created_at: selected.created_at, file_attachments: [] },
      ...(selected.contact_message_emails ?? []),
    ].sort((left, right) => left.created_at.localeCompare(right.created_at));
  }, [selected]);

  async function mutate(body: Record<string, unknown>) {
    if (!selected) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/staff/site-messages/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (body.action === "reply") setReply("");
      await openMessage(selected.id);
      await loadList();
      setFeedback(body.action === "reply" ? "Răspunsul a fost trimis prin email." : "Starea mesajului a fost actualizată.");
    } catch { setFeedback("Acțiunea nu a putut fi finalizată."); }
    finally { setSending(false); }
  }

  return (
    <section className="app-container grid gap-5 py-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="rounded-[var(--ui-radius-panel)] border bg-card p-3">
        <div className="mb-4 flex items-start justify-between gap-2 px-2"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Inbox comun</p><h1 className="font-heading text-2xl">Mesaje site</h1></div><Button variant="ghost" size="icon" onClick={() => void loadList()}><RefreshCw className="size-4" /></Button></div>
        <div className="mb-4 flex flex-wrap gap-1.5">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={cn("rounded-full border px-2.5 py-1 text-xs", status === value ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>{label}</button>)}</div>
        <div className="grid gap-1.5">{loading ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Se încarcă</div> : messages.length ? messages.map((message) => <button key={message.id} type="button" onClick={() => void openMessage(message.id)} className={cn("rounded-2xl border p-3 text-left", selected?.id === message.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted")}><div className="flex items-start gap-2"><span className="mt-0.5">{message.status === "new" ? <Mail className="size-4 text-primary" /> : <MailOpen className="size-4 text-muted-foreground" />}</span><div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold">{message.subject}</p><p className="mt-1 truncate text-xs text-muted-foreground">{message.sender_name || message.sender_email}</p><p className="mt-1 text-[11px] text-muted-foreground">{message.category || "general"} · {message.status}</p></div></div></button>) : <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Nu există mesaje aici.</p>}</div>
      </aside>
      <main className="flex min-h-[42rem] min-w-0 flex-col overflow-hidden rounded-[var(--ui-radius-panel)] border bg-card">
        {selected ? <>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div className="min-w-0"><p className="text-xs text-muted-foreground">{selected.sender_name || "Vizitator"} · {selected.sender_email}</p><h2 className="truncate font-heading text-xl">{selected.subject}</h2></div><Button size="sm" variant="outline" onClick={() => void mutate({ action: selected.status === "archived" ? "restore" : "archive" })}>{selected.status === "archived" ? <RotateCcw className="size-4" /> : <Archive className="size-4" />}{selected.status === "archived" ? "Restaurează" : "Arhivează"}</Button></header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5">{thread.map((email) => <article key={email.id} className={cn("max-w-[88%] rounded-2xl border bg-card p-4 shadow-sm", email.direction === "outbound" && "ml-auto border-primary/25 bg-primary/5")}><div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-muted-foreground">{email.direction === "outbound" ? "SkySend" : email.sender_email}</p><time className="text-[10px] text-muted-foreground">{new Date(email.created_at).toLocaleString("ro-RO")}</time></div><p className="whitespace-pre-wrap text-sm leading-6">{email.body_text || "Mesaj HTML primit."}</p>{email.file_attachments?.length ? <div className="mt-3 flex flex-wrap gap-2">{email.file_attachments.map((attachment) => <a key={attachment.id} href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="rounded-full border px-2.5 py-1 text-xs text-primary hover:underline">{attachment.original_name}</a>)}</div> : null}</article>)}</div>
          <div className="border-t p-4">{selected.status === "archived" ? <p className="rounded-2xl bg-muted p-3 text-center text-sm text-muted-foreground">Restaurează conversația pentru a trimite un răspuns.</p> : <div className="grid gap-2"><label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Reply className="size-3.5" />Răspuns prin email</label><div className="flex items-end gap-2"><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Scrie răspunsul…" className="min-h-20 flex-1 resize-y rounded-xl border bg-background p-3 text-sm" /><Button className="h-11" disabled={!reply.trim() || sending} onClick={() => void mutate({ action: "reply", body: reply.trim() })}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}Trimite</Button></div><p className="text-[11px] text-muted-foreground">Reply-To: ticket-{selected.id}@nexaev.resend.app</p></div>}{feedback ? <p role="status" className="mt-3 text-sm text-muted-foreground">{feedback}</p> : null}</div>
        </> : <div className="grid flex-1 place-items-center p-8 text-center"><div><Mail className="mx-auto size-8 text-primary" /><h2 className="mt-3 font-heading text-2xl">Alege un mesaj</h2><p className="mt-2 text-sm text-muted-foreground">Mesajele formularului public și răspunsurile email apar în același fir.</p></div></div>}
      </main>
    </section>
  );
}
