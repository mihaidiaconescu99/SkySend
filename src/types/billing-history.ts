import type { PaymentStatus } from "@/types/domain";

export type BillingHistoryTransaction = {
  id: string;
  orderId: string;
  date: string;
  amountLabel: string;
  paymentMethodLabel: string;
  paymentMethodDetail: string;
  status: Extract<PaymentStatus, "paid" | "pending" | "failed" | "refunded">;
  receiptHref: string;
};
