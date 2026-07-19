import type { PaymentMethodId, UserProfileId } from "@/types/entities";

export type ClientPaymentMethodStatus = "active" | "test_ready" | "needs_review";

export type ClientStripePaymentMethod = {
  id: PaymentMethodId;
  label: string;
  brand: string;
  funding: string;
  country: string | null;
  last4: string;
  expiryLabel: string;
  isDefault: boolean;
  status: "active";
  providerReference: string;
  createdAt: string;
};

export type ClientSavedTestCard = {
  id: PaymentMethodId;
  userProfileId: UserProfileId;
  label: string;
  brand: string;
  last4: string;
  expiryLabel: string;
  isDefault: boolean;
  status: ClientPaymentMethodStatus;
  providerReference: string;
  createdAt: string;
  updatedAt: string;
};
