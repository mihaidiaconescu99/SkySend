export type BillingCustomerType = "individual" | "company";
export type BillingLocale = "ro" | "en";

export type BillingSnapshotInput = {
  customerType: BillingCustomerType;
  fullName?: string | null;
  companyLegalName?: string | null;
  taxIdentifier?: string | null;
  addressLine: string;
  city: string;
  region: string;
  countryCode: string;
  postalCode?: string | null;
  invoiceEmail: string;
  locale: BillingLocale;
  privacyAccepted: boolean;
};

export type SavedBillingProfile = Omit<
  BillingSnapshotInput,
  "privacyAccepted"
>;

export type CheckoutSubstep = "summary" | "billing" | "payment";

export type DeliveryCheckoutSessionStatus =
  | "active"
  | "payment_processing"
  | "finalizing"
  | "finalized"
  | "expired"
  | "cancelled"
  | "finalization_failed";

export type DeliveryCheckoutSession = {
  id: string;
  deliveryDraftId: string | null;
  localOrderId: string;
  currentStep: CheckoutSubstep;
  status: DeliveryCheckoutSessionStatus;
  totalAmountMinor: number;
  currency: string;
  locale: "ro" | "en";
  expiresAt: string;
  billing: BillingSnapshotInput | null;
  savedBillingProfile: SavedBillingProfile | null;
  stripePaymentIntentId: string | null;
  selectedPaymentMethodId: string | null;
  orderId: string | null;
  dispatchStartsAt: string | null;
};

export type BillingDocumentType = "invoice" | "credit_note";
export type BillingGenerationStatus =
  | "pending"
  | "generating"
  | "retry_scheduled"
  | "ready"
  | "failed";

export type BillingDocumentSummary = {
  id: string;
  type: BillingDocumentType;
  number: string;
  amountMinor: number;
  currency: string;
  issuedAt: string;
  status: BillingGenerationStatus;
  refundKind: "full" | "partial" | null;
  refundReason: string | null;
  downloadHref: string | null;
};
