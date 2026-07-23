import type { PaymentStatus } from "@/types/domain";

export type BillingHistoryTransaction = {
  id: string;
  orderId: string;
  date: string;
  amountLabel: string;
  status: Extract<PaymentStatus, "paid" | "pending" | "failed" | "refunded">;
  invoiceDownloadHref: string | null;
};
