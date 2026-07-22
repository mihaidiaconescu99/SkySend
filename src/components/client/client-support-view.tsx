"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImagePlus, LoaderCircle, LockKeyhole, Plus, SendHorizontal, X } from "lucide-react";
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
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Summary[]>([]);
  const [current, setCurrent] = useState<Detail | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newMessage, setNewMessage] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [creatingTicket, setCreatingTicket] = useState(false);
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
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const orderId = searchParams.get("order") ?? "";
    const timer = window.setTimeout(() => {
      setNewSubject(orderId ? `Ajutor pentru comanda ${orderId}` : "");
      setNewCategory(orderId ? "delivery_tracking" : "general");
      setNewTicketOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);
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

  async function createTicket() {
    if (creatingTicket || newSubject.trim().length < 3 || newMessage.trim().length < 10) return;
    setCreatingTicket(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim(),
          category: newCategory,
          message: newMessage.trim(),
          orderId: searchParams.get("order") ?? undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "ticket_creation_failed");
      if (newFiles.length && payload.messageId) {
        await uploadMessageFiles({ scope: "support", parentId: payload.messageId, files: newFiles });
      }
      setNewTicketOpen(false);
      setNewSubject("");
      setNewMessage("");
      setNewFiles([]);
      await load();
      await select(payload.conversationId);
    } catch {
      setFeedback("Tichetul nu a putut fi creat. Verifică datele și reîncearcă.");
    } finally {
      setCreatingTicket(false);
    }
  }

  return (
    <section className="app-container grid gap-5 py-6 expanded-ui:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="rounded-[var(--ui-radius-panel)] border bg-card p-3">
        <div className="flex items-center justify-between gap-3 px-2">
          <h1 className="font-heading text-2xl">Suport SkySend</h1>
          <Button type="button" size="icon" variant="outline" aria-label="Creează tichet de suport" onClick={() => setNewTicketOpen(true)}>
            <Plus className="size-4" />
          </Button>
        </div>
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
      {newTicketOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-background/75 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="new-support-ticket-title">
          <div className="w-full max-w-xl rounded-[var(--ui-radius-panel)] border border-border bg-background p-5 shadow-[var(--elevation-panel)]">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm text-primary">Suport direct</p><h2 id="new-support-ticket-title" className="mt-1 font-heading text-2xl">Tichet nou</h2></div>
              <Button type="button" size="icon" variant="ghost" aria-label="Închide" onClick={() => setNewTicketOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm"><span>Subiect</span><input value={newSubject} onChange={(event) => setNewSubject(event.target.value)} maxLength={160} className="h-11 rounded-xl border bg-background px-3" /></label>
              <label className="grid gap-2 text-sm"><span>Categorie</span><select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className="h-11 rounded-xl border bg-background px-3">
                <option value="general">General</option><option value="delivery_tracking">Livrare și tracking</option><option value="billing">Plată</option><option value="parcel_data">Colet</option><option value="account">Cont</option><option value="technical">Problemă tehnică</option>
              </select></label>
              <label className="grid gap-2 text-sm"><span>Mesaj</span><textarea value={newMessage} onChange={(event) => setNewMessage(event.target.value)} maxLength={5000} rows={6} className="rounded-xl border bg-background p-3" /></label>
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><ImagePlus className="size-4" />{newFiles.length ? `${newFiles.length} imagini selectate` : "Adaugă maximum 2 imagini"}<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => setNewFiles(Array.from(event.target.files ?? []).slice(0, 2))} /></label>
              <Button type="button" className="h-11" onClick={() => void createTicket()} disabled={creatingTicket || newSubject.trim().length < 3 || newMessage.trim().length < 10}>{creatingTicket ? <LoaderCircle className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}Trimite către suport</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
