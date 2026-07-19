import type { CurrencyCode, PaymentMethodId, PaymentRecordId, UserProfileId } from "@/types/entities";

export type StripeTestCard = {
  id: string;
  label: string;
  brand: string;
  last4: string;
  expiryLabel: string;
  behaviorLabel: string;
  description: string;
};

export type StripeSavedPaymentMethodDraft = {
  id: PaymentMethodId;
  userProfileId: UserProfileId;
  stripeCustomerId?: string | null;
  stripePaymentMethodId: string;
  label: string;
  brand: string;
  last4: string;
  expiryLabel: string;
  isDefault: boolean;
};

export type StripePaymentIntentDraft = {
  amountMinor: number;
  currency: CurrencyCode;
  customerProfileId: UserProfileId;
  stripeCustomerId?: string | null;
  orderId?: string | null;
  captureMethod?: "automatic" | "manual";
  saveForFutureUse?: boolean;
  metadata?: Record<string, string>;
  statementDescriptorSuffix?: string;
};

export type StripePaymentHistorySnapshot = {
  id: string;
  paymentRecordId?: PaymentRecordId | null;
  stripePaymentIntentId: string;
  amountMinor: number;
  currency: CurrencyCode;
  status: string;
  createdAt: string;
  description?: string | null;
};

export type StripeRuntimeConfig = {
  publishableKey: string;
  isTestMode: boolean;
  isPlaceholderKey: boolean;
};
