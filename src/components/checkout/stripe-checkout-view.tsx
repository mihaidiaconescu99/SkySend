"use client";

import { useUser } from "@clerk/nextjs";
import type { Stripe, StripeElements, StripePaymentElement } from "@stripe/stripe-js";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { AppButton } from "@/components/shared/app-button";
import { BillingCustomerTypeSelector } from "@/components/billing/billing-customer-type-selector";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStripeJs } from "@/lib/stripe/client";
import { skySendStripeElementsAppearance } from "@/lib/stripe/elements";
import { useSettings } from "@/lib/settings/settings-context";
import { cn } from "@/lib/utils";
import type { BillingSnapshotInput } from "@/types/billing";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { OperationalStatusSnapshot } from "@/types/operational-status";
import type { ClientStripePaymentMethod } from "@/types/payment-methods";

type StripeCheckoutViewProps = { orderId: string };
type PaymentIntentResponse = {
  clientSecret?: string;
  paymentIntentId?: string;
  savedPaymentMethods?: ClientStripePaymentMethod[];
  status?: string;
  error?: string;
};

const emptyBilling: BillingSnapshotInput = {
  customerType: "individual",
  fullName: "",
  companyLegalName: "",
  taxIdentifier: "",
  addressLine: "",
  city: "",
  region: "",
  countryCode: "RO",
  postalCode: "",
  invoiceEmail: "",
  locale: "ro",
  privacyAccepted: false,
};

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
  inputMode,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  inputMode?: "text" | "email" | "numeric";
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
        inputMode={inputMode}
        className="min-h-11 rounded-[var(--radius)] border border-input bg-background px-3 text-foreground outline-none focus:ring-4 focus:ring-ring"
      />
    </label>
  );
}

export function StripeCheckoutView({ orderId }: StripeCheckoutViewProps) {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatCurrency } = useSettings();
  const elementContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const [order, setOrder] = useState<CreatedDeliveryOrder | null>(null);
  const [operational, setOperational] = useState<OperationalStatusSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [billing, setBilling] = useState<BillingSnapshotInput>(emptyBilling);
  const [billingSaved, setBillingSaved] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<ClientStripePaymentMethod[]>([]);
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"saved" | "new">("new");
  const [elementReady, setElementReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locale = billing.locale;
  const totalMinor = order?.payload.pricingSnapshot?.total?.amountMinor
    ?? order?.payload.estimatedPrice.amountMinor
    ?? 0;

  const loadOrder = useCallback(async () => {
    const response = await fetch(`/api/orders/client-order?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    });
    return response.ok ? responseJson<CreatedDeliveryOrder>(response) : null;
  }, [orderId]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadOrder(),
      fetch("/api/operational-status", { cache: "no-store" }).then((response) =>
        responseJson<OperationalStatusSnapshot>(response),
      ),
    ]).then(([storedOrder, status]) => {
      if (!active) return;
      setOrder(storedOrder);
      setOperational(status);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [loadOrder]);

  const waitForWebhook = useCallback(async () => {
    setMessage(locale === "ro" ? "Stripe a confirmat plata. Așteptăm confirmarea securizată a serverului…" : "Stripe confirmed the payment. Waiting for the secure server confirmation…");
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const refreshed = await loadOrder();
      if (refreshed?.paymentStatus === "paid") {
        router.replace(refreshed.href);
        return;
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1_000));
    }
    setMessage(locale === "ro" ? "Plata este încă în curs de verificare. Poți reveni în pagina comenzii; statusul se actualizează automat." : "The payment is still being verified. You can return to the order page; its status updates automatically.");
  }, [loadOrder, locale, router]);

  useEffect(() => {
    if (!searchParams.get("payment_intent_client_secret") || !order) return;
    const timeout = window.setTimeout(() => void waitForWebhook(), 0);
    // The server-side Stripe webhook is the only payment authority.
    return () => window.clearTimeout(timeout);
  }, [order, searchParams, waitForWebhook]);

  useEffect(() => {
    if (!clientSecret || paymentMode !== "new" || !elementContainerRef.current) return;
    let active = true;
    setElementReady(false);
    void getStripeJs().then((stripe) => {
      if (!active || !stripe || !elementContainerRef.current) return;
      const elements = stripe.elements({ clientSecret, appearance: skySendStripeElementsAppearance });
      const paymentElement = elements.create("payment", { layout: "tabs" });
      paymentElement.on("ready", () => active && setElementReady(true));
      stripeRef.current = stripe;
      elementsRef.current = elements;
      paymentElementRef.current = paymentElement;
      paymentElement.mount(elementContainerRef.current);
    });
    return () => {
      active = false;
      paymentElementRef.current?.destroy();
      paymentElementRef.current = null;
      stripeRef.current = null;
      elementsRef.current = null;
    };
  }, [clientSecret, paymentMode]);

  const updateBilling = <K extends keyof BillingSnapshotInput>(key: K, value: BillingSnapshotInput[K]) => {
    setBilling((current) => ({ ...current, [key]: value }));
  };

  const continueToPayment = async (event: FormEvent) => {
    event.preventDefault();
    if (!order || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const snapshotResponse = await fetch("/api/billing/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          billing: {
            ...billing,
            fullName: billing.fullName || user?.fullName || "",
            invoiceEmail: billing.invoiceEmail || user?.primaryEmailAddress?.emailAddress || "",
            locale: document.documentElement.lang === "en" ? "en" : "ro",
          },
        }),
      });
      const snapshot = await responseJson<{ error?: string }>(snapshotResponse);
      if (!snapshotResponse.ok) throw new Error(snapshot.error ?? "billing_validation_failed");
      const paymentResponse = await fetch("/api/stripe/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, savePaymentMethod: true }),
      });
      const payment = await responseJson<PaymentIntentResponse>(paymentResponse);
      if (!paymentResponse.ok || !payment.clientSecret || !payment.paymentIntentId) {
        throw new Error(payment.error ?? "payment_preparation_failed");
      }
      const methods = payment.savedPaymentMethods ?? [];
      const preferred = methods.find((method) => method.isDefault) ?? methods[0];
      setClientSecret(payment.clientSecret);
      setPaymentIntentId(payment.paymentIntentId);
      setSavedMethods(methods);
      setSelectedSavedMethod(preferred?.id ?? null);
      setPaymentMode(preferred ? "saved" : "new");
      setBillingSaved(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "checkout_failed");
    } finally {
      setBusy(false);
    }
  };

  const payNew = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || !order || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/client/checkout/${order.id}?payment=return` },
      redirect: "if_required",
    });
    if (result.error) setMessage(result.error.message ?? "payment_failed");
    else await waitForWebhook();
    setBusy(false);
  };

  const paySaved = async () => {
    if (!order || !selectedSavedMethod || !paymentIntentId || busy) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/stripe/pay-saved-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, paymentIntentId, paymentMethodId: selectedSavedMethod }),
    });
    const result = await responseJson<PaymentIntentResponse>(response);
    if (!response.ok) {
      setMessage(result.error ?? "payment_failed");
    } else if (result.status === "requires_action" && result.clientSecret) {
      const stripe = await getStripeJs();
      const action = stripe ? await stripe.handleNextAction({ clientSecret: result.clientSecret }) : null;
      if (action?.error) setMessage(action.error.message ?? "authentication_failed");
      else await waitForWebhook();
    } else {
      await waitForWebhook();
    }
    setBusy(false);
  };

  if (!loaded) {
    return <section className="app-container"><PageHeader eyebrow="Checkout" title="Se pregătește checkout-ul" description="Încărcăm comanda și disponibilitatea operațională." /></section>;
  }
  if (!order) {
    return <section className="app-container"><PageHeader eyebrow="Checkout" title="Comandă indisponibilă" description="Sesiunea comenzii nu mai este disponibilă." /></section>;
  }
  if (operational?.effectiveStatus !== "active") {
    return (
      <section className="app-container flex min-h-[70vh] items-center justify-center">
        <div className="max-w-2xl rounded-[calc(var(--radius)+1rem)] border border-border bg-card p-8 text-center shadow-[var(--elevation-card)]">
          <StatusBadge label={operational?.effectiveStatus === "maintenance" ? "Mentenanță" : "Meteo"} tone="warning" />
          <h1 className="mt-5 font-heading text-4xl tracking-tight">Operațiuni suspendate temporar</h1>
          <p className="mt-4 text-muted-foreground">Comanda rămâne salvată. Plata poate continua imediat ce platforma revine la starea Active.</p>
          <AppButton asChild variant="outline" className="mt-6"><Link href={order.href}>Înapoi la comandă</Link></AppButton>
        </div>
      </section>
    );
  }

  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Checkout"
        title="Facturare și plată securizată"
        description="Confirmă datele de facturare înainte ca formularul Stripe să fie creat."
        actions={[{ label: "Înapoi la comandă", href: order.href, variant: "ghost", icon: <ArrowLeft className="size-4" /> }]}
      />
      {operational.weather.level === "warning" ? (
        <div className="rounded-[var(--radius)] border border-amber-400/40 bg-amber-500/10 p-4 text-sm">Condițiile meteo pot produce întârzieri. Plata și comanda rămân disponibile.</div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.65fr)]">
        <SectionCard eyebrow="Comandă" title={order.id} description="Prețul este calculat și verificat pe server.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius)] border p-4"><p className="text-sm text-muted-foreground">Ridicare</p><p className="mt-2 font-medium">{order.payload.pickupAddress.formattedAddress}</p></div>
            <div className="rounded-[var(--radius)] border p-4"><p className="text-sm text-muted-foreground">Livrare</p><p className="mt-2 font-medium">{order.payload.dropoffAddress.formattedAddress}</p></div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[var(--radius)] bg-secondary/45 p-4"><span>Total</span><strong className="font-heading text-2xl">{formatCurrency(totalMinor)}</strong></div>
        </SectionCard>

        <Card className="h-fit rounded-[calc(var(--radius)+0.75rem)] shadow-[var(--elevation-card)]">
          <CardContent className="grid gap-5 p-5 sm:p-6">
            {!billingSaved ? (
              <form className="grid gap-4" onSubmit={continueToPayment}>
                <div><StatusBadge label="Pasul 1 din 2" tone="info" /><h2 className="mt-3 font-heading text-2xl">Date de facturare</h2></div>
                <BillingCustomerTypeSelector
                  value={billing.customerType}
                  onValueChange={(type) => updateBilling("customerType", type)}
                  layoutId="stripe-checkout-customer-type"
                  className="rounded-[var(--radius)]"
                />
                {billing.customerType === "individual" ? (
                  <Field label="Nume complet" name="fullName" value={billing.fullName || user?.fullName || ""} onChange={(value) => updateBilling("fullName", value)} autoComplete="name" />
                ) : (
                  <><Field label="Denumire legală" name="companyLegalName" value={billing.companyLegalName ?? ""} onChange={(value) => updateBilling("companyLegalName", value)} autoComplete="organization" /><Field label="Cod fiscal" name="taxIdentifier" value={billing.taxIdentifier ?? ""} onChange={(value) => updateBilling("taxIdentifier", value)} /></>
                )}
                <Field label="Adresă / sediu" name="addressLine" value={billing.addressLine} onChange={(value) => updateBilling("addressLine", value)} autoComplete="street-address" />
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Localitate" name="city" value={billing.city} onChange={(value) => updateBilling("city", value)} autoComplete="address-level2" /><Field label="Județ / regiune" name="region" value={billing.region} onChange={(value) => updateBilling("region", value)} autoComplete="address-level1" /></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Țară (cod ISO)" name="countryCode" value={billing.countryCode} onChange={(value) => updateBilling("countryCode", value.toUpperCase())} autoComplete="country" /><Field label="Cod poștal" name="postalCode" value={billing.postalCode ?? ""} onChange={(value) => updateBilling("postalCode", value)} autoComplete="postal-code" inputMode={billing.countryCode === "RO" ? "numeric" : "text"} /></div>
                <Field label="Email factură" name="invoiceEmail" value={billing.invoiceEmail || user?.primaryEmailAddress?.emailAddress || ""} onChange={(value) => updateBilling("invoiceEmail", value)} type="email" inputMode="email" autoComplete="email" />
                <label className="flex items-start gap-3 rounded-[var(--radius)] border p-4 text-sm leading-6"><input className="mt-1 size-4" type="checkbox" checked={billing.privacyAccepted} onChange={(event) => updateBilling("privacyAccepted", event.target.checked)} required /><span>{locale === "en" ? "I accept the processing of my billing data to generate the PDF invoice." : "Accept procesarea datelor de facturare pentru generarea facturii PDF."}</span></label>
                <AppButton type="submit" size="lg" disabled={busy} className="w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Continuă la plata securizată</AppButton>
              </form>
            ) : (
              <div className="grid gap-4">
                <div><StatusBadge label="Pasul 2 din 2" tone="success" /><h2 className="mt-3 font-heading text-2xl">Plată Stripe</h2><p className="mt-2 text-sm text-muted-foreground">Datele cardului sunt procesate de Stripe.</p></div>
                {savedMethods.length ? (
                  <div className="grid gap-2"><div className="grid grid-cols-2 gap-2 rounded-[var(--radius)] bg-secondary/45 p-1"><button type="button" onClick={() => setPaymentMode("saved")} className={cn("min-h-11 rounded-[var(--radius)]", paymentMode === "saved" && "bg-background shadow-sm")}>Salvată</button><button type="button" onClick={() => setPaymentMode("new")} className={cn("min-h-11 rounded-[var(--radius)]", paymentMode === "new" && "bg-background shadow-sm")}>Card nou</button></div>{paymentMode === "saved" ? savedMethods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedSavedMethod(method.id)} className={cn("rounded-[var(--radius)] border p-4 text-left", selectedSavedMethod === method.id && "ring-4 ring-ring")}><CreditCard className="mr-2 inline size-4" />{method.label} · {method.expiryLabel}</button>) : null}</div>
                ) : null}
                {paymentMode === "new" ? <><div ref={elementContainerRef} className={cn("min-h-40 rounded-[var(--radius)] border bg-background p-4", !elementReady && "opacity-60")} /><AppButton type="button" size="lg" onClick={payNew} disabled={!elementReady || busy} className="w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Plătește securizat</AppButton></> : <AppButton type="button" size="lg" onClick={paySaved} disabled={!selectedSavedMethod || busy} className="w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}Plătește cu metoda salvată</AppButton>}
                <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setBillingSaved(false)}>Modifică datele de facturare</button>
              </div>
            )}
            {message ? <div role="status" className="rounded-[var(--radius)] border bg-secondary/45 p-4 text-sm">{message}</div> : null}
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4" />Doar webhook-ul Stripe poate confirma plata.</div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
