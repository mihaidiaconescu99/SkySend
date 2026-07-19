

export type OrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;

export type DispatchTiming =
  | "standard"
  | "priority"
  | "scheduled"
  | "critical";
export const DISPATCH_TIMINGS: readonly DispatchTiming[] = [
  "standard",
  "priority",
  "scheduled",
  "critical",
] as const;

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "refund_pending";
export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "refund_pending",
] as const;

export interface PricingSnapshot {

  version: string;
  baseFee: number;
  distanceFee: number;
  configMultiplier: number;
  dispatchAdjustment: number;
  scheduledAdjustment?: number;
  surcharges: PricingSurcharge[];
  subtotal: number;
  total: number;
}

export interface PricingSurcharge {
  type: string;
  amount: number;
  label: string;
}

export interface StoredHandoffPoint {
  id: string;
  label: string;
  location: { latitude: number; longitude: number };
  type?: string;
  source?: string;
  confidence?: string;
  reason?: string;
  locationType?: string;
  smartScore?: number;
  eligibility?: { state: string; message: string };

  [key: string]: unknown;
}

export interface HandoffPointsSnapshot {
  pickup: StoredHandoffPoint[];
  dropoff: StoredHandoffPoint[];
}

export interface Order {
  id: string;
  localOrderId: string;
  publicTrackingCode: string;
  recipientTrackingToken: string;
  senderProfileId: string;
  recipientEmail: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  pickupAddressId: string;
  dropoffAddressId: string;
  parcelId: string;
  status: OrderStatus;
  fulfillmentStatus: string | null;
  dispatchTiming: DispatchTiming;
  scheduledAt: string | null;
  droneClass: string;
  deliveryConfigurationId: string;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  totalAmountMinor: number;
  currency: string;
  pricingSnapshot: PricingSnapshot;
  handoffPointsSnapshot: HandoffPointsSnapshot | null;
  selectedPickupHandoffPoint: StoredHandoffPoint | null;
  selectedDropoffHandoffPoint: StoredHandoffPoint | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paymentStatus: PaymentStatus;
  refundStatus: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {

  localOrderId: string;

  publicTrackingCode: string;

  recipientTrackingToken: string;
  senderProfileId: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  pickupAddressId: string;
  dropoffAddressId: string;
  parcelId: string;
  status?: OrderStatus;
  fulfillmentStatus?: string | null;
  dispatchTiming: DispatchTiming;
  scheduledAt?: string | null;
  droneClass: string;
  deliveryConfigurationId: string;
  etaMinMinutes?: number | null;
  etaMaxMinutes?: number | null;
  totalAmountMinor: number;
  currency?: string;
  pricingSnapshot: PricingSnapshot;
  handoffPointsSnapshot?: HandoffPointsSnapshot | null;
  selectedPickupHandoffPoint?: StoredHandoffPoint | null;
  selectedDropoffHandoffPoint?: StoredHandoffPoint | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  paymentStatus?: PaymentStatus;
  refundStatus?: string | null;
  notes?: string | null;
}

export interface UpdateOrderInput {
  recipientEmail?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  status?: OrderStatus;
  fulfillmentStatus?: string | null;
  dispatchTiming?: DispatchTiming;
  scheduledAt?: string | null;
  droneClass?: string;
  deliveryConfigurationId?: string;
  etaMinMinutes?: number | null;
  etaMaxMinutes?: number | null;
  selectedPickupHandoffPoint?: StoredHandoffPoint | null;
  selectedDropoffHandoffPoint?: StoredHandoffPoint | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  paymentStatus?: PaymentStatus;
  refundStatus?: string | null;
  notes?: string | null;
}
