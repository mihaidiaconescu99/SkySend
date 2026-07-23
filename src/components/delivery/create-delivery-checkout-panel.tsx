"use client";

import { useUser } from "@clerk/nextjs";
import type { Stripe, StripeElements, StripePaymentElement } from "@stripe/stripe-js";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CreditCard,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppButton } from "@/components/shared/app-button";
import { getStripeJs } from "@/lib/stripe/client";
import { skySendStripeElementsAppearance } from "@/lib/stripe/elements";
import { cn } from "@/lib/utils";
import { generatePublicTrackingCode, generateRecipientTrackingToken } from "@/lib/recipient-tracking";
import type {
  BillingSnapshotInput,
  CheckoutSubstep,
  DeliveryCheckoutSession,
  SavedBillingProfile,
} from "@/types/billing";
import type { CreateDeliveryPayload } from "@/types/create-delivery";
import type { ClientStripePaymentMethod } from "@/types/payment-methods";
import type { SkySendPricingResult } from "@/types/pricing";

type Props = {
  payload: CreateDeliveryPayload;
  pricing: SkySendPricingResult;
  localOrderId: string;
  deliveryDraftId: string | null;
  onPaid: (orderId: string) => void | Promise<void>;
  onBackToEdit: () => void | Promise<void>;
};

type PaymentResponse = {
  clientSecret?: string;
  paymentIntentId?: string;
  savedPaymentMethods?: ClientStripePaymentMethod[];
  selectedPaymentMethodId?: string | null;
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

function money(amountMinor: number, currency = "RON") {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency }).format(amountMinor / 100);
}

function Field({ label, name, value, onChange, ...props }: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "name">) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      {label}
      <input
        {...props}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-xl border border-input bg-background px-4 text-foreground outline-none transition focus:border-primary/55 focus:ring-4 focus:ring-ring"
      />
    </label>
  );
}

function billingFromSaved(saved: SavedBillingProfile | null, userName: string, email: string, locale: "ro" | "en") {
  return saved
    ? { ...saved, locale, privacyAccepted: false }
    : { ...emptyBilling, fullName: userName, invoiceEmail: email, locale };
}

export function CreateDeliveryCheckoutPanel({
  payload,
  pricing,
  localOrderId,
  deliveryDraftId,
  onPaid,
  onBackToEdit,
}: Props) {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const elementContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const pollingSessionRef = useRef<string | null>(null);
  const paidNavigationRef = useRef<string | null>(null);
  const [session, setSession] = useState<DeliveryCheckoutSession | null>(null);
  const [step, setStep] = useState<CheckoutSubstep>("summary");
  const [billing, setBilling] = useState<BillingSnapshotInput>(emptyBilling);
  const [savedProfile, setSavedProfile] = useState<SavedBillingProfile | null>(null);
  const [saveBilling, setSaveBilling] = useState(true);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"saved" | "new">("new");
  const [saveCard, setSaveCard] = useState(false);
  const [savedMethods, setSavedMethods] = useState<ClientStripePaymentMethod[]>([]);
  const [selectedSavedMethod, setSelectedSavedMethod] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() =>
    searchParams.get("checkout") === "moved"
      ? "Plata este acum integrată direct în pasul Verificare și plată."
      : null,
  );
  const [hydrated, setHydrated] = useState(false);
  const totalMinor = session?.totalAmountMinor ?? pricing.total.amountMinor;
  const currency = session?.currency ?? pricing.currency;
  const userName = user?.fullName ?? "";
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const checkoutLocale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ro";

  const hydrateSession = useCallback((next: DeliveryCheckoutSession | null, saved?: SavedBillingProfile | null) => {
    setSession(next);
    const profile = next?.savedBillingProfile ?? saved ?? null;
    setSavedProfile(profile);
    setSaveBilling(!profile);
    if (next) {
      const nextStep = next.status === "expired" ? "summary" : next.currentStep;
      setStep(nextStep);
      setBilling(next.billing ?? billingFromSaved(profile, userName, userEmail, next.locale ?? checkoutLocale));
      setSelectedSavedMethod(next.selectedPaymentMethodId);
    } else {
      setBilling(billingFromSaved(profile, userName, userEmail, checkoutLocale));
    }
  }, [checkoutLocale, userEmail, userName]);

  useEffect(() => {
    const requestedSession = searchParams.get("checkout");
    const query = requestedSession && requestedSession !== "moved" ? `?sessionId=${encodeURIComponent(requestedSession)}` : "";
    void fetch(`/api/client/delivery-checkout${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.ok) {
          const restored = body.session as DeliveryCheckoutSession | null;
          const exactReturn = Boolean(requestedSession && requestedSession !== "moved");
          const sameDraft = !restored?.deliveryDraftId || !deliveryDraftId
            || restored.deliveryDraftId === deliveryDraftId;
          hydrateSession(exactReturn || sameDraft ? restored : null, body.savedBillingProfile ?? null);
        }
      })
      .finally(() => setHydrated(true));
  }, [deliveryDraftId, hydrateSession, searchParams]);

  const navigateToPaidOrder = useCallback(async (orderId: string) => {
    if (paidNavigationRef.current === orderId) return;
    paidNavigationRef.current = orderId;
    setBusy(true);
    try {
      await onPaid(orderId);
    } catch (error) {
      paidNavigationRef.current = null;
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Comanda este plătită. Deschide Livrare activă.");
    }
  }, [onPaid]);

  const waitForOrder = useCallback(async (sessionId: string) => {
    if (pollingSessionRef.current === sessionId) return;
    pollingSessionRef.current = sessionId;
    setMessage("Plata este confirmată. Finalizăm comanda securizat…");
    let attempt = 0;
    while (pollingSessionRef.current === sessionId) {
      try {
        const response = await fetch(`/api/client/delivery-checkout?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        const current = body.session as DeliveryCheckoutSession | null;
        if (current?.status === "finalized" && current.orderId) {
          pollingSessionRef.current = null;
          await navigateToPaidOrder(current.orderId);
          return;
        }
      } catch {
        // A transient network error must not interrupt post-capture finalization polling.
      }
      attempt += 1;
      if (attempt === 35) {
        setMessage("Plata este în curs de confirmare. Sesiunea continuă automat când serverul finalizează comanda.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, attempt < 35 ? 1000 : 5000));
    }
  }, [navigateToPaidOrder]);

  useEffect(() => () => {
    pollingSessionRef.current = null;
  }, []);

  useEffect(() => {
    if (
      !session?.id ||
      (searchParams.get("payment") !== "return" &&
        !["finalizing", "finalization_failed"].includes(session.status))
    ) return;
    const timeout = window.setTimeout(() => void waitForOrder(session.id), 0);
    return () => window.clearTimeout(timeout);
  }, [searchParams, session?.id, session?.status, waitForOrder]);

  useEffect(() => {
    if (session?.status !== "finalized" || !session.orderId) return;
    const timeout = window.setTimeout(
      () => void navigateToPaidOrder(session.orderId!),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [navigateToPaidOrder, session?.orderId, session?.status]);

  const preparePayment = useCallback(async (shouldSaveCard: boolean) => {
    if (!session) return null;
    const response = await fetch("/api/stripe/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkoutSessionId: session.id, savePaymentMethod: shouldSaveCard }),
    });
    const body = await response.json().catch(() => ({})) as PaymentResponse;
    if (response.ok && body.status === "succeeded" && body.paymentIntentId) {
      setPaymentIntentId(body.paymentIntentId);
      void waitForOrder(session.id);
      return body;
    }
    if (!response.ok || !body.clientSecret || !body.paymentIntentId) throw new Error(body.error ?? "payment_preparation_failed");
    setClientSecret(body.clientSecret);
    setPaymentIntentId(body.paymentIntentId);
    const methods = body.savedPaymentMethods ?? [];
    setSavedMethods(methods);
    const preferred = body.selectedPaymentMethodId
      ? methods.find((item) => item.id === body.selectedPaymentMethodId)
      : methods.find((item) => item.isDefault) ?? methods[0];
    setSelectedSavedMethod(preferred?.id ?? null);
    if (methods.length && !shouldSaveCard) {
      setPaymentMode((current) => current === "new" ? "saved" : current);
    }
    return body;
  }, [session, waitForOrder]);

  useEffect(() => {
    if (step !== "payment" || !session || session.status === "finalized" || clientSecret) return;
    const timeout = window.setTimeout(() => {
      setBusy(true);
      void preparePayment(false).catch((error) => setMessage(error instanceof Error ? error.message : "Plata nu a putut fi pregătită."))
        .finally(() => setBusy(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [clientSecret, preparePayment, session, step]);

  useEffect(() => {
    if (!clientSecret || paymentMode !== "new" || !elementContainerRef.current) return;
    let active = true;
    let mountedElement: StripePaymentElement | null = null;
    setElementReady(false);
    void getStripeJs().then((stripe) => {
      if (!active || !stripe || !elementContainerRef.current) return;
      const elements = stripe.elements({ clientSecret, appearance: skySendStripeElementsAppearance });
      const paymentElement = elements.create("payment", { layout: "tabs" });
      mountedElement = paymentElement;
      paymentElement.on("ready", () => active && setElementReady(true));
      paymentElement.on("loaderror", () => {
        if (active) setMessage("Formularul Stripe nu a putut fi încărcat. Reîncarcă pagina și încearcă din nou.");
      });
      paymentElement.mount(elementContainerRef.current);
      stripeRef.current = stripe;
      elementsRef.current = elements;
      paymentElementRef.current = paymentElement;
    });
    return () => {
      active = false;
      if (paymentElementRef.current === mountedElement) {
        paymentElementRef.current = null;
        elementsRef.current = null;
        stripeRef.current = null;
      }
      if (mountedElement) {
        try {
          mountedElement.destroy();
        } catch {
          // React Strict Mode can dispose an Element after Stripe already removed it.
        }
        mountedElement = null;
      }
    };
  }, [clientSecret, paymentMode]);

  async function createSession() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/client/delivery-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          localOrderId,
          publicTrackingCode: generatePublicTrackingCode(),
          recipientTrackingToken: generateRecipientTrackingToken(),
          deliveryDraftId,
          locale: document.documentElement.lang === "en" ? "en" : "ro",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "checkout_create_failed");
      hydrateSession(body.session);
      setStep("billing");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout-ul nu a putut fi pornit.");
    } finally {
      setBusy(false);
    }
  }

  async function patchSession(body: Record<string, unknown>) {
    if (!session) return null;
    const response = await fetch("/api/client/delivery-checkout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, ...body }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "checkout_update_failed");
    hydrateSession(result.session);
    return result.session as DeliveryCheckoutSession;
  }

  async function continueToPayment() {
    setBusy(true);
    setMessage(null);
    try {
      await patchSession({ action: "save_billing", billing, saveForFuture: saveBilling });
      setStep("payment");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verifică datele de facturare.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStep(next: CheckoutSubstep) {
    setMessage(null);
    if (session?.status === "finalized" && session.orderId) {
      await navigateToPaidOrder(session.orderId);
      return;
    }
    if (session && session.status !== "active" && session.status !== "payment_processing") {
      setMessage("Checkout-ul este blocat cât timp confirmăm plata.");
      return;
    }
    try {
      const updated = session
        ? await patchSession({ action: "set_step", step: next })
        : null;
      if (updated?.status === "finalized" && updated.orderId) {
        await navigateToPaidOrder(updated.orderId);
        return;
      }
      setStep(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pasul nu a putut fi schimbat.");
    }
  }

  async function editDelivery() {
    setBusy(true);
    try {
      if (session) await patchSession({ action: "cancel" });
      await onBackToEdit();
    } finally {
      setBusy(false);
    }
  }

  function chooseSavedMethod(paymentMethodId: string) {
    setSelectedSavedMethod(paymentMethodId);
    void patchSession({ action: "select_payment_method", paymentMethodId })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Metoda nu a putut fi salvată."));
  }

  async function paySaved() {
    if (!session || !paymentIntentId || !selectedSavedMethod) return;
    setBusy(true);
    setMessage(null);
    try {
      await patchSession({ action: "select_payment_method", paymentMethodId: selectedSavedMethod });
      const response = await fetch("/api/stripe/pay-saved-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId: session.id, paymentIntentId, paymentMethodId: selectedSavedMethod }),
      });
      const result = await response.json().catch(() => ({})) as PaymentResponse;
      if (!response.ok) throw new Error(result.error ?? "payment_failed");
      if (result.status === "requires_action" && result.clientSecret) {
        const stripe = await getStripeJs();
        const next = await stripe?.handleNextAction({ clientSecret: result.clientSecret });
        if (next?.error) throw new Error(next.error.message);
      }
      await waitForOrder(session.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Plata a fost refuzată. Poți încerca din nou.");
    } finally {
      setBusy(false);
    }
  }

  async function payNew() {
    if (!session || !elementsRef.current || !stripeRef.current) return;
    setBusy(true);
    setMessage(null);
    try {
      if (saveCard) await preparePayment(true);
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: { return_url: `${window.location.origin}/client/create-delivery?checkout=${session.id}&payment=return` },
        redirect: "if_required",
      });
      if (result.error) throw new Error(result.error.message ?? "payment_failed");
      await waitForOrder(session.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Plata a fost refuzată. Poți încerca din nou.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = step === "summary" ? 0 : step === "billing" ? 1 : 2;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" as const };
  const panelKey = `${step}-${session?.id ?? "draft"}`;
  const canSubmitBilling = useMemo(() => {
    if (!billing.privacyAccepted || !billing.addressLine.trim() || !billing.city.trim() || !billing.region.trim() || billing.countryCode.length !== 2 || !billing.invoiceEmail.includes("@")) return false;
    if (billing.countryCode === "RO" && !/^\d{6}$/u.test(billing.postalCode ?? "")) return false;
    return billing.customerType === "individual"
      ? Boolean(billing.fullName?.trim())
      : Boolean(billing.companyLegalName?.trim() && billing.taxIdentifier?.trim());
  }, [billing]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/70 px-5 pb-4 pt-5">
        <div className="grid grid-cols-3 gap-2" aria-label="Progres checkout">
          {["Sumar", "Facturare", "Plată"].map((label, index) => (
            <div key={label} className="grid gap-2">
              <span className={cn("h-1 rounded-full transition-colors", index <= stepIndex ? "bg-primary" : "bg-secondary")} />
              <span className={cn("text-[0.68rem] font-semibold uppercase tracking-[0.12em]", index === stepIndex ? "text-foreground" : "text-muted-foreground")}>{index + 1}. {label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-visible px-5 py-5 expanded-ui:overflow-y-auto">
        {!hydrated ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div> : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={panelKey} initial={reduceMotion ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -14 }} transition={transition}>
              {step === "summary" ? (
                <div className="grid gap-5">
                  <div>
                    <p className="type-caption">Verificare finală</p>
                    <h2 className="mt-2 font-heading text-2xl tracking-tight">Confirmă tariful</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Tariful este blocat 60 de minute după continuare.</p>
                  </div>
                  <div className="border-y border-border/70 py-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Interval estimat</span>
                      <span className="font-medium">{payload.estimatedEta.minMinutes}–{payload.estimatedEta.maxMinutes} min</span>
                    </div>
                  </div>
                  <div className="border-b border-border/70 pb-4">
                    <button type="button" onClick={() => setPricingOpen((value) => !value)} aria-expanded={pricingOpen} className="flex w-full items-center justify-between gap-3 py-1 text-left font-medium">
                      Detalii tarifare
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", pricingOpen && "rotate-180")} />
                    </button>
                    {pricingOpen ? <div className="mt-4 grid gap-2">
                      {pricing.breakdown.map((item) => <div key={item.label} className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{item.label}</span><span>{money(item.amount.amountMinor, item.amount.currency)}</span></div>)}
                    </div> : null}
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <strong className="font-heading text-4xl tracking-tight">{money(totalMinor, currency)}</strong>
                  </div>
                  <AppButton type="button" size="lg" onClick={session && session.status === "active" ? () => changeStep("billing") : createSession} disabled={busy} className="w-full">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Confirmă și continuă la facturare
                  </AppButton>
                  <AppButton type="button" variant="ghost" onClick={editDelivery} disabled={busy} className="w-full"><ArrowLeft className="size-4" />Înapoi la configurație</AppButton>
                </div>
              ) : null}

              {step === "billing" ? (
                <div className="grid gap-5">
                  <div><p className="type-caption">Pasul 2 din 3</p><h2 className="mt-2 font-heading text-2xl">Date de facturare</h2></div>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/45 p-1">
                    {(["individual", "company"] as const).map((type) => <button key={type} type="button" onClick={() => setBilling((current) => ({ ...current, customerType: type }))} className={cn("min-h-11 rounded-lg text-sm", billing.customerType === type && "bg-background font-medium shadow-sm")}>{type === "individual" ? "Persoană fizică" : "Persoană juridică"}</button>)}
                  </div>
                  {billing.customerType === "individual" ? <Field label="Nume complet" name="fullName" value={billing.fullName ?? ""} onChange={(value) => setBilling((current) => ({ ...current, fullName: value }))} autoComplete="name" /> : <>
                    <Field label="Denumire legală" name="companyLegalName" value={billing.companyLegalName ?? ""} onChange={(value) => setBilling((current) => ({ ...current, companyLegalName: value }))} autoComplete="organization" />
                    <Field label="Cod fiscal" name="taxIdentifier" value={billing.taxIdentifier ?? ""} onChange={(value) => setBilling((current) => ({ ...current, taxIdentifier: value }))} />
                  </>}
                  <Field label="Adresă / sediu" name="addressLine" value={billing.addressLine} onChange={(value) => setBilling((current) => ({ ...current, addressLine: value }))} autoComplete="street-address" />
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Localitate" name="city" value={billing.city} onChange={(value) => setBilling((current) => ({ ...current, city: value }))} /><Field label="Județ / regiune" name="region" value={billing.region} onChange={(value) => setBilling((current) => ({ ...current, region: value }))} /></div>
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Țară (cod ISO)" name="countryCode" value={billing.countryCode} onChange={(value) => setBilling((current) => ({ ...current, countryCode: value.toUpperCase() }))} maxLength={2} /><Field label="Cod poștal" name="postalCode" value={billing.postalCode ?? ""} onChange={(value) => setBilling((current) => ({ ...current, postalCode: value }))} /></div>
                  <Field label="Email factură" name="invoiceEmail" value={billing.invoiceEmail} onChange={(value) => setBilling((current) => ({ ...current, invoiceEmail: value }))} type="email" />
                  <label className="flex items-start gap-3 border-t border-border/70 pt-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4" checked={saveBilling} onChange={(event) => setSaveBilling(event.target.checked)} /><span>{savedProfile ? "Actualizează datele salvate pentru comenzile viitoare" : "Salvează pentru comenzile viitoare"}</span></label>
                  <label className="flex items-start gap-3 border-t border-border/70 pt-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4" checked={billing.privacyAccepted} onChange={(event) => setBilling((current) => ({ ...current, privacyAccepted: event.target.checked }))} /><span>Accept procesarea datelor de facturare pentru generarea facturii PDF.</span></label>
                  <AppButton type="button" size="lg" onClick={continueToPayment} disabled={busy || !canSubmitBilling} className="w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Continuă la plata securizată</AppButton>
                  <AppButton type="button" variant="ghost" onClick={() => changeStep("summary")} disabled={busy} className="w-full"><ArrowLeft className="size-4" />Înapoi la sumar</AppButton>
                </div>
              ) : null}

              {step === "payment" ? (
                <div className="grid gap-5">
                  <div><p className="type-caption">Pasul 3 din 3</p><h2 className="mt-2 font-heading text-2xl">Plată Stripe</h2><p className="mt-2 text-sm text-muted-foreground">Datele cardului sunt procesate direct de Stripe.</p></div>
                  {savedMethods.length ? <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/45 p-1"><button type="button" onClick={() => setPaymentMode("saved")} className={cn("min-h-11 rounded-lg", paymentMode === "saved" && "bg-background shadow-sm")}>Salvată</button><button type="button" onClick={() => setPaymentMode("new")} className={cn("min-h-11 rounded-lg", paymentMode === "new" && "bg-background shadow-sm")}>Card nou</button></div> : null}
                  {paymentMode === "saved" && savedMethods.length ? <div className="grid gap-3">{savedMethods.map((method) => <button key={method.id} type="button" onClick={() => chooseSavedMethod(method.id)} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left", selectedSavedMethod === method.id ? "border-primary/55 ring-4 ring-ring" : "border-border/80")}><CreditCard className="size-4" /><span className="font-medium">{method.label} · {method.expiryLabel}</span>{method.isDefault ? <Check className="ml-auto size-4 text-primary" /> : null}</button>)}</div> : null}
                  {paymentMode === "new" || !savedMethods.length ? <><div ref={elementContainerRef} className={cn("min-h-40 rounded-xl border border-border/80 bg-background p-4", !elementReady && "opacity-60")} /><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={saveCard} onChange={(event) => setSaveCard(event.target.checked)} className="size-4" />Salvează acest card în Stripe pentru viitor</label></> : null}
                  <AppButton type="button" size="lg" onClick={paymentMode === "saved" && savedMethods.length ? paySaved : payNew} disabled={busy || (paymentMode === "saved" && !selectedSavedMethod) || (paymentMode === "new" && !elementReady)} className="w-full">{busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}{paymentMode === "saved" && savedMethods.length ? "Plătește cu metoda salvată" : "Plătește securizat"}</AppButton>
                  <button type="button" onClick={() => changeStep("billing")} disabled={busy} className="text-sm text-muted-foreground underline underline-offset-4">Modifică datele de facturare</button>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}
        {message ? <div role="status" className="mt-5 rounded-xl border border-border/80 bg-secondary/40 p-4 text-sm leading-6">{message}</div> : null}
      </div>
    </div>
  );
}
