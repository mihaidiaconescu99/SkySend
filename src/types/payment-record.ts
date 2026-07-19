

export type PaymentRecordType = "payment" | "refund" | "partial_refund";
export const PAYMENT_RECORD_TYPES: readonly PaymentRecordType[] = [
  "payment",
  "refund",
  "partial_refund",
] as const;

export type PaymentRecordStatus = "pending" | "succeeded" | "failed";
export const PAYMENT_RECORD_STATUSES: readonly PaymentRecordStatus[] = [
  "pending",
  "succeeded",
  "failed",
] as const;

export interface PaymentRecord {
  id: string;
  orderId: string;
  profileId: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeRefundId: string | null;

  amountMinor: number;

  currency: string;
  type: PaymentRecordType;
  status: PaymentRecordStatus;
  failureReason: string | null;
  createdAt: string;
}

export interface CreatePaymentRecordInput {
  orderId: string;
  profileId: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeRefundId?: string | null;
  amountMinor: number;

  currency?: string;
  type: PaymentRecordType;
  status: PaymentRecordStatus;
  failureReason?: string | null;
}
