"use client";

import { useEffect, useRef, useState } from "react";
import {
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStripeJs } from "@/lib/stripe/client";
import { skySendStripeElementsAppearance } from "@/lib/stripe/elements";
import { cn } from "@/lib/utils";
import type {
  Stripe,
  StripeElements,
  StripePaymentElement,
} from "@stripe/stripe-js";
import type { ClientStripePaymentMethod } from "@/types/payment-methods";
import type { SkySendPricingResult } from "@/types/pricing";

type PaymentMode = "saved" | "new";

type PaymentIntentResponse = {
  clientSecret?: string;
  paymentIntentId?: string;
  savedPaymentMethods?: ClientStripePaymentMethod[];
  status?: string;
  error?: string;
};

type CreateDeliveryPaymentPanelProps = {
  orderId: string;
  pricingSnapshot: SkySendPricingResult;
  disabled?: boolean;
  onPaymentSucceeded: (stripePaymentIntentId: string) => Promise<void> | void;
};

async function readPaymentJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const responseText = await response.text();

  if (!responseText) {
    return {} as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function isConfirmedPaymentStatus(status: string | null | undefined) {
  return status === "succeeded";
}

function isProcessingPaymentStatus(status: string | null | undefined) {
  return status === "processing" || status === "requires_capture";
}

export function CreateDeliveryPaymentPanel({
  orderId,
  pricingSnapshot,
  disabled = false,
  onPaymentSucceeded,
}: CreateDeliveryPaymentPanelProps) {
  const elementContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("new");
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<
    ClientStripePaymentMethod[]
  >([]);
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState<string | null>(
    null,
  );
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const selectedSavedMethod = savedPaymentMethods.find(
    (paymentMethod) => paymentMethod.id === selectedSavedMethodId,
  );
  const amountMinor = pricingSnapshot.total.amountMinor;
  const currency = pricingSnapshot.total.currency;

  useEffect(() => {
    let disposed = false;

    async function preparePaymentIntent() {
      setIsPreparing(true);
      setIsElementReady(false);
      setPaymentMessage(null);
      setClientSecret(null);
      setPaymentIntentId(null);

      try {
        const response = await fetch("/api/stripe/payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            pricingSnapshot,
            savePaymentMethod: true,
            description: `SkySend delivery ${orderId}`,
          }),
        });
        const result = await readPaymentJson<PaymentIntentResponse>(
          response,
          "Plata Stripe nu a putut fi pregătită.",
        );

        if (!response.ok || !result.clientSecret || !result.paymentIntentId) {
          throw new Error(result.error ?? "Plata Stripe nu a putut fi pregătită.");
        }

        if (!disposed) {
          const methods = result.savedPaymentMethods ?? [];
          const defaultMethod =
            methods.find((paymentMethod) => paymentMethod.isDefault) ?? methods[0];

          setClientSecret(result.clientSecret);
          setPaymentIntentId(result.paymentIntentId);
          setSavedPaymentMethods(methods);
          setSelectedSavedMethodId(defaultMethod?.id ?? null);
          setPaymentMode(defaultMethod ? "saved" : "new");
        }
      } catch (error) {
        if (!disposed) {
          setPaymentMessage(
            error instanceof Error
              ? error.message
              : "Plata Stripe nu a putut fi pregătită.",
          );
        }
      } finally {
        if (!disposed) {
          setIsPreparing(false);
        }
      }
    }

    void preparePaymentIntent();

    return () => {
      disposed = true;
    };
  }, [amountMinor, currency, orderId, pricingSnapshot]);

  useEffect(() => {
    if (!clientSecret || paymentMode !== "new" || !elementContainerRef.current) {
      return;
    }

    let disposed = false;
    const mountedClientSecret = clientSecret;

    async function mountPaymentElement() {
      setIsElementReady(false);

      try {
        const stripe = await getStripeJs();

        if (!stripe) {
          throw new Error("Stripe.js nu a putut fi încărcat.");
        }

        const elements = stripe.elements({
          clientSecret: mountedClientSecret,
          appearance: skySendStripeElementsAppearance,
        });
        const paymentElement = elements.create("payment", {
          layout: "tabs",
        });

        paymentElement.on("ready", () => {
          if (!disposed) {
            setIsElementReady(true);
          }
        });

        if (!disposed && elementContainerRef.current) {
          stripeRef.current = stripe;
          elementsRef.current = elements;
          paymentElementRef.current = paymentElement;
          paymentElement.mount(elementContainerRef.current);
        }
      } catch (error) {
        if (!disposed) {
          setPaymentMessage(
            error instanceof Error
              ? error.message
              : "Formularul de plată Stripe nu a putut fi încărcat.",
          );
        }
      }
    }

    void mountPaymentElement();

    return () => {
      disposed = true;
      paymentElementRef.current?.destroy();
      stripeRef.current = null;
      elementsRef.current = null;
      paymentElementRef.current = null;
    };
  }, [clientSecret, paymentMode]);

  async function handlePayWithNewMethod() {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;

    if (!stripe || !elements || !clientSecret || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);
    setPaymentMessage(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/client/active-delivery`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Plata Stripe nu a fost confirmată.");
      }

      if (isConfirmedPaymentStatus(result.paymentIntent.status)) {
        await onPaymentSucceeded(result.paymentIntent.id);
        return;
      }

      if (isProcessingPaymentStatus(result.paymentIntent.status)) {
        setPaymentMessage("Stripe încă procesează această plată.");
        return;
      }

      throw new Error("Plata Stripe nu a fost finalizată.");
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "Plata Stripe nu a putut fi finalizată.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePayWithSavedMethod() {
    if (!selectedSavedMethod || isSubmitting || disabled) {
      return;
    }

    setIsSubmitting(true);
    setPaymentMessage(null);

    try {
      const response = await fetch("/api/stripe/pay-saved-method", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          paymentMethodId: selectedSavedMethod.id,
          pricingSnapshot,
        }),
      });
      const result = await readPaymentJson<PaymentIntentResponse>(
        response,
        "Metoda de plată salvată nu a putut fi taxată.",
      );

      if (!response.ok || !result.paymentIntentId) {
        throw new Error(result.error ?? "Metoda de plată salvată nu a putut fi taxată.");
      }

      let finalStatus = result.status;
      let finalPaymentIntentId = result.paymentIntentId;

      if (finalStatus === "requires_action" && result.clientSecret) {
        const stripe = await getStripeJs();

        if (!stripe) {
          throw new Error("Stripe.js nu a putut fi încărcat.");
        }

        const nextActionResult = await stripe.handleNextAction({
          clientSecret: result.clientSecret,
        });

        if (nextActionResult.error || !nextActionResult.paymentIntent) {
          throw new Error(
            nextActionResult.error?.message ?? "Autentificarea Stripe a eșuat.",
          );
        }

        finalStatus = nextActionResult.paymentIntent.status;
        finalPaymentIntentId = nextActionResult.paymentIntent.id;
      }

      if (isConfirmedPaymentStatus(finalStatus)) {
        await onPaymentSucceeded(finalPaymentIntentId);
        return;
      }

      if (isProcessingPaymentStatus(finalStatus)) {
        setPaymentMessage("Stripe încă procesează plata cu metoda salvată.");
        return;
      }

      throw new Error("Metoda de plată salvată nu a finalizat plata.");
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "Metoda de plată salvată nu a putut fi taxată.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <WalletCards className="size-4 text-foreground" />
          <p className="font-medium text-foreground">Metodă de plată</p>
        </div>
      </div>

      {isPreparing ? (
        <div className="flex items-center gap-2 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-foreground" />
          Se pregătesc metodele de plată
        </div>
      ) : null}

      {savedPaymentMethods.length > 0 ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 rounded-[calc(var(--radius)+0.375rem)] bg-secondary/45 p-1">
            <button
              type="button"
              onClick={() => setPaymentMode("saved")}
              aria-pressed={paymentMode === "saved"}
              className={cn(
                "min-h-11 rounded-[var(--radius)] px-3 text-sm font-medium transition-colors focus-visible:ring-4 focus-visible:ring-ring",
                paymentMode === "saved"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Salvate
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode("new")}
              aria-pressed={paymentMode === "new"}
              className={cn(
                "min-h-11 rounded-[var(--radius)] px-3 text-sm font-medium transition-colors focus-visible:ring-4 focus-visible:ring-ring",
                paymentMode === "new"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Nouă
            </button>
          </div>

          {paymentMode === "saved" ? (
            <div className="grid gap-3">
              {savedPaymentMethods.map((paymentMethod) => (
                <button
                  key={paymentMethod.id}
                  type="button"
                  onClick={() => setSelectedSavedMethodId(paymentMethod.id)}
                  aria-pressed={selectedSavedMethodId === paymentMethod.id}
                  className={cn(
                    "min-h-20 rounded-[calc(var(--radius)+0.375rem)] border p-4 text-left transition-colors focus-visible:ring-4 focus-visible:ring-ring",
                    selectedSavedMethodId === paymentMethod.id
                      ? "border-border bg-card ring-4 ring-ring"
                      : "border-border/80 bg-secondary/45 hover:bg-secondary/65",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background text-foreground">
                        <CreditCard className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words font-medium text-foreground">
                          {paymentMethod.label}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Expiră {paymentMethod.expiryLabel}
                        </p>
                      </div>
                    </div>
                    {paymentMethod.isDefault ? (
                      <StatusBadge label="Principal" tone="success" />
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {paymentMode === "new" ? (
        <div className="grid gap-3">
          <div
            ref={elementContainerRef}
            className={cn(
              "min-h-40 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4",
              !isElementReady && "opacity-70",
            )}
          />
        </div>
      ) : null}

      {paymentMessage ? (
        <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
          {paymentMessage}
        </div>
      ) : null}

      <AppButton
        type="button"
        size="lg"
        className="w-full"
        disabled={
          disabled ||
          isPreparing ||
          isSubmitting ||
          (paymentMode === "new" && (!isElementReady || !clientSecret)) ||
          (paymentMode === "saved" && !selectedSavedMethod)
        }
        onClick={
          paymentMode === "saved" ? handlePayWithSavedMethod : handlePayWithNewMethod
        }
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : paymentMode === "saved" ? (
          <ShieldCheck className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
        {isSubmitting ? "Se confirmă plata" : "Confirmă și plătește"}
      </AppButton>

      {paymentIntentId ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Plata este legată de comanda {orderId}. SkySend nu stochează niciodată numerele cardurilor.
        </p>
      ) : null}
    </div>
  );
}
