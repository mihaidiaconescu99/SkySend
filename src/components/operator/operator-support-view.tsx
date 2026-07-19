"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  SendHorizontal,
  UserPlus,
  X,
} from "lucide-react";
import { uploadMessageFiles } from "@/lib/attachments/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Profile = { id?: string; full_name?: string | null; email?: string | null; avatar_url?: string | null };
type Attachment = { id: string; original_name: string; content_type: string; size_bytes: number };
type Ticket = {
  id: string;
  conversation_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigned_operator_profile_id: string | null;
  updated_at: string;
  client_profile?: Profile | null;
  assigned_operator?: Profile | null;
  assistant_conversations?: { contact_email?: string | null } | null;
};
type Message = {
  id: string;
  author_type: string;
  body: string;
  created_at: string;
  author_profile?: Profile | null;
  file_attachments?: Attachment[];
};
type Conversation = { id: string; support_tickets?: Ticket[]; assistant_messages?: Message[]; client_profile?: Profile | null };
type QueueKey = "unassigned" | "claimed" | "waiting_customer" | "closed";

const queues: Array<{ key: QueueKey; label: string }> = [
  { key: "unassigned", label: "Neasignate" },
  { key: "claimed", label: "Preluate" },
  { key: "waiting_customer", label: "Așteaptă clientul" },
  { key: "closed", label: "Închise" },
];

const quickReplies = [
  { label: "Verific acum", body: "Îți mulțumesc pentru detalii. Verific solicitarea și revin în această conversație." },
  { label: "Confirmă status", body: "Am actualizat solicitarea. Te rog să confirmi dacă problema persistă." },
  { label: "Checking now", body: "Thank you for the details. I’m checking your request and will follow up in this conversation." },
  { label: "Confirm status", body: "I’ve updated your request. Please confirm whether the issue still persists." },
] as const;

function PersonAvatar({ profile, fallback }: { profile?: Profile | null; fallback: string }) {
  return profile?.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt="" className="size-8 shrink-0 rounded-full border object-cover" />
  ) : (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-background text-xs font-semibold text-foreground">
      {(profile?.full_name ?? profile?.email ?? fallback).slice(0, 1).toUpperCase()}
    </span>
  );
}

export function OperatorSupportView() {
  const [queue, setQueue] = useState<QueueKey>("unassigned");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<QueueKey, number>>({ unassigned: 0, claimed: 0, waiting_customer: 0, closed: 0 });
  const [profileId, setProfileId] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/operator/support/tickets?queue=${queue}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) {
        setTickets(payload.tickets ?? []);
        setCounts(payload.counts ?? {});
        setProfileId(payload.identity?.profileId ?? "");
        setRole(payload.identity?.role ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, [queue]);

  const loadConversation = useCallback(async (ticket: Ticket) => {
    setSelected(ticket);
    const response = await fetch(`/api/assistant/conversations/${ticket.conversation_id}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok) setConversation(payload.conversation);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTickets(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTickets]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadTickets();
      if (selected) void loadConversation(selected);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadTickets, loadConversation, selected]);

  const messages = useMemo(
    () => (conversation?.assistant_messages ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [conversation],
  );
  const detailTicket = conversation?.support_tickets?.[0] ?? selected;
  const isAdmin = role === "admin";
  const isClosed = detailTicket?.status === "closed";
  const ownsTicket = detailTicket?.assigned_operator_profile_id === profileId;
  const canWrite = Boolean(detailTicket?.assigned_operator_profile_id && !isClosed && (ownsTicket || isAdmin));
  const canRelease = Boolean(detailTicket?.assigned_operator_profile_id && !isClosed && (ownsTicket || isAdmin));

  async function patch(action: "claim" | "release" | "close") {
    if (!detailTicket || !selected) return;
    setFeedback(null);
    const response = await fetch(`/api/operator/support/tickets/${detailTicket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setFeedback(payload.error === "ticket_already_claimed" ? "Tichetul a fost preluat între timp de alt operator." : "Acțiunea nu a putut fi aplicată.");
      return;
    }
    await loadConversation(selected);
    await loadTickets();
  }

  async function sendReply() {
    if (!selected || !reply.trim() || !canWrite || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/assistant/conversations/${selected.conversation_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "send_failed");
      if (files.length && payload.message?.id) {
        await uploadMessageFiles({ scope: "support", parentId: payload.message.id, files });
      }
      setReply("");
      setFiles([]);
      await loadConversation(selected);
      await loadTickets();
    } catch {
      setFeedback("Răspunsul sau una dintre imagini nu a putut fi trimisă.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="app-container grid gap-5 py-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <aside className="rounded-[var(--ui-radius-panel)] border bg-card p-3 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3 px-2 pt-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Operator</p>
            <h1 className="font-heading text-2xl">Suport clienți</h1>
          </div>
          <Button size="icon" variant="ghost" aria-label="Actualizează" onClick={() => void loadTickets()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
          {queues.map((item) => (
            <button key={item.key} type="button" onClick={() => setQueue(item.key)} className={cn("flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium", queue === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <span className="truncate">{item.label}</span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", queue === item.key ? "bg-primary/10 text-primary" : "bg-background")}>{counts[item.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          {loading ? <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Se încarcă</div> : tickets.length ? tickets.map((ticket) => (
            <button key={ticket.id} type="button" onClick={() => void loadConversation(ticket)} className={cn("rounded-2xl border p-3 text-left transition-colors", selected?.id === ticket.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/70")}>
              <div className="flex items-start gap-2.5">
                <PersonAvatar profile={ticket.client_profile} fallback="C" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold">{ticket.subject}</p>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", ticket.priority === "urgent" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{ticket.priority}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{ticket.client_profile?.full_name ?? ticket.client_profile?.email ?? ticket.assistant_conversations?.contact_email ?? "Client"}</p>
                  {ticket.assigned_operator_profile_id ? <p className="mt-1 truncate text-[11px] text-primary">Preluat de {ticket.assigned_operator?.full_name ?? ticket.assigned_operator?.email ?? "operator"}</p> : null}
                </div>
              </div>
            </button>
          )) : <p className="rounded-2xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">Nu sunt solicitări în această categorie.</p>}
        </div>
      </aside>

      <main className="flex min-h-[42rem] min-w-0 flex-col overflow-hidden rounded-[var(--ui-radius-panel)] border bg-card shadow-sm">
        {selected && detailTicket ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{detailTicket.category} · {isClosed ? "Închis" : detailTicket.status}</p>
                <h2 className="truncate font-heading text-xl">{detailTicket.subject}</h2>
                {detailTicket.assigned_operator_profile_id && !ownsTicket ? <p className="mt-1 text-xs text-muted-foreground">Vizualizare: tichet preluat de {detailTicket.assigned_operator?.full_name ?? detailTicket.assigned_operator?.email ?? "alt operator"}.</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!detailTicket.assigned_operator_profile_id && !isClosed ? <Button size="sm" onClick={() => void patch("claim")}><UserPlus className="size-4" />Preia</Button> : null}
                {canRelease ? <Button size="sm" variant="outline" onClick={() => void patch("release")}><LogOut className="size-4" />Eliberează</Button> : null}
                {canWrite ? <Button size="sm" variant="outline" onClick={() => void patch("close")}><CheckCircle2 className="size-4" />Închide</Button> : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-5">
              {messages.map((message) => {
                const operatorMessage = message.author_type === "operator";
                const systemMessage = message.author_type === "system" || message.author_type === "assistant";
                if (systemMessage) return <div key={message.id} className="mx-auto max-w-xl rounded-full bg-muted px-4 py-2 text-center text-xs text-muted-foreground">{message.body}</div>;
                const profile = message.author_profile ?? (operatorMessage ? detailTicket.assigned_operator : conversation?.client_profile);
                return (
                  <div key={message.id} className={cn("flex max-w-[88%] items-end gap-2", operatorMessage && "ml-auto flex-row-reverse")}>
                    <PersonAvatar profile={profile} fallback={operatorMessage ? "O" : "C"} />
                    <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm shadow-sm", operatorMessage ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}>
                      <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                      {message.file_attachments?.length ? <div className="mt-2 grid gap-1">{message.file_attachments.map((attachment) => <a key={attachment.id} href={`/api/attachments/${attachment.id}`} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">{attachment.original_name}</a>)}</div> : null}
                      <time className="mt-1 block text-[10px] opacity-65">{new Date(message.created_at).toLocaleString("ro-RO")}</time>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t bg-card p-4">
              {isClosed ? <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="size-4" />Conversație închisă. Rămâne disponibilă doar pentru consultare.</div> : canWrite ? (
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">{quickReplies.map((template) => <button key={template.label} type="button" onClick={() => setReply(template.body)} className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground">{template.label}</button>)}</div>
                  {files.length ? <div className="flex flex-wrap gap-2">{files.map((file) => <span key={`${file.name}-${file.size}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">{file.name}<button type="button" aria-label={`Elimină ${file.name}`} onClick={() => setFiles((current) => current.filter((item) => item !== file))}><X className="size-3" /></button></span>)}</div> : null}
                  <div className="flex items-end gap-2">
                    <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border bg-background text-muted-foreground hover:text-foreground">
                      <ImagePlus className="size-4" /><span className="sr-only">Adaugă imagini</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 2))} />
                    </label>
                    <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} placeholder="Răspunde clientului…" className="min-h-11 flex-1 resize-y rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                    <Button className="h-11" onClick={() => void sendReply()} disabled={!reply.trim() || sending}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}Trimite</Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Maximum 2 imagini per mesaj, 25 MB fiecare.</p>
                </div>
              ) : <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed p-3 text-sm text-muted-foreground"><LockKeyhole className="size-4" />{detailTicket.assigned_operator_profile_id ? "Poți citi conversația, dar doar operatorul care a preluat-o poate răspunde." : "Preia tichetul pentru a răspunde și a-l putea închide."}</div>}
              {feedback ? <p role="status" className="mt-3 text-sm text-destructive">{feedback}</p> : null}
            </div>
          </>
        ) : <div className="grid flex-1 place-items-center p-8 text-center"><div><h2 className="font-heading text-2xl">Alege o solicitare</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Poți consulta orice tichet. Preia-l înainte să răspunzi, apoi îl poți elibera sau închide.</p></div></div>}
      </main>
    </section>
  );
}
