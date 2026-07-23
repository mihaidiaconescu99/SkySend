import type { DeliveryUrgency, OrderStatus, PaymentStatus } from "@/types/domain";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

export type ClientPaymentStatus = Extract<
  PaymentStatus,
  "paid" | "pending" | "failed" | "refunded"
> | "unpaid" | "processing";

export type ClientOrderPaymentSnapshot = {
  id: string | null;
  status: ClientPaymentStatus;
  statusLabel: string;
  methodLabel: string;
  methodDetail: string;
  amountLabel: string;
  hasPaymentIssue: boolean;
};

export type ClientOrderStatusFilter =
  | "all"
  | "active"
  | "completed"
  | "failed"
  | "scheduled"
  | "cancelled";

export type ClientOrderSummary = {
  id: string;
  href: string;
  pickupArea: string;
  dropoffArea: string;
  status: OrderStatus;
  statusFilter: ClientOrderStatusFilter;
  urgency: DeliveryUrgency;
  createdAt: string;
  scheduledFor?: string | null;
  estimatedCostLabel: string;
  payment: ClientOrderPaymentSnapshot;
  operationalStateLabel?: string | null;
  invoice?: {
    status: "pending" | "generating" | "retry_scheduled" | "ready" | "failed";
    downloadHref: string | null;
    number: string | null;
  } | null;
  isRuntimeOrder?: boolean;
  runtimeOrder?: CreatedDeliveryOrder;
};

export type ClientOrderDetail = ClientOrderSummary & {
  cancellationReason?: string | null;
  completedAt?: string | null;
  progressValue: number;
  progressLabel: string;
  paymentStatusLabel?: string | null;
  paymentId?: string | null;
  paymentMethodLabel?: string | null;
  paymentMethodDetail?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupPointNote?: string | null;
  dropoffPointNote?: string | null;
  parcelSummary?: string | null;
  recommendedDroneClass?: {
    id: string;
    name: string;
    shortDescription: string;
  } | null;
  ecoEstimate?: {
    co2SavedLabel: string;
    roadDistanceLabel: string;
    methodologyNote: string;
  } | null;
  proofSummary?: string | null;
  failureSummary?: string | null;
  fallbackSummary?: string | null;
  pickupCoordinates: {
    latitude: number;
    longitude: number;
  };
  dropoffCoordinates: {
    latitude: number;
    longitude: number;
  };
  timeline: {
    key: string;
    label: string;
    date: string | null;
    status: "done" | "current" | "upcoming";
  }[];
};

export type ClientFailedOrderSummary = ClientOrderSummary & {
  failureReason: string;
  fallbackUsed: boolean;
  fallbackLabel: string;
  paymentIssueLabel: string | null;
};
