"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, KeyRound, RefreshCw, Search, ShieldCheck, UserCog, UserMinus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminAccessRequestRecord, StaffUserLookup } from "@/types/staff-access";

type MfaState = { enrolled: boolean; lockedUntil: string | null };
type Enrollment = { secret: string; qrDataUrl: string; uri: string };

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Operația a eșuat.");
  return body;
}

export function StaffAccessAdminView() {
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [confirmCode, setConfirmCode] = useState("");
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<StaffUserLookup | null>(null);
  const [requests, setRequests] = useState<AdminAccessRequestRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "requests">("users");
  const [role, setRole] = useState<"operator" | "admin">("operator");
  const [accessKind, setAccessKind] = useState<"permanent" | "temporary">("permanent");
  const [durationMinutes, setDurationMinutes] = useState(1440);
  const [reason, setReason] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, { note: string; code: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [meBody, requestsBody] = await Promise.all([
      fetch("/api/access/me", { cache: "no-store" }).then(readJson),
      fetch("/api/admin/access/requests", { cache: "no-store" }).then(readJson),
    ]);
    setMfa(meBody.mfa as MfaState);
    setRequests(requestsBody.requests as AdminAccessRequestRecord[]);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/access/me", { cache: "no-store" }).then(readJson),
      fetch("/api/admin/access/requests", { cache: "no-store" }).then(readJson),
    ]).then(([meBody, requestsBody]) => {
      if (!active) return;
      setMfa(meBody.mfa as MfaState);
      setRequests(requestsBody.requests as AdminAccessRequestRecord[]);
    }).catch((error) => {
      if (active) setMessage({ tone: "error", text: error instanceof Error ? error.message : "Datele nu au putut fi încărcate." });
    });
    return () => { active = false; };
  }, []);

  const pendingCount = requests.filter((item) => item.status === "pending").length;

  async function startEnrollment() {
    setBusy(true); setMessage(null);
    try {
      const body = await fetch("/api/admin/access/mfa/enroll", { method: "POST" }).then(readJson);
      setEnrollment(body.enrollment as Enrollment);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "MFA nu a putut fi inițiat." });
    } finally { setBusy(false); }
  }

  async function confirmEnrollment() {
    setBusy(true); setMessage(null);
    try {
      const body = await fetch("/api/admin/access/mfa/enroll", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: confirmCode }),
      }).then(readJson);
      setRecoveryCodes(body.recoveryCodes as string[]);
      setMfa({ enrolled: true, lockedUntil: null });
      setEnrollment(null); setConfirmCode("");
      setMessage({ tone: "ok", text: "Authenticator a fost activat. Salvează codurile de recuperare." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Cod invalid." });
    } finally { setBusy(false); }
  }

  async function searchUser(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setUser(null);
    try {
      const body = await fetch(`/api/admin/access/users?email=${encodeURIComponent(email)}`, { cache: "no-store" }).then(readJson);
      const found = body.user as StaffUserLookup;
      setUser(found); setConfirmationEmail(""); setRole(found.role === "admin" ? "admin" : "operator");
      setAccessKind(found.accessKind ?? "permanent");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Cont inexistent." });
    } finally { setBusy(false); }
  }

  async function mutate(action: "assign" | "revoke" | "reset_mfa") {
    if (!user) return;
    setBusy(true); setMessage(null);
    try {
      const payload = action === "assign"
        ? { action, targetEmail: user.email, confirmationEmail, role, accessKind: role === "operator" ? "permanent" : accessKind, durationMinutes, reason, code: mfaCode }
        : action === "revoke"
          ? { action, targetEmail: user.email, confirmationEmail, reason, code: mfaCode }
          : { action, targetEmail: user.email, reason, code: mfaCode };
      await fetch("/api/admin/access/assignments", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }).then(readJson);
      setMessage({ tone: "ok", text: action === "assign" ? "Rolul a fost actualizat; sesiunile utilizatorului au fost revocate." : action === "revoke" ? "Accesul intern a fost eliminat." : "MFA a fost resetat." });
      setMfaCode(""); setReason(""); setConfirmationEmail("");
      const refreshed = await fetch(`/api/admin/access/users?email=${encodeURIComponent(user.email)}`, { cache: "no-store" }).then(readJson);
      setUser(refreshed.user as StaffUserLookup);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Operația a eșuat." });
    } finally { setBusy(false); }
  }

  async function decide(requestId: string, decision: "approve" | "reject") {
    const draft = decisionDrafts[requestId] ?? { note: "", code: "" };
    setBusy(true); setMessage(null);
    try {
      await fetch(`/api/admin/access/requests/${requestId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, ...draft }),
      }).then(readJson);
      setMessage({ tone: "ok", text: decision === "approve" ? "Cererea a fost aprobată." : "Cererea a fost respinsă." });
      await load();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Decizia nu a putut fi salvată." });
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6">
      <AdminPageHeader eyebrow="Securitate" title="Acces și roluri" description="Caută exact un cont, acordă acces intern și procesează cererile Operatorilor. Fiecare mutație este confirmată prin Authenticator și auditată." />

      {message ? <div className={`rounded-2xl border p-4 text-sm ${message.tone === "ok" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{message.text}</div> : null}

      {!mfa?.enrolled ? (
        <Card className="border-warning/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-5 text-warning" />Activează Authenticator</CardTitle><CardDescription>Pagina poate fi consultată, dar nicio modificare de rol nu este permisă până când administratorul permanent configurează TOTP.</CardDescription></CardHeader>
          <CardContent className="grid gap-5">
            {!enrollment ? <Button onClick={startEnrollment} disabled={busy} className="w-fit">Generează cheia TOTP</Button> : (
              <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-2xl bg-white p-3"><Image src={enrollment.qrDataUrl} alt="Cod QR pentru Authenticator" width={260} height={260} unoptimized /></div>
                <div className="grid content-start gap-4">
                  <p className="text-sm text-muted-foreground">Scanează codul cu Google sau Microsoft Authenticator. Dacă scanarea nu funcționează, introdu manual cheia:</p>
                  <code className="break-all rounded-xl border border-border bg-muted p-3 text-xs">{enrollment.secret}</code>
                  <Input inputMode="numeric" maxLength={6} value={confirmCode} onChange={(event) => setConfirmCode(event.target.value)} placeholder="Codul de 6 cifre" />
                  <Button onClick={confirmEnrollment} disabled={busy || confirmCode.length !== 6} className="w-fit"><Check className="size-4" />Confirmă Authenticator</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {recoveryCodes.length ? (
        <Card className="border-warning/35"><CardHeader><CardTitle>Coduri de recuperare — afișate o singură dată</CardTitle><CardDescription>Salvează-le într-un manager de parole. Fiecare cod poate fi folosit o singură dată.</CardDescription></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-2">{recoveryCodes.map((code) => <code key={code} className="rounded-xl border border-border bg-muted px-3 py-2 text-xs">{code}</code>)}</div></CardContent></Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant={activeTab === "users" ? "default" : "outline"} onClick={() => setActiveTab("users")}><UserCog className="size-4" />Conturi</Button>
        <Button variant={activeTab === "requests" ? "default" : "outline"} onClick={() => setActiveTab("requests")}><Clock3 className="size-4" />Cereri {pendingCount ? <Badge variant="warning">{pendingCount}</Badge> : null}</Button>
        <Button variant="ghost" onClick={() => void load()} disabled={busy}><RefreshCw className="size-4" />Reîncarcă</Button>
      </div>

      {activeTab === "users" ? (
        <div className="grid gap-6">
          <Card><CardHeader><CardTitle>Caută un cont</CardTitle><CardDescription>Căutarea folosește numai emailul exact și verificat din Clerk. Nu sunt create invitații automate.</CardDescription></CardHeader><CardContent><form onSubmit={searchUser} className="flex flex-col gap-3 sm:flex-row"><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="utilizator@exemplu.ro" /><Button type="submit" disabled={busy}><Search className="size-4" />Verifică</Button></form></CardContent></Card>
          {user ? (
            <Card>
              <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{user.fullName || user.email}</CardTitle><CardDescription>{user.email}</CardDescription></div><div className="flex gap-2"><Badge variant={user.emailVerified ? "success" : "destructive"}>{user.emailVerified ? "Email verificat" : "Neverificat"}</Badge><Badge variant="secondary">{user.role}</Badge></div></div></CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-4 rounded-2xl border border-border bg-secondary/25 p-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Rol curent</p><p className="mt-1 font-medium">{user.role}</p></div><div><p className="text-xs text-muted-foreground">Tip acces</p><p className="mt-1 font-medium">{user.accessKind ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">Expiră</p><p className="mt-1 font-medium">{user.expiresAt ? new Date(user.expiresAt).toLocaleString("ro-RO") : "Nu expiră"}</p></div></div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2 text-sm">Rol<select value={role} onChange={(event) => { const next = event.target.value as "operator" | "admin"; setRole(next); if (next === "operator") setAccessKind("permanent"); }} className="h-12 rounded-2xl border border-input bg-muted px-4"><option value="operator">Operator</option><option value="admin">Admin</option></select></label>
                  <label className="grid gap-2 text-sm">Tip acces<select disabled={role === "operator"} value={accessKind} onChange={(event) => setAccessKind(event.target.value as "permanent" | "temporary")} className="h-12 rounded-2xl border border-input bg-muted px-4"><option value="permanent">Permanent</option><option value="temporary">Temporar</option></select></label>
                  {role === "admin" && accessKind === "temporary" ? <label className="grid gap-2 text-sm">Durată<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="h-12 rounded-2xl border border-input bg-muted px-4"><option value={60}>1 oră</option><option value={240}>4 ore</option><option value={1440}>1 zi</option><option value={10080}>7 zile</option></select></label> : null}
                </div>
                <label className="grid gap-2 text-sm">Motiv<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={4} className="rounded-2xl border border-input bg-muted p-4 outline-none focus:border-primary" placeholder="De ce este necesară schimbarea?" /></label>
                <div className="grid gap-4 lg:grid-cols-2"><label className="grid gap-2 text-sm">Confirmă emailul țintă<Input type="email" value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} placeholder={user.email} /></label><label className="grid gap-2 text-sm">Cod Authenticator sau recuperare<Input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} autoComplete="one-time-code" placeholder="000000 sau SKY-..." /></label></div>
                <div className="flex flex-wrap gap-3"><Button onClick={() => void mutate("assign")} disabled={busy || !mfa?.enrolled || reason.trim().length < 3 || confirmationEmail.toLowerCase() !== user.email.toLowerCase() || mfaCode.length < 6}><ShieldCheck className="size-4" />Salvează rolul</Button><Button variant="destructive" onClick={() => void mutate("revoke")} disabled={busy || !mfa?.enrolled || reason.trim().length < 3 || confirmationEmail.toLowerCase() !== user.email.toLowerCase() || mfaCode.length < 6}><UserMinus className="size-4" />Elimină accesul</Button>{user.role === "admin" ? <Button variant="outline" onClick={() => void mutate("reset_mfa")} disabled={busy || reason.trim().length < 3 || mfaCode.length < 6}><KeyRound className="size-4" />Resetează MFA</Button> : null}</div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.length ? requests.map((item) => {
            const draft = decisionDrafts[item.id] ?? { note: "", code: "" };
            return <Card key={item.id} size="sm"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.requesterName || item.requesterEmail}</CardTitle><CardDescription>{item.requesterEmail} · {item.requestedDurationMinutes === 60 ? "1 oră" : item.requestedDurationMinutes === 240 ? "4 ore" : item.requestedDurationMinutes === 1440 ? "1 zi" : "7 zile"}</CardDescription></div><Badge variant={item.status === "pending" ? "warning" : item.status === "approved" ? "success" : "outline"}>{item.status}</Badge></div></CardHeader><CardContent className="grid gap-4"><p className="rounded-2xl border border-border bg-secondary/30 p-4 leading-6">{item.reason}</p>{item.status === "pending" ? <><div className="grid gap-3 lg:grid-cols-2"><Input value={draft.note} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [item.id]: { ...draft, note: event.target.value } }))} placeholder="Notă obligatorie pentru decizie" /><Input value={draft.code} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [item.id]: { ...draft, code: event.target.value } }))} placeholder="Cod Authenticator" /></div><div className="flex gap-3"><Button onClick={() => void decide(item.id, "approve")} disabled={busy || draft.note.trim().length < 3 || draft.code.length < 6}>Aprobă</Button><Button variant="outline" onClick={() => void decide(item.id, "reject")} disabled={busy || draft.note.trim().length < 3 || draft.code.length < 6}>Respinge</Button></div></> : item.reviewNote ? <p className="text-sm text-muted-foreground">Decizie: {item.reviewNote}</p> : null}</CardContent></Card>;
          }) : <Card><CardContent className="py-10 text-center text-muted-foreground">Nu există cereri de acces.</CardContent></Card>}
        </div>
      )}
    </div>
  );
}
