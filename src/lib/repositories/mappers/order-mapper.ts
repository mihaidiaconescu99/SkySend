import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBUpdate,
} from "@/lib/repositories/types";
import type { Json } from "@/types/database";
import {
  DISPATCH_TIMINGS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type CreateOrderInput,
  type DispatchTiming,
  type HandoffPointsSnapshot,
  type Order,
  type OrderStatus,
  type PaymentStatus,
  type PricingSnapshot,
  type PricingSurcharge,
  type PublicCodeAccessMode,
  type StoredHandoffPoint,
  type UpdateOrderInput,
} from "@/types/order";

const MIN_TOTAL_MINOR = 100;

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError(
      "validation_error",
      `Missing or invalid "${fieldName}".`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

function requireFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid "${fieldName}": expected finite number, got ${value}.`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, fieldName: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RepositoryError(
      "validation_error",
      `Invalid "${fieldName}": expected non-negative integer, got ${value}.`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): T {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid ${fieldName}: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid ${fieldName}: "${value}".`,
      { details: { value, allowed } },
    );
  }
  return value as T;
}

export function parseOrderStatus(value: unknown): OrderStatus {
  return parseEnum(value, ORDER_STATUSES, "order status");
}

export function parseDispatchTiming(value: unknown): DispatchTiming {
  return parseEnum(value, DISPATCH_TIMINGS, "dispatch_timing");
}

export function parsePaymentStatus(value: unknown): PaymentStatus {
  return parseEnum(value, PAYMENT_STATUSES, "payment_status");
}

export function parsePublicCodeAccessMode(value: unknown): PublicCodeAccessMode {
  return parseEnum(value ?? "view", ["view", "control"] as const, "public_code_access_mode");
}

export function parsePricingSnapshot(value: unknown): PricingSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid pricing_snapshot: expected object, got ${typeof value}.`,
      { details: { value } },
    );
  }
  const record = value as Record<string, unknown>;

  const surchargesRaw = record.surcharges;
  if (!Array.isArray(surchargesRaw)) {
    throw new RepositoryError(
      "validation_error",
      "pricing_snapshot.surcharges must be an array.",
      { details: { surchargesRaw } },
    );
  }
  const surcharges: PricingSurcharge[] = surchargesRaw.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new RepositoryError(
        "validation_error",
        `pricing_snapshot.surcharges[${index}] must be an object.`,
        { details: { item, index } },
      );
    }
    const surcharge = item as Record<string, unknown>;
    return {
      type: requireString(surcharge.type, `surcharges[${index}].type`),
      amount: requireFiniteNumber(
        surcharge.amount,
        `surcharges[${index}].amount`,
      ),
      label: requireString(surcharge.label, `surcharges[${index}].label`),
    };
  });

  const snapshot: PricingSnapshot = {
    version: requireString(record.version, "pricing_snapshot.version"),
    baseFee: requireFiniteNumber(record.baseFee, "pricing_snapshot.baseFee"),
    distanceFee: requireFiniteNumber(
      record.distanceFee,
      "pricing_snapshot.distanceFee",
    ),
    configMultiplier: requireFiniteNumber(
      record.configMultiplier,
      "pricing_snapshot.configMultiplier",
    ),
    dispatchAdjustment: requireFiniteNumber(
      record.dispatchAdjustment,
      "pricing_snapshot.dispatchAdjustment",
    ),
    surcharges,
    subtotal: requireFiniteNumber(
      record.subtotal,
      "pricing_snapshot.subtotal",
    ),
    total: requireFiniteNumber(record.total, "pricing_snapshot.total"),
  };

  if (record.scheduledAdjustment !== undefined) {
    snapshot.scheduledAdjustment = requireFiniteNumber(
      record.scheduledAdjustment,
      "pricing_snapshot.scheduledAdjustment",
    );
  }

  return snapshot;
}

export function parseStoredHandoffPoint(value: unknown): StoredHandoffPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid stored handoff point: expected object, got ${typeof value}.`,
      { details: { value } },
    );
  }
  const record = value as Record<string, unknown>;
  const location = record.location;
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    throw new RepositoryError(
      "validation_error",
      "Stored handoff point is missing a `location` object.",
      { details: { value } },
    );
  }
  const locationRecord = location as Record<string, unknown>;
  return {
    ...(record as StoredHandoffPoint),
    id: requireString(record.id, "handoff_point.id"),
    label: requireString(record.label, "handoff_point.label"),
    location: {
      latitude: requireFiniteNumber(
        locationRecord.latitude,
        "handoff_point.location.latitude",
      ),
      longitude: requireFiniteNumber(
        locationRecord.longitude,
        "handoff_point.location.longitude",
      ),
    },
  };
}

export function parseHandoffPointsSnapshot(
  value: unknown,
): HandoffPointsSnapshot | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid handoff_points_snapshot: expected object or null, got ${typeof value}.`,
      { details: { value } },
    );
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.pickup) || !Array.isArray(record.dropoff)) {
    throw new RepositoryError(
      "validation_error",
      "handoff_points_snapshot must have `pickup` and `dropoff` arrays.",
      { details: { value } },
    );
  }
  return {
    pickup: record.pickup.map(parseStoredHandoffPoint),
    dropoff: record.dropoff.map(parseStoredHandoffPoint),
  };
}

export function rowToOrder(row: DBRow<"orders">): Order {
  return {
    id: requireString(row.id, "id"),
    localOrderId: requireString(row.local_order_id, "local_order_id"),
    publicTrackingCode: requireString(
      row.public_tracking_code,
      "public_tracking_code",
    ),
    recipientTrackingToken: requireString(
      row.recipient_tracking_token,
      "recipient_tracking_token",
    ),
    publicCodeAccessMode: parsePublicCodeAccessMode(row.public_code_access_mode),
    senderProfileId: requireString(row.sender_profile_id, "sender_profile_id"),
    recipientEmail: row.recipient_email ?? null,
    recipientName: row.recipient_name ?? null,
    recipientPhone: row.recipient_phone ?? null,
    pickupAddressId: requireString(row.pickup_address_id, "pickup_address_id"),
    dropoffAddressId: requireString(
      row.dropoff_address_id,
      "dropoff_address_id",
    ),
    parcelId: requireString(row.parcel_id, "parcel_id"),
    status: parseOrderStatus(row.status),
    fulfillmentStatus: row.fulfillment_status ?? null,
    dispatchTiming: parseDispatchTiming(row.dispatch_timing),
    scheduledAt: row.scheduled_at ?? null,
    droneClass: requireString(row.drone_class, "drone_class"),
    deliveryConfigurationId: requireString(
      row.delivery_configuration_id,
      "delivery_configuration_id",
    ),
    etaMinMinutes:
      row.eta_min_minutes === null || row.eta_min_minutes === undefined
        ? null
        : requireNonNegativeInteger(row.eta_min_minutes, "eta_min_minutes"),
    etaMaxMinutes:
      row.eta_max_minutes === null || row.eta_max_minutes === undefined
        ? null
        : requireNonNegativeInteger(row.eta_max_minutes, "eta_max_minutes"),
    totalAmountMinor: requireNonNegativeInteger(
      row.total_amount_minor,
      "total_amount_minor",
    ),
    currency: requireString(row.currency, "currency"),
    pricingSnapshot: parsePricingSnapshot(row.pricing_snapshot),
    handoffPointsSnapshot: parseHandoffPointsSnapshot(
      row.handoff_points_snapshot,
    ),
    selectedPickupHandoffPoint:
      row.selected_pickup_handoff_point === null
        ? null
        : parseStoredHandoffPoint(row.selected_pickup_handoff_point),
    selectedDropoffHandoffPoint:
      row.selected_dropoff_handoff_point === null
        ? null
        : parseStoredHandoffPoint(row.selected_dropoff_handoff_point),
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeChargeId: row.stripe_charge_id ?? null,
    paidAt: row.paid_at ?? null,
    paymentStatus: parsePaymentStatus(row.payment_status),
    refundStatus: row.refund_status ?? null,
    notes: row.notes ?? null,
    createdAt: requireString(row.created_at, "created_at"),
    updatedAt: requireString(row.updated_at, "updated_at"),
  };
}

export function createInputToRow(
  input: CreateOrderInput,
): DBInsert<"orders"> {
  const localOrderId = requireString(input.localOrderId, "localOrderId");
  const publicTrackingCode = requireString(
    input.publicTrackingCode,
    "publicTrackingCode",
  );
  const recipientTrackingToken = requireString(
    input.recipientTrackingToken,
    "recipientTrackingToken",
  );
  const senderProfileId = requireString(
    input.senderProfileId,
    "senderProfileId",
  );
  const pickupAddressId = requireString(
    input.pickupAddressId,
    "pickupAddressId",
  );
  const dropoffAddressId = requireString(
    input.dropoffAddressId,
    "dropoffAddressId",
  );
  const parcelId = requireString(input.parcelId, "parcelId");
  const dispatchTiming = parseDispatchTiming(input.dispatchTiming);
  const droneClass = requireString(input.droneClass, "droneClass");
  const deliveryConfigurationId = requireString(
    input.deliveryConfigurationId,
    "deliveryConfigurationId",
  );
  const totalAmountMinor = requireNonNegativeInteger(
    input.totalAmountMinor,
    "totalAmountMinor",
  );
  if (totalAmountMinor < MIN_TOTAL_MINOR) {
    throw new RepositoryError(
      "validation_error",
      `totalAmountMinor must be >= ${MIN_TOTAL_MINOR}; got ${totalAmountMinor}.`,
      { details: { totalAmountMinor } },
    );
  }
  const pricingSnapshot = parsePricingSnapshot(input.pricingSnapshot);
  if (pricingSnapshot.total < MIN_TOTAL_MINOR) {
    throw new RepositoryError(
      "validation_error",
      `pricing_snapshot.total must be >= ${MIN_TOTAL_MINOR}; got ${pricingSnapshot.total}.`,
      { details: { total: pricingSnapshot.total } },
    );
  }

  const row: DBInsert<"orders"> = {
    local_order_id: localOrderId,
    public_tracking_code: publicTrackingCode,
    recipient_tracking_token: recipientTrackingToken,
    public_code_access_mode: input.publicCodeAccessMode ?? "view",
    sender_profile_id: senderProfileId,
    pickup_address_id: pickupAddressId,
    dropoff_address_id: dropoffAddressId,
    parcel_id: parcelId,
    dispatch_timing: dispatchTiming,
    drone_class: droneClass,
    delivery_configuration_id: deliveryConfigurationId,
    total_amount_minor: totalAmountMinor,
    pricing_snapshot: pricingSnapshot as unknown as Json,
  };

  if (input.recipientEmail !== undefined) {
    row.recipient_email = input.recipientEmail;
  }
  if (input.recipientName !== undefined) {
    row.recipient_name = input.recipientName;
  }
  if (input.recipientPhone !== undefined) {
    row.recipient_phone = input.recipientPhone;
  }
  if (input.status !== undefined) {
    row.status = parseOrderStatus(input.status);
  }
  if (input.fulfillmentStatus !== undefined) {
    row.fulfillment_status = input.fulfillmentStatus;
  }
  if (input.scheduledAt !== undefined) {
    row.scheduled_at = input.scheduledAt;
  }
  if (input.etaMinMinutes !== undefined) {
    row.eta_min_minutes =
      input.etaMinMinutes === null
        ? null
        : requireNonNegativeInteger(input.etaMinMinutes, "etaMinMinutes");
  }
  if (input.etaMaxMinutes !== undefined) {
    row.eta_max_minutes =
      input.etaMaxMinutes === null
        ? null
        : requireNonNegativeInteger(input.etaMaxMinutes, "etaMaxMinutes");
  }
  if (input.currency !== undefined) {
    row.currency = requireString(input.currency, "currency");
  }
  if (input.handoffPointsSnapshot !== undefined) {
    row.handoff_points_snapshot =
      input.handoffPointsSnapshot === null
        ? null
        : (input.handoffPointsSnapshot as unknown as Json);
  }
  if (input.selectedPickupHandoffPoint !== undefined) {
    row.selected_pickup_handoff_point =
      input.selectedPickupHandoffPoint === null
        ? null
        : (input.selectedPickupHandoffPoint as unknown as Json);
  }
  if (input.selectedDropoffHandoffPoint !== undefined) {
    row.selected_dropoff_handoff_point =
      input.selectedDropoffHandoffPoint === null
        ? null
        : (input.selectedDropoffHandoffPoint as unknown as Json);
  }
  if (input.stripePaymentIntentId !== undefined) {
    row.stripe_payment_intent_id = input.stripePaymentIntentId;
  }
  if (input.stripeChargeId !== undefined) {
    row.stripe_charge_id = input.stripeChargeId;
  }
  if (input.paidAt !== undefined) {
    row.paid_at = input.paidAt;
  }
  if (input.paymentStatus !== undefined) {
    row.payment_status = parsePaymentStatus(input.paymentStatus);
  }
  if (input.refundStatus !== undefined) {
    row.refund_status = input.refundStatus;
  }
  if (input.notes !== undefined) {
    row.notes = input.notes;
  }

  return row;
}

export function updateInputToRow(
  input: UpdateOrderInput,
): DBUpdate<"orders"> {
  const payload: DBUpdate<"orders"> = {};

  if (input.publicCodeAccessMode !== undefined) {
    payload.public_code_access_mode = parsePublicCodeAccessMode(
      input.publicCodeAccessMode,
    );
  }

  if (input.recipientEmail !== undefined) {
    payload.recipient_email = input.recipientEmail;
  }
  if (input.recipientName !== undefined) {
    payload.recipient_name = input.recipientName;
  }
  if (input.recipientPhone !== undefined) {
    payload.recipient_phone = input.recipientPhone;
  }
  if (input.status !== undefined) {
    payload.status = parseOrderStatus(input.status);
  }
  if (input.fulfillmentStatus !== undefined) {
    payload.fulfillment_status = input.fulfillmentStatus;
  }
  if (input.dispatchTiming !== undefined) {
    payload.dispatch_timing = parseDispatchTiming(input.dispatchTiming);
  }
  if (input.scheduledAt !== undefined) {
    payload.scheduled_at = input.scheduledAt;
  }
  if (input.droneClass !== undefined) {
    payload.drone_class = requireString(input.droneClass, "droneClass");
  }
  if (input.deliveryConfigurationId !== undefined) {
    payload.delivery_configuration_id = requireString(
      input.deliveryConfigurationId,
      "deliveryConfigurationId",
    );
  }
  if (input.etaMinMinutes !== undefined) {
    payload.eta_min_minutes =
      input.etaMinMinutes === null
        ? null
        : requireNonNegativeInteger(input.etaMinMinutes, "etaMinMinutes");
  }
  if (input.etaMaxMinutes !== undefined) {
    payload.eta_max_minutes =
      input.etaMaxMinutes === null
        ? null
        : requireNonNegativeInteger(input.etaMaxMinutes, "etaMaxMinutes");
  }
  if (input.selectedPickupHandoffPoint !== undefined) {
    payload.selected_pickup_handoff_point =
      input.selectedPickupHandoffPoint === null
        ? null
        : (input.selectedPickupHandoffPoint as unknown as Json);
  }
  if (input.selectedDropoffHandoffPoint !== undefined) {
    payload.selected_dropoff_handoff_point =
      input.selectedDropoffHandoffPoint === null
        ? null
        : (input.selectedDropoffHandoffPoint as unknown as Json);
  }
  if (input.stripePaymentIntentId !== undefined) {
    payload.stripe_payment_intent_id = input.stripePaymentIntentId;
  }
  if (input.stripeChargeId !== undefined) {
    payload.stripe_charge_id = input.stripeChargeId;
  }
  if (input.paidAt !== undefined) {
    payload.paid_at = input.paidAt;
  }
  if (input.paymentStatus !== undefined) {
    payload.payment_status = parsePaymentStatus(input.paymentStatus);
  }
  if (input.refundStatus !== undefined) {
    payload.refund_status = input.refundStatus;
  }
  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError(
      "validation_error",
      "Update payload contains no recognised fields.",
    );
  }

  return payload;
}
