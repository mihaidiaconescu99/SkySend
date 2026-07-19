import "server-only";
import Stripe from "stripe";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  assertStripeTestSecretKey,
  buildStripePaymentIntentMetadata,
  toStripeCurrencyCode,
} from "@/lib/stripe/shared";
import type { ClientStripePaymentMethod } from "@/types/payment-methods";
import type { StripePaymentIntentDraft } from "@/types/stripe";

let stripeServer: Stripe | null = null;

export class StripeAuthenticationError extends Error {
  constructor() {
    super("Authentication is required for Stripe billing.");
    this.name = "StripeAuthenticationError";
  }
}

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey || secretKey.trim().length === 0) {
    throw new Error("[stripe] Missing STRIPE_SECRET_KEY.");
  }

  return assertStripeTestSecretKey(secretKey);
}

export function getStripeServer() {
  const secretKey = getStripeSecretKey();

  stripeServer ??= new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover" as never,
    appInfo: {
      name: "SkySend",
      version: "0.1.0",
    },
  });

  return stripeServer;
}

function escapeStripeSearchValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getCustomerEmail(customer: Stripe.Customer) {
  return customer.email?.trim() || null;
}

function getUserDisplayName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) {
    return null;
  }

  return (
    user.fullName ??
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ??
    null
  ) || null;
}

export async function getAuthenticatedStripeCustomer() {
  const { userId } = await auth();

  if (!userId) {
    throw new StripeAuthenticationError();
  }

  const stripe = getStripeServer();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? undefined;
  const name = getUserDisplayName(user) ?? undefined;
  const metadata = {
    clerkUserId: userId,
    product: "skysend",
  };
  const customerSearch = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${escapeStripeSearchValue(userId)}'`,
    limit: 1,
  });
  const existingCustomer = customerSearch.data.find(
    (customer) => !customer.deleted,
  );

  if (existingCustomer) {
    const needsEmail = email && getCustomerEmail(existingCustomer) !== email;
    const needsName = name && existingCustomer.name !== name;

    if (needsEmail || needsName) {
      const updatedCustomer = await stripe.customers.update(existingCustomer.id, {
        email,
        name,
        metadata,
      });

      return { stripe, customer: updatedCustomer, clerkUserId: userId };
    }

    return { stripe, customer: existingCustomer, clerkUserId: userId };
  }

  const createdCustomer = await stripe.customers.create({
    email,
    name,
    metadata,
  });

  return { stripe, customer: createdCustomer, clerkUserId: userId };
}

export async function listStripeCustomerPaymentMethods(
  stripe: Stripe,
  customer: Stripe.Customer,
): Promise<ClientStripePaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customer.id,
    type: "card",
    limit: 20,
  });
  const defaultPlatăMethod =
    typeof customer.invoice_settings.default_payment_method === "string"
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method?.id ?? null;

  return paymentMethods.data
    .filter((paymentMethod) => paymentMethod.card)
    .map((paymentMethod) => {
      const card = paymentMethod.card!;
      const createdAt = new Date(paymentMethod.created * 1000).toISOString();
      const brand = card.display_brand ?? card.brand ?? "card";
      const formattedBrand = brand
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());

      return {
        id: paymentMethod.id,
        label: `${formattedBrand} ending in ${card.last4}`,
        brand: formattedBrand,
        funding: card.funding
          .replace(/_/g, " ")
          .replace(/\b\w/g, (character) => character.toUpperCase()),
        country: card.country ?? null,
        last4: card.last4,
        expiryLabel: `${String(card.exp_month).padStart(2, "0")}/${card.exp_year}`,
        isDefault: paymentMethod.id === defaultPlatăMethod,
        status: "active" as const,
        providerReference: paymentMethod.id,
        createdAt,
      };
    })
    .sort((currentMethod, nextMethod) => {
      if (currentMethod.isDefault === nextMethod.isDefault) {
        return (
          new Date(nextMethod.createdAt).getTime() -
          new Date(currentMethod.createdAt).getTime()
        );
      }

      return currentMethod.isDefault ? -1 : 1;
    });
}

export async function assertStripePaymentMethodBelongsToCustomer(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string,
) {
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  const ownerCustomerId =
    typeof paymentMethod.customer === "string"
      ? paymentMethod.customer
      : paymentMethod.customer?.id ?? null;

  if (ownerCustomerId !== customerId) {
    throw new Error("Payment method does not belong to this customer.");
  }

  return paymentMethod;
}

export function createStripePaymentIntentParams(draft: StripePaymentIntentDraft) {
  return {
    amount: draft.amountMinor,
    currency: toStripeCurrencyCode(draft.currency),
    capture_method: draft.captureMethod ?? "automatic",
    customer: draft.stripeCustomerId ?? undefined,
    metadata: buildStripePaymentIntentMetadata(draft),
    setup_future_usage: draft.saveForFutureUse ? ("off_session" as const) : undefined,
    statement_descriptor_suffix: draft.statementDescriptorSuffix,
    automatic_payment_methods: {
      enabled: true,
    },
  } satisfies Stripe.PaymentIntentCreateParams;
}
