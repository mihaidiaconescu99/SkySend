"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStripeJs } from "@/lib/stripe/client";
import { skySendStripeElementsAppearance } from "@/lib/stripe/elements";
import { cn } from "@/lib/utils";
import type {
  Stripe,
  StripeElements,
  StripePaymentElement,
} from "@stripe/stripe-js";
import type { ClientStripePaymentMethod } from "@/types/payment-methods";

type PaymentMethodsResponse = {
  paymentMethods?: ClientStripePaymentMethod[];
  error?: string;
};

type SetupIntentResponse = {
  clientSecret?: string;
  error?: string;
};

type StripeSetupPaymentElementProps = {
  active: boolean;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  className?: string;
};

async function readStripeJson<T>(
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

async function loadPaymentMethods() {
  const response = await fetch("/api/stripe/payment-methods", {
    cache: "no-store",
  });
  const result = await readStripeJson<PaymentMethodsResponse>(
    response,
    "Metodele de plată nu au putut fi încărcate.",
  );

  if (!response.ok) {
    throw new Error(result.error ?? "Metodele de plată nu au putut fi încărcate.");
  }

  return result.paymentMethods ?? [];
}

function StripeSetupPaymentElement({
  active,
  onSaved,
  onCancel,
  saveLabel = "Salvează metoda",
  cancelLabel = "Anulează",
  className,
}: StripeSetupPaymentElementProps) {
  const elementContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isElementReady, setIsElementReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let disposed = false;

    async function prepareSetupIntent() {
      setIsPreparing(true);
      setIsElementReady(false);
      setMessage(null);

      try {
        const response = await fetch("/api/stripe/setup-intent", {
          method: "POST",
        });
        const result = await readStripeJson<SetupIntentResponse>(
          response,
          "Configurarea Stripe nu a putut fi pregătită.",
        );

        if (!response.ok || !result.clientSecret) {
          throw new Error(result.error ?? "Configurarea Stripe nu a putut fi pregătită.");
        }

        const stripe = await getStripeJs();

        if (!stripe) {
          throw new Error("Stripe.js nu a putut fi încărcat.");
        }

        const elements = stripe.elements({
          clientSecret: result.clientSecret,
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
          setMessage(
          error instanceof Error
            ? error.message
            : "Configurarea Stripe nu a putut fi pregătită.",
          );
        }
      } finally {
        if (!disposed) {
          setIsPreparing(false);
        }
      }
    }

    void prepareSetupIntent();

    return () => {
      disposed = true;
      paymentElementRef.current?.destroy();
      stripeRef.current = null;
      elementsRef.current = null;
      paymentElementRef.current = null;
    };
  }, [active]);

  async function handleSavePaymentMethod() {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;

    if (!stripe || !elements || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/client/payment-methods`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Metoda de plată nu a putut fi salvată.");
      }

      if (result.setupIntent.status !== "succeeded") {
        throw new Error("Configurarea metodei de plată este încă în așteptare.");
      }

      await onSaved();
    } catch (error) {
      setMessage(
          error instanceof Error
            ? error.message
          : "Metoda de plată nu a putut fi salvată.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn("grid gap-4", className)}>
      {isPreparing ? (
        <div className="flex min-h-36 items-center justify-center gap-2 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/45 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Se încarcă cardurile Stripe salvate
        </div>
      ) : null}

      <div
        ref={elementContainerRef}
        className={cn(
          "min-h-36 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-background p-4",
          !isElementReady && "opacity-70",
        )}
      />

      {message ? (
        <div className="rounded-[calc(var(--radius)+0.375rem)] border border-destructive/30 bg-destructive/8 p-4 text-sm leading-6 text-destructive">
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AppButton
          type="button"
          size="lg"
          disabled={!isElementReady || isSaving}
          onClick={handleSavePaymentMethod}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {isSaving ? "Se salvează" : saveLabel}
        </AppButton>
        {onCancel ? (
          <AppButton type="button" variant="outline" size="lg" onClick={onCancel}>
            {cancelLabel}
          </AppButton>
        ) : null}
      </div>
    </div>
  );
}

type AddStripePaymentMethodPanelProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

function AddStripePaymentMethodPanel({
  open,
  onClose,
  onSaved,
}: AddStripePaymentMethodPanelProps) {
  const titleId = useId();

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Închide adăugarea cardului"
        className="absolute inset-0 bg-[rgba(15,23,38,0.32)]"
        onClick={onClose}
      />

      <aside className="absolute inset-x-0 bottom-0 flex max-h-[min(88svh,calc(100dvh_-_env(safe-area-inset-top)_-_0.75rem))] flex-col rounded-t-[2rem] border border-border/80 bg-background shadow-[var(--elevation-panel)] md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-[32rem] md:rounded-none md:rounded-l-[2rem]">
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-border md:hidden" />

        <div className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-5 md:px-6">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit">
              Stripe Setup
            </Badge>
            <div className="space-y-2">
              <h2 id={titleId} className="type-h3">
                Adaugă metodă de plată
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Stripe colectează și stochează cardul. SkySend primește doar
                referința metodei de plată salvate.
              </p>
            </div>
          </div>

          <AppButton
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Închide adăugarea cardului"
            onClick={onClose}
          >
            <X />
          </AppButton>
        </div>

        <div className="grid flex-1 overflow-y-auto px-5 pt-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] md:px-6 md:pb-5">
          <StripeSetupPaymentElement
            active={open}
            onSaved={async () => {
              await onSaved();
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </aside>
    </div>
  );
}

export function PaymentMethodsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentMethods, setPaymentMethods] = useState<ClientStripePaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState<string | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshPaymentMethods() {
    const methods = await loadPaymentMethods();
    setPaymentMethods(methods);
  }

  useEffect(() => {
    let disposed = false;

    async function loadInitialState() {
      setIsLoading(true);
      setMessage(null);

      try {
        const setupClientSecret = searchParams.get("setup_intent_client_secret");

        if (setupClientSecret) {
          const stripe = await getStripeJs();
          const setupResult = await stripe?.retrieveSetupIntent(setupClientSecret);

          if (setupResult?.error) {
            setMessage(setupResult.error.message ?? "Configurarea metodei de plată a eșuat.");
          } else if (setupResult?.setupIntent?.status === "succeeded") {
            setMessage("Metoda de plată a fost salvată în Stripe.");
          }

          router.replace("/client/payment-methods");
        }

        const methods = await loadPaymentMethods();

        if (!disposed) {
          setPaymentMethods(methods);
        }
      } catch (error) {
        if (!disposed) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Metodele de plată nu au putut fi încărcate.",
          );
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      disposed = true;
    };
  }, [router, searchParams]);

  async function mutatePaymentMethod(
    paymentMethodId: string,
    method: "PATCH" | "DELETE",
  ) {
    setIsMutating(paymentMethodId);
    setMessage(null);

    try {
      const response = await fetch("/api/stripe/payment-methods", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentMethodId }),
      });
      const result = await readStripeJson<PaymentMethodsResponse>(
        response,
        "Metoda de plată nu a putut fi actualizată.",
      );

      if (!response.ok) {
        throw new Error(result.error ?? "Metoda de plată nu a putut fi actualizată.");
      }

      setPaymentMethods(result.paymentMethods ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Metoda de plată nu a putut fi actualizată.",
      );
    } finally {
      setIsMutating(null);
    }
  }

  return (
    <section className="app-container flex flex-col gap-6">
      <PageHeader
        eyebrow="Metode de plată"
        title="Carduri Stripe salvate"
        description="Vezi și gestionează cardurile atașate clientului Stripe. SkySend nu stochează niciodată numerele cardurilor sau codurile CVC."
        actions={[
          {
            label: "Istoric plăți",
            href: "/client/billing-history",
            variant: "outline",
          },
          {
            label: "Adaugă metodă",
            onClick: () => setAddPanelOpen(true),
            variant: "default",
            icon: <Plus className="size-4" />,
          },
        ]}
      />

      <Card className="rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <div className="grid gap-1">
                <p className="font-medium text-foreground">Stocare securizată prin Stripe</p>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Cardurile salvate sunt încărcate din metodele de plată Stripe
                Customer și pot fi refolosite la checkout fără să expună datele
                cardului către SkySend.
              </p>
            </div>
          </div>
          <StatusBadge label="Element de plată" tone="info" />
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 text-sm leading-6 text-muted-foreground">
          {message}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Metode salvate"
        title={
          paymentMethods.length > 0
            ? `${paymentMethods.length} ${
                paymentMethods.length === 1 ? "card salvat" : "carduri salvate"
              }`
            : "Disponibil la checkout"
        }
        description="Cardurile afișate aici sunt stocate și tokenizate de Stripe. SkySend primește doar referința PaymentMethod."
      >
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/45 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Se încarcă metodele de plată Stripe
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="grid gap-5 rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/45 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background text-foreground">
                <CreditCard className="size-4" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Carduri Stripe și Link salvate
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Dacă ai deja un card în Stripe Link, acesta apare mai jos.
                  Selectează-l și salvează-l o singură dată pentru ca SkySend să
                  atașeze în siguranță referința PaymentMethod la clientul Stripe.
                </p>
              </div>
            </div>
            <StripeSetupPaymentElement
              active={!addPanelOpen}
              onSaved={refreshPaymentMethods}
              saveLabel="Salvează cardul selectat"
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {paymentMethods.map((paymentMethod) => (
              <div
                key={paymentMethod.id}
                className={cn(
                  "grid gap-5 overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border p-5 transition-colors",
                  paymentMethod.isDefault
                    ? "border-primary/45 bg-card shadow-[var(--elevation-card)] ring-4 ring-ring"
                    : "border-border/80 bg-secondary/45",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-background text-foreground">
                      <CreditCard className="size-6" />
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <p className="break-words font-medium text-foreground">
                        {paymentMethod.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {paymentMethod.brand} cu terminația {paymentMethod.last4}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge label="Activ" tone="success" />
                    {paymentMethod.isDefault ? (
                      <StatusBadge label="Principal" tone="info" />
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Brand</p>
                    <p className="mt-1 font-medium text-foreground">
                      {paymentMethod.brand}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ultimele 4 cifre</p>
                    <p className="mt-1 font-medium text-foreground">
                      {paymentMethod.last4}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expirare</p>
                    <p className="mt-1 font-medium text-foreground">
                      {paymentMethod.expiryLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tip</p>
                    <p className="mt-1 font-medium text-foreground">
                      {paymentMethod.funding}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={paymentMethod.isDefault ? "Principal" : "Rezervă"}
                    tone={paymentMethod.isDefault ? "success" : "neutral"}
                  />
                  <StatusBadge label="Stripe Customer" tone="info" />
                  {paymentMethod.country ? (
                    <StatusBadge label={paymentMethod.country} tone="neutral" />
                  ) : null}
                </div>

                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <AppButton
                    type="button"
                    size="sm"
                    variant={paymentMethod.isDefault ? "secondary" : "outline"}
                    className="w-full sm:w-auto"
                    disabled={
                      paymentMethod.isDefault || isMutating === paymentMethod.id
                    }
                    onClick={() => mutatePaymentMethod(paymentMethod.id, "PATCH")}
                  >
                    {isMutating === paymentMethod.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Star className="size-4" />
                    )}
                    Setează ca principal
                  </AppButton>
                  <AppButton
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={isMutating === paymentMethod.id}
                    onClick={() => mutatePaymentMethod(paymentMethod.id, "DELETE")}
                  >
                    <Trash2 className="size-4" />
                    Elimină
                  </AppButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <AddStripePaymentMethodPanel
        open={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        onSaved={refreshPaymentMethods}
      />
    </section>
  );
}
