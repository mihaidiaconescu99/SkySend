"use client";

import { useUser } from "@clerk/nextjs";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/shared/app-button";
import { cn } from "@/lib/utils";
import type { SavedBillingProfile } from "@/types/billing";

const empty = (name = "", email = "", locale: "ro" | "en" = "ro"): SavedBillingProfile => ({
  customerType: "individual", fullName: name, companyLegalName: "", taxIdentifier: "",
  addressLine: "", city: "", region: "", countryCode: "RO", postalCode: "",
  invoiceEmail: email, locale,
});

function Input({ label, value, onChange, ...props }: {
  label: string; value: string; onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-xl border border-input bg-background px-3 outline-none focus:ring-4 focus:ring-ring" /></label>;
}

export function AccountBillingProfile() {
  const { user } = useUser();
  const pageLocale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ro";
  const [billing, setBilling] = useState<SavedBillingProfile>(() => empty());
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/profile/billing-details", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (body.billing) {
        setBilling({ ...body.billing, locale: pageLocale });
        setExists(true);
      } else {
        setBilling(empty(user?.fullName ?? "", user?.primaryEmailAddress?.emailAddress ?? "", pageLocale));
      }
    });
  }, [pageLocale, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  const update = <K extends keyof SavedBillingProfile>(key: K, value: SavedBillingProfile[K]) => setBilling((current) => ({ ...current, [key]: value }));

  async function save() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/profile/billing-details", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(billing) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "Datele nu au putut fi salvate."); return; }
    setBilling(body.billing); setExists(true); setMessage("Datele de facturare au fost salvate.");
  }

  async function remove() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/profile/billing-details", { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { setMessage("Datele nu au putut fi șterse."); return; }
    setExists(false); setBilling(empty(user?.fullName ?? "", user?.primaryEmailAddress?.emailAddress ?? "", pageLocale)); setMessage("Datele de facturare au fost șterse.");
  }

  return (
    <div className="border-t border-border/70 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="type-caption">Facturare</p><h3 className="mt-2 font-heading text-xl tracking-tight">Date de facturare</h3><p className="mt-2 text-sm text-muted-foreground">Un singur set, folosit pentru precompletarea comenzilor viitoare.</p></div>
        {exists ? <AppButton type="button" size="sm" variant="ghost" onClick={remove} disabled={busy}><Trash2 className="size-4" />Șterge</AppButton> : null}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/40 p-1 sm:col-span-2">
          {(["individual", "company"] as const).map((type) => <button key={type} type="button" onClick={() => update("customerType", type)} className={cn("min-h-10 rounded-lg text-sm", billing.customerType === type && "bg-background font-medium shadow-sm")}>{type === "individual" ? "Persoană fizică" : "Persoană juridică"}</button>)}
        </div>
        {billing.customerType === "individual" ? <Input label="Nume complet" value={billing.fullName ?? ""} onChange={(value) => update("fullName", value)} /> : <><Input label="Denumire legală" value={billing.companyLegalName ?? ""} onChange={(value) => update("companyLegalName", value)} /><Input label="Cod fiscal" value={billing.taxIdentifier ?? ""} onChange={(value) => update("taxIdentifier", value)} /></>}
        <div className="sm:col-span-2"><Input label="Adresă / sediu" value={billing.addressLine} onChange={(value) => update("addressLine", value)} /></div>
        <Input label="Localitate" value={billing.city} onChange={(value) => update("city", value)} />
        <Input label="Județ / regiune" value={billing.region} onChange={(value) => update("region", value)} />
        <Input label="Țară (cod ISO)" value={billing.countryCode} maxLength={2} onChange={(value) => update("countryCode", value.toUpperCase())} />
        <Input label="Cod poștal" value={billing.postalCode ?? ""} onChange={(value) => update("postalCode", value)} />
        <div className="sm:col-span-2"><Input label="Email factură" type="email" value={billing.invoiceEmail} onChange={(value) => update("invoiceEmail", value)} /></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><AppButton type="button" onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{exists ? "Actualizează datele" : "Salvează datele"}</AppButton>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}</div>
    </div>
  );
}
