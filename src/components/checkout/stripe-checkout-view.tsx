"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPinned,
  MoveRight,
  Package2,
  Plus,
  ReceiptText,
  Route,
  ShieldCheck,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { droneClassLabels } from "@/constants/domain";
import { activeHub } from "@/constants/hub";
import {
  updateCreatedDeliveryOrderPayment,
} from "@/lib/create-delivery-submit";
import { calculateDistanceKm } from "@/lib/mission-route";
import { notifyOrderConfirmation } from "@/lib/notification-events";
import { calculateSkySendPricing, isValidPricingSnapshot } from "@/lib/pricing";
import { getStripeJs } from "@/lib/stripe/client";
import { skySendStripeElementsAppearance } from "@/lib/stripe/elements";
import { useSettings } from "@/lib/settings/settings-context";
import { cn } from "@/lib/utils";
import type {
  Stripe,
  StripeElements,
  StripePaymentElement,
} from "@stripe/stripe-js";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { ClientStripePaymentMethod } from "@/types/payment-methods";
import type { SkySendPricingResult } from "@/types/pricing";

type StripeCheckoutViewProps = {
  orderId: string;
};

type CheckoutState =
  | { status: "idle"; message: string | null }
  | { status: "loading"; message: string | null }
  | { status: "failed"; message: string };

type PaymentMode = "saved" | "new";

type PaymentIntentResponse = {
  clientSecret?: string;
  paymentIntentId?: string;
  savedPaymentMethods?: ClientStripePaymentMethod[];
  status?: string;
  error?: string;
};

async function readCheckoutJson<T>(
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

function formatScheduledDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function rebuildCheckoutPricing(order: CreatedDeliveryOrder): SkySendPricingResult {
  const hubToPickupKm = calculateDistanceKm(
    activeHub.address.location,
    order.payload.selectedPickupPoint.location,
  );
  const pickupToDropoffKm = calculateDistanceKm(
    order.payload.selectedPickupPoint.location,
    order.payload.selectedDropoffPoint.location,
  );
  const routeDistanceKm = hubToPickupKm + pickupToDropoffKm;

  return calculateSkySendPricing({
    pickupCoordinates: order.payload.selectedPickupPoint.location,
    dropoffCoordinates: order.payload.selectedDropoffPoint.location,
    distanceKm: routeDistanceKm,
    selectedDroneId: order.payload.recommendedDroneClass,
    dispatchTiming: order.payload.urgency,
    scheduledAt: order.payload.scheduledAt,
    weightKg: order.payload.parcel.weightKg,
    dimensionsCm: {
      lengthCm: order.payload.parcel.lengthCm,
      widthCm: order.payload.parcel.widthCm,
      heightCm: order.payload.parcel.heightCm,
    },
    fragilityLevel: order.payload.parcel.fragilityLevel,
    routeComplexity: order.payload.coverageStatus === "review" ? "review" : "standard",
  });
}

function getCheckoutPricing(order: CreatedDeliveryOrder): SkySendPricingResult {
  return isValidPricingSnapshot(order.payload.pricingSnapshot)
    ? order.payload.pricingSnapshot
    : rebuildCheckoutPricing(order);
}

function isConfirmedPaymentStatus(status: string | null | undefined) {
  return status === "succeeded";
}

function isProcessingPaymentStatus(status: string | null | undefined) {
  return status === "processing" || status === "requires_capture";
}

function ExpiredCheckoutState({ orderId }: { orderId: string }) {
  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Checkout"
        title="Checkout session unavailable"
        description="This local order is no longer available in the browser session."
        actions={[
          {
            label: "Înapoi la creare livrare",
            href: "/client/create-delivery",
            variant: "default",
            icon: <ArrowLeft className="size-4" />,
          },
        ]}
      />
      <SectionCard
        eyebrow="Comandă"
        title={orderId}
        description="Create the delivery again to prepare a fresh checkout session."
      >
        <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5 text-sm leading-6 text-muted-foreground">
          SkySend could not find the order payload needed for checkout.
        </div>
      </SectionCard>
    </section>
  );
}

export function StripeCheckoutView({ orderId }: StripeCheckoutViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatCurrency } = useSettings();
  const elementContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const [order, setOrder] = useState<CreatedDeliveryOrder | null>(null);
  const [hasLoadedOrder, setHasLoadedOrder] = useState(false);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({
    status: "idle",
    message: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<
    ClientStripePaymentMethod[]
  >([]);
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState<string | null>(
    null,
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("new");
  const pricing = useMemo(() => (order ? getCheckoutPricing(order) : null), [order]);
  const selectedSavedMethod = savedPaymentMethods.find(
    (paymentMethod) => paymentMethod.id === selectedSavedMethodId,
  );
  const dispatchLabel = order
    ? order.payload.urgency === "scheduled"
      ? `Scheduled for ${formatScheduledDateTime(order.payload.scheduledAt) ?? "selected window"}`
      : `${order.payload.urgency === "priority" ? "Priority" : "Standard"} dispatch`
    : null;

  const markOrderPaid = useCallback(
    (paidOrder: CreatedDeliveryOrder, stripePaymentIntentId: string) => {
      const updatedOrder = updateCreatedDeliveryOrderPayment({
        orderId: paidOrder.id,
        paymentStatus: "paid",
        stripePaymentIntentId,
      });

      notifyOrderConfirmation(updatedOrder ?? paidOrder);
      router.replace(`${paidOrder.href}?brief=1`);
    },
    [router],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void fetch(`/api/orders/client-order?orderId=${encodeURIComponent(orderId)}`)
        .then((response) => {
          if (!response.ok) return null;
          return response.json() as Promise<CreatedDeliveryOrder>;
        })
        .then((storedOrder) => {
          setOrder(storedOrder);
          setHasLoadedOrder(true);
        })
        .catch(() => {
          setOrder(null);
          setHasLoadedOrder(true);
        });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [orderId]);

  useEffect(() => {
    if (!order || !pricing) {
      return;
    }

    let disposed = false;
    const checkoutOrder = order;
    const checkoutPricing = pricing;

    async function preparePaymentIntent() {
      setIsPreparingPayment(true);
      setCheckoutState({
        status: "loading",
        message: "Preparing secure payment.",
      });

      try {
        const response = await fetch("/api/stripe/payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: checkoutOrder.id,
            pricingSnapshot: checkoutPricing,
            savePaymentMethod: true,
            description: `SkySend delivery ${checkoutOrder.id}`,
          }),
        });
        const result = await readCheckoutJson<PaymentIntentResponse>(
          response,
          "Stripe payment could not be prepared. Please retry.",
        );

        if (!response.ok || !result.clientSecret || !result.paymentIntentId) {
          throw new Error(result.error ?? "Stripe payment could not be prepared.");
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
          setCheckoutState({
            status: "idle",
            message: null,
          });
        }
      } catch (error) {
        if (!disposed) {
          setCheckoutState({
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Stripe payment could not be prepared.",
          });
        }
      } finally {
        if (!disposed) {
          setIsPreparingPayment(false);
        }
      }
    }

    void preparePaymentIntent();

    return () => {
      disposed = true;
    };
  }, [order, pricing]);

  useEffect(() => {
    if (!clientSecret || paymentMode === "saved" || !elementContainerRef.current) {
      return;
    }

    let disposed = false;
    const mountedClientSecret = clientSecret;

    async function mountPaymentElement() {
      setIsElementReady(false);

      try {
        const stripe = await getStripeJs();

        if (!stripe) {
          throw new Error("Stripe.js could not be loaded.");
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
          setCheckoutState({
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Stripe payment form could not be loaded.",
          });
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

  useEffect(() => {
    if (!order) {
      return;
    }

    const returnedClientSecret = searchParams.get("payment_intent_client_secret");

    if (!returnedClientSecret) {
      return;
    }

    let disposed = false;
    const checkoutOrder = order;
    const stripeReturnedClientSecret = returnedClientSecret;

    async function verifyReturnedPayment() {
      setCheckoutState({
        status: "loading",
        message: "Confirming Stripe payment.",
      });

      try {
        const stripe = await getStripeJs();

        if (!stripe) {
          throw new Error("Stripe.js could not be loaded.");
        }

        const result = await stripe.retrievePaymentIntent(stripeReturnedClientSecret);

        if (result.error || !result.paymentIntent) {
          throw new Error(result.error?.message ?? "Plata Stripe nu a fost confirmată.");
        }

        if (isConfirmedPaymentStatus(result.paymentIntent.status)) {
          markOrderPaid(checkoutOrder, result.paymentIntent.id);
          return;
        }

        if (isProcessingPaymentStatus(result.paymentIntent.status)) {
          updateCreatedDeliveryOrderPayment({
            orderId: checkoutOrder.id,
            paymentStatus: "processing",
            stripePaymentIntentId: result.paymentIntent.id,
          });
          setPaymentMessage("Stripe is still processing this payment.");
        } else {
          updateCreatedDeliveryOrderPayment({
            orderId: checkoutOrder.id,
            paymentStatus: "failed",
            stripePaymentIntentId: result.paymentIntent.id,
          });
          throw new Error("Stripe payment was not completed.");
        }
      } catch (error) {
        if (!disposed) {
          setCheckoutState({
            status: "failed",
            message:
              error instanceof Error
                ? error.message
                : "Stripe payment could not be verified.",
          });
        }
      }
    }

    void verifyReturnedPayment();

    return () => {
      disposed = true;
    };
  }, [markOrderPaid, order, searchParams]);

  if (!hasLoadedOrder) {
    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
          eyebrow="Checkout"
          title="Preparing checkout"
          description="Loading the order summary and secure payment session."
        />
      </section>
    );
  }

  if (!order || !pricing) {
    return <ExpiredCheckoutState orderId={orderId} />;
  }

  const handlePayWithNewMethod = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;

    if (!order || !stripe || !elements || !clientSecret || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setPaymentMessage(null);
    setCheckoutState({
      status: "loading",
      message: "Confirming secure payment.",
    });
    updateCreatedDeliveryOrderPayment({
      orderId: order.id,
      paymentStatus: "processing",
      stripePaymentIntentId: paymentIntentId,
    });

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/client/checkout/${order.id}?payment=return`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Plata Stripe nu a fost confirmată.");
      }

      if (isConfirmedPaymentStatus(result.paymentIntent.status)) {
        markOrderPaid(order, result.paymentIntent.id);
        return;
      }

      if (isProcessingPaymentStatus(result.paymentIntent.status)) {
        setPaymentMessage("Stripe is processing this payment.");
        setCheckoutState({
          status: "idle",
          message: null,
        });
        return;
      }

      throw new Error("Stripe payment was not completed.");
    } catch (error) {
      updateCreatedDeliveryOrderPayment({
        orderId: order.id,
        paymentStatus: "failed",
        stripePaymentIntentId: paymentIntentId,
      });
      setCheckoutState({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Stripe payment could not be completed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayWithSavedMethod = async () => {
    if (!order || !pricing || !selectedSavedMethod || !paymentIntentId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setPaymentMessage(null);
    setCheckoutState({
      status: "loading",
      message: "Charging saved Stripe payment method.",
    });
    updateCreatedDeliveryOrderPayment({
      orderId: order.id,
      paymentStatus: "processing",
    });

    try {
      const response = await fetch("/api/stripe/pay-saved-method", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          paymentIntentId,
          paymentMethodId: selectedSavedMethod.id,
          pricingSnapshot: pricing,
        }),
      });
      const result = await readCheckoutJson<PaymentIntentResponse>(
        response,
        "Saved payment method could not be charged.",
      );

      if (!response.ok || !result.paymentIntentId) {
        throw new Error(result.error ?? "Saved payment method could not be charged.");
      }

      let finalStatus = result.status;
      let finalPaymentIntentId = result.paymentIntentId;

      if (finalStatus === "requires_action" && result.clientSecret) {
        const stripe = await getStripeJs();

        if (!stripe) {
          throw new Error("Stripe.js could not be loaded.");
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
        markOrderPaid(order, finalPaymentIntentId);
        return;
      }

      if (isProcessingPaymentStatus(finalStatus)) {
        updateCreatedDeliveryOrderPayment({
          orderId: order.id,
          paymentStatus: "processing",
          stripePaymentIntentId: finalPaymentIntentId,
        });
        setPaymentMessage("Stripe is processing this saved-method payment.");
        setCheckoutState({
          status: "idle",
          message: null,
        });
        return;
      }

      throw new Error("Saved payment method did not complete the payment.");
    } catch (error) {
      updateCreatedDeliveryOrderPayment({
        orderId: order.id,
        paymentStatus: "failed",
      });
      setCheckoutState({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Saved payment method could not be charged.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryCheckout = () => {
    setPaymentMessage(null);
    setCheckoutState({
      status: "idle",
      message: null,
    });
  };

  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Checkout"
        title="Confirmă plata înainte de dispatch"
        description="Plătește în SkySend prin componentele securizate Stripe înainte ca misiunea să înceapă."
        actions={[
          {
            label: "Înapoi la order",
            href: order.href,
            variant: "ghost",
            icon: <ArrowLeft className="size-4" />,
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.58fr)]">
        <div className="grid gap-5">
          <SectionCard
            eyebrow="Comandă"
            title={order.id}
            description="Compact order context for checkout."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <div className="flex items-center gap-3">
                  <MapPinned className="size-4 text-foreground" />
                  <p className="font-medium text-foreground">Ridicare</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {order.payload.pickupAddress.formattedAddress}
                  <br />
                  {order.payload.selectedPickupPoint.label}
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <div className="flex items-center gap-3">
                  <MoveRight className="size-4 text-foreground" />
                  <p className="font-medium text-foreground">Livrare</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {order.payload.dropoffAddress.formattedAddress}
                  <br />
                  {order.payload.selectedDropoffPoint.label}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Package2 className="size-4" />
                  Clasă drone
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {droneClassLabels[order.payload.recommendedDroneClass]}
                </p>
              </div>
              <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Route className="size-4" />
                  Dispatch
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {dispatchLabel}
                </p>
              </div>
              <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ReceiptText className="size-4" />
                  Total
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {formatCurrency(pricing.total.amountMinor)}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Tarife"
            title="Detalii tarifare"
            description="Calculated from distance, urgency, drone class and parcel profile."
          >
            <div className="grid gap-2">
              {pricing.breakdown.map((item) => (
                <div
                  key={item.type}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border/80 bg-background px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.amount.amountMinor)}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="font-medium text-foreground">Total amount</p>
                <p className="font-heading text-2xl tracking-tight text-foreground">
                  {formatCurrency(pricing.total.amountMinor)}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <Card className="h-fit rounded-[calc(var(--radius)+0.75rem)] shadow-[var(--elevation-card)]">
          <CardContent className="grid gap-4 p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Stripe Element de plată" tone="info" />
              </div>
              <h2 className="mt-4 font-heading text-2xl tracking-tight text-foreground">
                Payment
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Card entry and saved methods are handled by Stripe. SkySend does
                not store card numbers.
              </p>
            </div>

            {checkoutState.status === "failed" ? (
              <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-destructive/30 bg-destructive/8 p-4 text-sm leading-6 text-destructive">
                <p>{checkoutState.message}</p>
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={handleRetryCheckout}
                >
                  Retry
                </AppButton>
              </div>
            ) : null}

            {checkoutState.status === "loading" || isPreparingPayment ? (
              <div className="flex items-center gap-2 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-foreground" />
                {checkoutState.message ?? "Se pregătește plata Stripe"}
              </div>
            ) : null}

            {savedPaymentMethods.length > 0 ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2 rounded-[calc(var(--radius)+0.375rem)] bg-secondary/45 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("saved")}
                    className={cn(
                      "min-h-11 rounded-[var(--radius)] px-3 text-sm font-medium transition-colors",
                      paymentMode === "saved"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Saved
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("new")}
                    className={cn(
                      "min-h-11 rounded-[var(--radius)] px-3 text-sm font-medium transition-colors",
                      paymentMode === "new"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    New method
                  </button>
                </div>

                {paymentMode === "saved" ? (
                  <div className="grid gap-3">
                    {savedPaymentMethods.map((paymentMethod) => (
                      <button
                        key={paymentMethod.id}
                        type="button"
                        onClick={() => setSelectedSavedMethodId(paymentMethod.id)}
                        className={cn(
                          "rounded-[calc(var(--radius)+0.375rem)] border p-4 text-left transition-colors",
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
                                Expires {paymentMethod.expiryLabel}
                              </p>
                            </div>
                          </div>
                          {paymentMethod.isDefault ? (
                            <StatusBadge label="Principal" tone="success" />
                          ) : null}
                        </div>
                      </button>
                    ))}
                    <AppButton
                      type="button"
                      size="lg"
                      onClick={handlePayWithSavedMethod}
                      disabled={!selectedSavedMethod || !paymentIntentId || isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting && paymentMode === "saved" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Plătește cu metoda salvată
                    </AppButton>
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
                <AppButton
                  type="button"
                  size="lg"
                  onClick={handlePayWithNewMethod}
                  disabled={!isElementReady || isSubmitting || !clientSecret}
                  className="w-full"
                >
                  {isSubmitting && paymentMode === "new" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : savedPaymentMethods.length > 0 ? (
                    <Plus className="size-4" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Plătește cu method nouă
                </AppButton>
              </div>
            ) : null}

            {paymentMessage ? (
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
                {paymentMessage}
              </div>
            ) : null}

            <div className="grid gap-2 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="size-4" />
                Secure confirmation
              </div>
              <p>Payment starts only once and is protected with Stripe idempotency.</p>
              <p>Saved cards remain attached to the Stripe Customer.</p>
            </div>

            <AppButton asChild variant="outline" className="w-full">
              <Link href={order.href}>Return to order details</Link>
            </AppButton>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
