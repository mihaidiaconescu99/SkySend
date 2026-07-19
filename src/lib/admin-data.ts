import { activeHub } from "@/constants/hub";
import { serviceAreaConfig } from "@/constants/service-area";
import {
  readCreatedDeliveryOrders,
  updateCreatedDeliveryOrderFulfillment,
} from "@/lib/create-delivery-submit";
import {
  appendAdminAuditEvents,
  createAdminAuditEvent,
  readAdminOrderAuditEvents,
} from "@/lib/admin-audit";
import type {
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
  CreateDeliveryAddressPayload,
  CreateDeliverySelectedPointPayload,
} from "@/types/create-delivery";
import type {
  DeliveryUrgency,
  DroneClass,
  OrderStatus,
} from "@/types/domain";
import type {
  AddressSnapshot,
} from "@/types/entities";
import type { Json } from "@/types/database";
import type {
  AdminAuditActor,
  AdminCustomerNotificationStatus,
  AdminCustomerSnapshot,
  AdminDataSource,
  AdminDeliveryConfigurationSnapshot,
  AdminEditableField,
  AdminFailureReasonCode,
  AdminMeetingPointSnapshot,
  AdminOrder,
  AdminOrderEditablePatch,
  AdminOrderMeetingPoints,
  AdminParcelLocation,
  AdminParcelStatus,
  AdminPaymentSnapshot,
  AdminPaymentStatus,
  AdminPointSnapshot,
  AdminPriority,
  AdminRefundSnapshot,
  AdminRefundStatus,
  AdminResolutionStatus,
  ContactMessage,
  ContactMessageStatus,
  ExportFormat,
  ExportKind,
  ExportRequest,
  ExportRequestStatus,
  FailedOrderRecord,
  LockerRecoveryIncident,
  LockerRecoveryStatus,
  OperationalPlatformStatus,
  OperationalSettings,
} from "@/types/admin";

const adminOrderOverridesStorageKey = "skysend:admin:order-overrides";
const adminContactMessagesStorageKey = "skysend:admin:contact-messages";
const adminOperationalSettingsStorageKey = "skysend:admin:operational-settings";
const adminExportRequestsStorageKey = "skysend:admin:export-requests";

export const adminOrderStatusLabels: Record<OrderStatus, string> = {
  draft: "Ciornă",
  scheduled: "Programată",
  queued: "În așteptare",
  in_flight: "În zbor",
  delivered: "Livrare finalizată",
  failed: "Livrare eșuată",
  cancelled: "Comandă anulată",
  returned: "Colet returnat",
};

export const adminUrgencyLabels: Record<DeliveryUrgency | "scheduled", string> = {
  standard: "Standard",
  priority: "Prioritară",
  critical: "Critică",
  scheduled: "Programată",
};

export const adminPaymentStatusLabels: Record<AdminPaymentStatus, string> = {
  pending: "În așteptare",
  authorized: "Autorizată",
  paid: "Plătită",
  refunded: "Rambursată",
  failed: "Eșuată",
  unpaid: "Neplătită",
  processing: "În procesare",
  refund_pending: "Rambursare în așteptare",
  missing: "Plată indisponibilă",
};

export const adminRefundStatusLabels: Record<AdminRefundStatus, string> = {
  not_required: "Nu necesită rambursare",
  pending: "În așteptare",
  started: "În curs",
  completed: "Finalizată",
  failed: "Eșuată",
  unknown: "Necunoscută",
};

export const adminParcelStatusLabels: Record<AdminParcelStatus, string> = {
  unconfirmed: "Neconfirmat",
  waiting_for_load: "Așteaptă încărcare",
  loaded: "Încărcat",
  in_transit: "În tranzit",
  delivered: "Livrat",
  returned_to_hub: "Returnat la hub",
  secured_in_locker: "Securizat în locker",
  unknown: "Necunoscut",
};

export const adminFailureReasonLabels: Record<AdminFailureReasonCode, string> = {
  meeting_point_confirmation_timeout:
    "Clientul nu a confirmat punctul de întâlnire în timp util",
  customer_rejected_meeting_points: "Clientul a refuzat punctele propuse",
  parcel_load_timeout: "Coletul nu a fost încărcat în timp util",
  parcel_unload_timeout: "Coletul nu a fost descărcat în timp util",
  customer_unavailable: "Clientul nu a fost disponibil",
  payload_over_limit: "Coletul a depășit limita operațională",
  locker_detached_recovery_required: "Locker detașat, recuperare necesară",
  system_cancelled: "Livrarea a fost anulată de sistem",
  handoff_zone_unavailable: "Punctul de predare nu a fost disponibil",
  payment_failed: "Plata a eșuat",
  return_to_hub_required: "Coletul trebuie returnat la hub",
  no_suitable_pickup_meeting_point:
    "Nu există punct de întâlnire potrivit pentru ridicare",
  no_suitable_dropoff_meeting_point:
    "Nu există punct de întâlnire potrivit pentru livrare",
  unknown: "Motiv necunoscut",
};

export const adminResolutionStatusLabels: Record<AdminResolutionStatus, string> = {
  open: "Deschis",
  in_progress: "În lucru",
  waiting_for_customer: "Așteaptă clientul",
  resolved: "Rezolvat",
  archived: "Arhivat",
};

export const adminCustomerNotificationStatusLabels: Record<
  AdminCustomerNotificationStatus,
  string
> = {
  not_required: "Nu este necesară",
  not_sent: "Netrimisă",
  queued: "În așteptare",
  sent: "Trimisă",
  prepared: "Pregătită",
  unknown: "Necunoscută",
};

export const adminPriorityLabels: Record<AdminPriority, string> = {
  low: "Scăzută",
  normal: "Normală",
  high: "Ridicată",
  urgent: "Urgentă",
};

export const lockerRecoveryStatusLabels: Record<LockerRecoveryStatus, string> = {
  locker_detached: "Locker detașat",
  operator_dispatched: "Operator trimis",
  locker_recovered: "Locker recuperat",
  parcel_returned_to_hub: "Colet returnat la hub",
  customer_notified: "Client notificat",
  resolved: "Rezolvat",
};

export const contactMessageStatusLabels: Record<ContactMessageStatus, string> = {
  new: "Nou",
  read: "Citit",
  replied: "Răspuns trimis",
  in_progress: "În lucru",
  prepared_reply: "Răspuns pregătit",
  archived: "Arhivat",
};

export const operationalPlatformStatusLabels: Record<
  OperationalPlatformStatus,
  string
> = {
  active: "Activă",
  maintenance: "Mentenanță",
};

const exportRequestStatusLabels: Record<ExportRequestStatus, string> = {
  prepared: "Pregătit",
  queued: "În așteptare",
  completed: "Finalizat",
  failed: "Eșuat",
  unsupported: "Nepregătit",
};

const adminDroneClassLabels: Record<DroneClass, string> = {
  light_swift: "AER expres",
  light_secure: "AER securizat",
  medium_standard: "NOVA standard",
  medium_stabilized: "NOVA stabilizat",
  medium_long_range: "NOVA rază extinsă",
  heavy_cargo: "ORIGIN cargo",
  heavy_max: "ORIGIN max",
  light_express: "AER expres",
  standard_courier: "NOVA curier",
  fragile_care: "NOVA fragil",
  long_range: "NOVA rază extinsă",
};

export const defaultEditableOrderFields: readonly AdminEditableField[] = [
  "status",
  "parcelStatus",
  "meetingPoints",
  "estimatedWeightKg",
  "detectedWeightKg",
  "dimensionsCm",
  "price",
  "paymentStatus",
  "refundStatus",
  "refundReason",
  "internalNotes",
  "failureReasonCode",
  "failureReasonLabel",
  "resolutionStatus",
  "customerNotificationStatus",
];

type AdminOrderOverrideRecord = {
  orderId: string;
  patch: AdminOrderEditablePatch;
  updatedAt: string;
  updatedBy: string | null;
};

type AdminOrderUpdateResult =
  | {
      ok: true;
      order: AdminOrder;
      auditEvents: AdminOrder["auditTrail"];
      persistence: "local_only";
    }
  | {
      ok: false;
      reason: "not_found" | "storage_unavailable";
      order: null;
      auditEvents: [];
    };

type AdminBulkOrderActionResult =
  | {
      ok: true;
      affectedOrders: number;
      auditEvents: AdminOrder["auditTrail"];
      persistence: "local_only";
    }
  | {
      ok: false;
      reason: "storage_unavailable";
      affectedOrders: 0;
      auditEvents: [];
    };

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createAdminRecordId(prefix: string) {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${entropy}`;
}

function toJsonValue(value: unknown): Json {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Json;
}

function readJsonArray<T>(storageKey: string): T[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return Array.isArray(parsedValue) ? (parsedValue as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(storageKey: string, values: T[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(values));
}

function readJsonObject<T extends Record<string, unknown>>(storageKey: string): T | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
      ? (parsedValue as T)
      : null;
  } catch {
    return null;
  }
}

function writeJsonObject<T extends Record<string, unknown>>(
  storageKey: string,
  value: T,
) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function makeAddressSnapshot(address: CreateDeliveryAddressPayload): AddressSnapshot {
  return {
    formattedAddress: address.formattedAddress,
    city: address.city ?? "Necunoscut",
    county: address.county ?? "Necunoscut",
    country: address.country ?? "Necunoscut",
    postalCode: address.postalCode,
    location: address.location,
  };
}

function makePointFromRuntimeAddress(
  id: string,
  label: string,
  address: CreateDeliveryAddressPayload,
): AdminPointSnapshot {
  const snapshot = makeAddressSnapshot(address);

  return {
    id,
    label: snapshot.formattedAddress || label,
    address: snapshot,
    coordinates: snapshot.location,
    contact: null,
    notes: address.notes,
    source: "runtime_local",
  };
}

function makeMeetingPointFromRuntimePoint(
  point: CreateDeliverySelectedPointPayload | undefined,
  source: AdminDataSource,
): AdminMeetingPointSnapshot | null {
  if (!point) {
    return null;
  }

  return {
    id: point.id,
    label: point.label,
    type: point.type,
    description: point.description,
    coordinates: point.location,
    distanceFromOriginMeters: point.distanceFromOriginMeters,
    source,
  };
}

function makeRuntimeCustomer(order: CreatedDeliveryOrder): AdminCustomerSnapshot {
  return {
    profileId: order.payload.userId ?? null,
    clerkUserId: order.payload.userId ?? null,
    name: "Client din comandă locală",
    email: null,
    phoneE164: null,
    companyName: null,
  };
}

function makeConfigurationFromRuntime(
  order: CreatedDeliveryOrder,
): AdminDeliveryConfigurationSnapshot | null {
  const configuration = order.payload.selectedDeliveryConfiguration;

  if (!configuration) {
    return {
      id: null,
      platform: null,
      moduleName: null,
      droneClass: order.payload.recommendedDroneClass,
      label: adminDroneClassLabels[order.payload.recommendedDroneClass],
      maxPayloadKg: null,
      maxVolumeLiters: null,
      maxDimensionsCm: null,
    };
  }

  return {
    id: configuration.id,
    platform: configuration.platform,
    moduleName: configuration.moduleName,
    droneClass: configuration.mappedDroneClass,
    label: `${configuration.platform.toUpperCase()} / ${configuration.moduleName}`,
    maxPayloadKg: configuration.capacity.maxPayloadKg,
    maxVolumeLiters: configuration.capacity.maxVolumeLiters,
    maxDimensionsCm: configuration.capacity.maxDimensionsCm,
  };
}

function makeRuntimePaymentSnapshot(order: CreatedDeliveryOrder): AdminPaymentSnapshot {
  const status = order.paymentStatus ?? "missing";

  return {
    id: order.stripePaymentIntentId ?? null,
    provider: order.stripePaymentIntentId ? "stripe" : null,
    status,
    statusLabel: adminPaymentStatusLabels[status],
    amount: order.payload.estimatedPrice,
    capturedAmount: status === "paid" ? order.payload.estimatedPrice : null,
    providerReference: order.stripePaymentIntentId ?? null,
    paidAt: order.paidAt ?? null,
    failedAt: status === "failed" ? order.payload.createdAt : null,
    failureReason: order.paymentStatus === "failed" ? "Plata a eșuat." : null,
  };
}

function makeRefundSnapshot({
  runtimeRefundStatus,
  runtimePaymentStatus,
  reason,
}: {
  runtimeRefundStatus?: AdminRefundStatus;
  runtimePaymentStatus?: CreatedDeliveryPaymentStatus;
  reason?: string | null;
}): AdminRefundSnapshot {
  const status =
    runtimeRefundStatus ??
    (runtimePaymentStatus === "refund_pending"
      ? "pending"
      : runtimePaymentStatus === "refunded"
        ? "completed"
        : "not_required");

  return {
    status,
    statusLabel: adminRefundStatusLabels[status],
    amount: null,
    reason: reason ?? null,
  };
}

function mapCreatedStatusToOrderStatus(order: CreatedDeliveryOrder): OrderStatus {
  switch (order.fulfillmentStatus) {
    case "active_mission":
      return "in_flight";
    case "completed_mission":
      return "delivered";
    case "failed_mission":
    case "fallback_required":
      return "failed";
    case "canceled":
      return "cancelled";
    case "order_created":
    case undefined:
      if (order.status === "pending_review") {
        return "queued";
      }

      return "scheduled";
  }
}

function getRuntimeParcelStatus(order: CreatedDeliveryOrder): AdminParcelStatus {
  if (order.warehousePickupRequired) {
    return "secured_in_locker";
  }

  switch (order.fulfillmentStatus) {
    case "completed_mission":
      return "delivered";
    case "active_mission":
      return "in_transit";
    case "failed_mission":
    case "fallback_required":
      return "loaded";
    case "order_created":
    case "canceled":
    case undefined:
      return "waiting_for_load";
  }
}

export function inferFailureReasonCodeFromText(
  reason: string | null | undefined,
): AdminFailureReasonCode {
  const normalizedReason = (reason ?? "").toLocaleLowerCase("ro-RO");

  if (!normalizedReason) {
    return "unknown";
  }

  if (
    normalizedReason.includes("payload") ||
    normalizedReason.includes("weight") ||
    normalizedReason.includes("greu") ||
    normalizedReason.includes("limita")
  ) {
    return "payload_over_limit";
  }

  if (
    normalizedReason.includes("blocked") ||
    normalizedReason.includes("obstruction") ||
    normalizedReason.includes("reroute") ||
    normalizedReason.includes("handoff")
  ) {
    return "handoff_zone_unavailable";
  }

  if (normalizedReason.includes("payment") || normalizedReason.includes("plata")) {
    return "payment_failed";
  }

  if (normalizedReason.includes("cancel")) {
    return "system_cancelled";
  }

  if (normalizedReason.includes("locker") && normalizedReason.includes("recover")) {
    return "locker_detached_recovery_required";
  }

  return "unknown";
}

function inferRuntimeFailureReasonCode(
  order: CreatedDeliveryOrder,
): AdminFailureReasonCode | null {
  if (order.warehousePickupRequired) {
    return "locker_detached_recovery_required";
  }

  if (order.fallbackOutcome === "no_suitable_pickup_meeting_point") {
    return "no_suitable_pickup_meeting_point";
  }

  if (order.fallbackOutcome === "delivery_failed_return_required") {
    return "return_to_hub_required";
  }

  if (order.paymentStatus === "failed") {
    return "payment_failed";
  }

  if (mapCreatedStatusToOrderStatus(order) === "cancelled") {
    return "system_cancelled";
  }

  if (mapCreatedStatusToOrderStatus(order) === "failed") {
    return inferFailureReasonCodeFromText(order.fallbackReason);
  }

  return null;
}

function getPriorityForFailure(
  reasonCode: AdminFailureReasonCode | null,
  urgency: DeliveryUrgency | "scheduled" | null,
): AdminPriority {
  if (reasonCode === "locker_detached_recovery_required") {
    return "urgent";
  }

  if (reasonCode === "payload_over_limit" || urgency === "critical") {
    return "high";
  }

  if (reasonCode === "unknown") {
    return "normal";
  }

  return "normal";
}

function isRefundStatus(value: string | undefined): value is AdminRefundStatus {
  return (
    value === "not_required" ||
    value === "pending" ||
    value === "started" ||
    value === "completed" ||
    value === "failed" ||
    value === "unknown"
  );
}

function getParcelDimensionsFromRuntime(order: CreatedDeliveryOrder) {
  const { parcel } = order.payload;
  const manualDimensions =
    typeof parcel.lengthCm === "number" &&
    typeof parcel.widthCm === "number" &&
    typeof parcel.heightCm === "number"
      ? {
          lengthCm: parcel.lengthCm,
          widthCm: parcel.widthCm,
          heightCm: parcel.heightCm,
        }
      : null;

  return (
    manualDimensions ??
    parcel.confirmedProfile?.estimatedDimensions.dimensionsCm ??
    parcel.assistantResult?.suggestedDimensionsCm ??
    null
  );
}

function getRuntimeEstimatedWeight(order: CreatedDeliveryOrder) {
  const { parcel } = order.payload;

  return (
    parcel.weightKg ??
    parcel.confirmedProfile?.estimatedWeightRange.midpointKg ??
    (parcel.confirmedProfile
      ? (parcel.confirmedProfile.estimatedWeightRange.minKg +
          parcel.confirmedProfile.estimatedWeightRange.maxKg) /
        2
      : null) ??
    parcel.assistantResult?.estimatedWeightKg ??
    null
  );
}

function getRuntimeAiEstimateLabel(order: CreatedDeliveryOrder) {
  return (
    order.payload.parcel.estimatedWeightRange ??
    order.payload.parcel.assistantResult?.estimatedWeightRange ??
    null
  );
}

function getOverrideRecords() {
  return readJsonObject<Record<string, AdminOrderOverrideRecord>>(
    adminOrderOverridesStorageKey,
  );
}

function writeOverrideRecords(records: Record<string, AdminOrderOverrideRecord>) {
  writeJsonObject(adminOrderOverridesStorageKey, records);
}

function getOrderPatchValue(
  order: AdminOrder,
  field: AdminEditableField,
): unknown {
  switch (field) {
    case "status":
      return order.status;
    case "parcelStatus":
      return order.parcelStatus;
    case "meetingPoints":
      return order.meetingPoints;
    case "estimatedWeightKg":
      return order.parcel.estimatedWeightKg;
    case "detectedWeightKg":
      return order.parcel.detectedWeightKg;
    case "dimensionsCm":
      return order.parcel.dimensionsCm;
    case "price":
      return order.price;
    case "paymentStatus":
      return order.payment.status;
    case "refundStatus":
      return order.refund.status;
    case "refundReason":
      return order.refund.reason;
    case "internalNotes":
      return order.internalNotes;
    case "failureReasonCode":
      return order.failureReasonCode;
    case "failureReasonLabel":
      return order.failureReasonLabel;
    case "resolutionStatus":
      return order.resolutionStatus;
    case "customerNotificationStatus":
      return order.customerNotificationStatus;
  }
}

function valuesAreEqual(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function applyOrderPatch(order: AdminOrder, patch: AdminOrderEditablePatch): AdminOrder {
  const nextOrder: AdminOrder = {
    ...order,
    persistence:
      order.source === "supabase" ? order.persistence : "local_only",
    source:
      order.source === "supabase" ? order.source : order.source,
    updatedAt: new Date().toISOString(),
    auditTrail: readAdminOrderAuditEvents(order.id),
  };

  if (patch.status) {
    nextOrder.status = patch.status;
    nextOrder.statusLabel = adminOrderStatusLabels[patch.status];
  }

  if (patch.parcelStatus) {
    nextOrder.parcelStatus = patch.parcelStatus;
    nextOrder.parcelStatusLabel = adminParcelStatusLabels[patch.parcelStatus];
  }

  if (patch.meetingPoints) {
    nextOrder.meetingPoints = patch.meetingPoints;
  }

  if ("estimatedWeightKg" in patch) {
    nextOrder.parcel = {
      ...nextOrder.parcel,
      estimatedWeightKg: patch.estimatedWeightKg ?? null,
    };
  }

  if ("detectedWeightKg" in patch) {
    nextOrder.parcel = {
      ...nextOrder.parcel,
      detectedWeightKg: patch.detectedWeightKg ?? null,
    };
  }

  if ("dimensionsCm" in patch) {
    nextOrder.parcel = {
      ...nextOrder.parcel,
      dimensionsCm: patch.dimensionsCm ?? null,
    };
  }

  if ("price" in patch) {
    nextOrder.price = patch.price ?? null;
    nextOrder.payment = {
      ...nextOrder.payment,
      amount: patch.price ?? nextOrder.payment.amount,
    };
  }

  if (patch.paymentStatus) {
    nextOrder.payment = {
      ...nextOrder.payment,
      status: patch.paymentStatus,
      statusLabel: adminPaymentStatusLabels[patch.paymentStatus],
    };
  }

  if (patch.refundStatus) {
    nextOrder.refund = {
      ...nextOrder.refund,
      status: patch.refundStatus,
      statusLabel: adminRefundStatusLabels[patch.refundStatus],
    };
  }

  if ("refundReason" in patch) {
    nextOrder.refund = {
      ...nextOrder.refund,
      reason: patch.refundReason ?? null,
    };
  }

  if ("internalNotes" in patch) {
    nextOrder.internalNotes = patch.internalNotes ?? null;
  }

  if ("failureReasonCode" in patch) {
    nextOrder.failureReasonCode = patch.failureReasonCode ?? null;
    nextOrder.failureReasonLabel = patch.failureReasonCode
      ? adminFailureReasonLabels[patch.failureReasonCode]
      : patch.failureReasonLabel ?? null;
  }

  if ("failureReasonLabel" in patch) {
    nextOrder.failureReasonLabel = patch.failureReasonLabel ?? null;
  }

  if ("resolutionStatus" in patch) {
    nextOrder.resolutionStatus = patch.resolutionStatus ?? null;
    nextOrder.resolutionStatusLabel = patch.resolutionStatus
      ? adminResolutionStatusLabels[patch.resolutionStatus]
      : null;
  }

  if (patch.customerNotificationStatus) {
    nextOrder.customerNotificationStatus = patch.customerNotificationStatus;
    nextOrder.customerNotificationStatusLabel =
      adminCustomerNotificationStatusLabels[patch.customerNotificationStatus];
  }

  return nextOrder;
}

function applyStoredOverride(order: AdminOrder): AdminOrder {
  const overrides = getOverrideRecords();
  const override = overrides?.[order.id];

  if (!override) {
    return order;
  }

  return applyOrderPatch(order, override.patch);
}

export function mapCreatedDeliveryOrderToAdminOrder(
  order: CreatedDeliveryOrder,
): AdminOrder {
  const status = mapCreatedStatusToOrderStatus(order);
  const parcelStatus = getRuntimeParcelStatus(order);
  const configuration = makeConfigurationFromRuntime(order);
  const failureReasonCode = inferRuntimeFailureReasonCode(order);
  const resolutionStatus: AdminResolutionStatus | null = failureReasonCode
    ? "open"
    : null;
  const customerNotificationStatus: AdminCustomerNotificationStatus =
    failureReasonCode ? "unknown" : "not_required";
  const pickupMeetingPoint = makeMeetingPointFromRuntimePoint(
    order.payload.selectedPickupPoint,
    "runtime_local",
  );
  const dropoffMeetingPoint = makeMeetingPointFromRuntimePoint(
    order.payload.selectedDropoffPoint,
    "runtime_local",
  );
  const meetingPoints: AdminOrderMeetingPoints = {
    pickup: pickupMeetingPoint,
    dropoff: dropoffMeetingPoint,
    active: pickupMeetingPoint ?? dropoffMeetingPoint,
  };
  const runtimeRefundStatus = isRefundStatus(order.refundStatus)
    ? order.refundStatus
    : undefined;
  const refund = makeRefundSnapshot({
    runtimeRefundStatus,
    runtimePaymentStatus: order.paymentStatus,
    reason: order.fallbackReason ?? null,
  });

  const adminOrder: AdminOrder = {
    id: order.id,
    source: "runtime_local",
    persistence: "local_only",
    href: order.href,
    customer: makeRuntimeCustomer(order),
    pickup: makePointFromRuntimeAddress(
      `${order.id}:pickup`,
      "Ridicare",
      order.payload.pickupAddress,
    ),
    dropoff: makePointFromRuntimeAddress(
      `${order.id}:dropoff`,
      "Livrare",
      order.payload.dropoffAddress,
    ),
    meetingPoints,
    status,
    statusLabel: adminOrderStatusLabels[status],
    urgency: order.payload.urgency,
    urgencyLabel: adminUrgencyLabels[order.payload.urgency],
    fulfillmentStatus: order.fulfillmentStatus ?? null,
    submitStatus: order.status,
    missionId: order.missionId ?? null,
    missionStatus: order.missionStatus ?? null,
    parcelStatus,
    parcelStatusLabel: adminParcelStatusLabels[parcelStatus],
    parcel: {
      id: `${order.id}:parcel`,
      summary: order.payload.parcel.contentDescription || null,
      category: order.payload.parcel.category,
      packagingType: order.payload.parcel.packaging,
      fragileLevel: order.payload.parcel.fragilityLevel,
      estimatedWeightKg: getRuntimeEstimatedWeight(order),
      detectedWeightKg: null,
      estimatedWeightRangeLabel: order.payload.parcel.estimatedWeightRange,
      dimensionsCm: getParcelDimensionsFromRuntime(order),
      aiEstimateLabel: getRuntimeAiEstimateLabel(order),
      declaredValue: null,
      selectedConfiguration: configuration,
    },
    assignedDroneClass:
      configuration?.droneClass ?? order.payload.recommendedDroneClass ?? null,
    assignedDroneClassLabel:
      configuration?.label ??
      adminDroneClassLabels[order.payload.recommendedDroneClass],
    price: order.payload.estimatedPrice,
    payment: makeRuntimePaymentSnapshot(order),
    refund,
    eta: {
      minMinutes: order.payload.estimatedEta.minMinutes,
      maxMinutes: order.payload.estimatedEta.maxMinutes,
      scheduledFor: order.payload.scheduledAt,
      completedAt: order.completedAt ?? null,
    },
    internalNotes: null,
    failureReasonCode,
    failureReasonLabel: failureReasonCode
      ? adminFailureReasonLabels[failureReasonCode]
      : null,
    originalFailureReason: order.fallbackReason ?? null,
    resolutionStatus,
    resolutionStatusLabel: resolutionStatus
      ? adminResolutionStatusLabels[resolutionStatus]
      : null,
    customerNotificationStatus,
    customerNotificationStatusLabel:
      adminCustomerNotificationStatusLabels[customerNotificationStatus],
    editableFields: defaultEditableOrderFields,
    readOnlyFields: [
      "id",
      "source",
      "createdAt",
      "customer.profileId",
      "metadata.publicTrackingCode",
    ],
    auditTrail: readAdminOrderAuditEvents(order.id),
    metadata: {
      publicTrackingCode: order.publicTrackingCode ?? null,
      recipientTrackingToken: order.recipientTrackingToken ?? null,
      serviceAreaEligible:
        order.payload.coverageStatus === "inside" ||
        order.payload.coverageStatus === "ready",
      warehousePickupRequired: order.warehousePickupRequired ?? null,
      sourceRecordId: order.id,
    },
    createdAt: order.payload.createdAt,
    updatedAt: order.completedAt ?? order.paidAt ?? order.payload.createdAt,
  };

  return applyStoredOverride(adminOrder);
}

export function getAdminOrders() {
  return getRuntimeAdminOrders().sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function getRuntimeAdminOrders() {
  return readCreatedDeliveryOrders().map(mapCreatedDeliveryOrderToAdminOrder);
}

export function getAdminOrdersWithRuntime() {
  return getAdminOrders();
}

export function getAdminOrderById(orderId: string) {
  return getAdminOrdersWithRuntime().find((order) => order.id === orderId) ?? null;
}

export function updateAdminOrder({
  orderId,
  patch,
  actor,
  reason = null,
}: {
  orderId: string;
  patch: AdminOrderEditablePatch;
  actor: AdminAuditActor;
  reason?: string | null;
}): AdminOrderUpdateResult {
  if (!canUseLocalStorage()) {
    return {
      ok: false,
      reason: "storage_unavailable",
      order: null,
      auditEvents: [],
    };
  }

  const currentOrder = getAdminOrderById(orderId);

  if (!currentOrder) {
    return {
      ok: false,
      reason: "not_found",
      order: null,
      auditEvents: [],
    };
  }

  const changedPatchEntries = Object.entries(patch).filter(([field, nextValue]) => {
    const currentValue = getOrderPatchValue(currentOrder, field as AdminEditableField);

    return !valuesAreEqual(currentValue, nextValue);
  });

  if (changedPatchEntries.length === 0) {
    return {
      ok: true,
      order: currentOrder,
      auditEvents: [],
      persistence: "local_only",
    };
  }

  const changedPatch = Object.fromEntries(changedPatchEntries) as AdminOrderEditablePatch;
  const existingOverrides = getOverrideRecords() ?? {};
  const existingOverride = existingOverrides[orderId];
  const nextOverride: AdminOrderOverrideRecord = {
    orderId,
    patch: {
      ...(existingOverride?.patch ?? {}),
      ...changedPatch,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorId,
  };

  writeOverrideRecords({
    ...existingOverrides,
    [orderId]: nextOverride,
  });

  const auditEvents = changedPatchEntries.map(([field, nextValue]) =>
    createAdminAuditEvent({
      orderId,
      actor,
      field,
      oldValue: toJsonValue(
        getOrderPatchValue(currentOrder, field as AdminEditableField),
      ),
      newValue: toJsonValue(nextValue),
      reason,
      createdAt: nextOverride.updatedAt,
    }),
  );

  appendAdminAuditEvents(auditEvents);

  return {
    ok: true,
    order: getAdminOrderById(orderId) ?? applyOrderPatch(currentOrder, changedPatch),
    auditEvents,
    persistence: "local_only",
  };
}

function isRuntimeOrderInProgress(order: CreatedDeliveryOrder) {
  const fulfillmentStatus = order.fulfillmentStatus ?? "order_created";

  return (
    (order.paymentStatus === "paid" || order.paymentStatus === "processing") &&
    fulfillmentStatus !== "completed_mission" &&
    fulfillmentStatus !== "failed_mission" &&
    fulfillmentStatus !== "fallback_required" &&
    fulfillmentStatus !== "canceled"
  );
}

export function cancelRuntimeOrdersInProgress({
  actor,
  reason = "Anulare in masa din panoul Administrator.",
}: {
  actor: AdminAuditActor;
  reason?: string;
}): AdminBulkOrderActionResult {
  if (!canUseLocalStorage()) {
    return {
      ok: false,
      reason: "storage_unavailable",
      affectedOrders: 0,
      auditEvents: [],
    };
  }

  const ordersToCancel = readCreatedDeliveryOrders().filter(isRuntimeOrderInProgress);
  const now = new Date().toISOString();
  const auditEvents = ordersToCancel.map((order) =>
    createAdminAuditEvent({
      orderId: order.id,
      actor,
      field: "bulk_cancel_active_orders",
      oldValue: toJsonValue(order.fulfillmentStatus ?? "order_created"),
      newValue: "canceled",
      reason,
      createdAt: now,
    }),
  );

  ordersToCancel.forEach((order) => {
    updateCreatedDeliveryOrderFulfillment({
      orderId: order.id,
      fulfillmentStatus: "canceled",
      missionId: order.missionId ?? null,
      missionStatus: "mission_failed",
      completedAt: now,
    });
  });
  appendAdminAuditEvents(auditEvents);

  return {
    ok: true,
    affectedOrders: ordersToCancel.length,
    auditEvents,
    persistence: "local_only",
  };
}

function getParcelLocationForFailedOrder(order: AdminOrder): AdminParcelLocation {
  if (order.parcelStatus === "secured_in_locker" && order.meetingPoints.active) {
    return {
      label: order.meetingPoints.active.label,
      address: null,
      coordinates: order.meetingPoints.active.coordinates,
      source: order.meetingPoints.active.source,
    };
  }

  if (order.parcelStatus === "loaded" || order.parcelStatus === "in_transit") {
    return order.dropoff
      ? {
          label: order.dropoff.label,
          address: order.dropoff.address,
          coordinates: order.dropoff.coordinates,
          source: order.dropoff.source,
        }
      : {
          label: "Locație colet necunoscută",
          address: null,
          coordinates: null,
          source: order.source,
        };
  }

  return order.pickup
    ? {
        label: order.pickup.label,
        address: order.pickup.address,
        coordinates: order.pickup.coordinates,
        source: order.pickup.source,
      }
    : {
        label: "Locație colet necunoscută",
        address: null,
        coordinates: null,
        source: order.source,
      };
}

function dronePickedUpParcel(order: AdminOrder) {
  if (order.parcelStatus === "loaded" || order.parcelStatus === "in_transit") {
    return true;
  }

  if (
    order.parcelStatus === "waiting_for_load" ||
    order.parcelStatus === "secured_in_locker"
  ) {
    return false;
  }

  return null;
}

function isFailedAdminOrder(order: AdminOrder) {
  return (
    order.status === "failed" ||
    order.failureReasonCode !== null ||
    order.fulfillmentStatus === "failed_mission" ||
    order.fulfillmentStatus === "fallback_required"
  );
}

function requiresLockerRecovery(order: AdminOrder) {
  return (
    order.metadata.warehousePickupRequired === true ||
    order.failureReasonCode === "locker_detached_recovery_required"
  );
}

export function getFailedOrderRecords(adminOrders?: AdminOrder[]): FailedOrderRecord[] {
  return (adminOrders ?? getAdminOrdersWithRuntime())
    .filter(isFailedAdminOrder)
    .map((order) => {
      const reasonCode =
        (order.failureReasonCode as AdminFailureReasonCode | null) ?? "unknown";
      const resolutionStatus = order.resolutionStatus ?? "open";
      const priority = getPriorityForFailure(reasonCode, order.urgency);

      return {
        id: `failed_${order.id}`,
        orderId: order.id,
        source: order.source,
        customer: order.customer,
        reasonCode,
        reasonLabel: order.failureReasonLabel ?? adminFailureReasonLabels[reasonCode],
        originalReason: order.originalFailureReason,
        dronePickedUpParcel: dronePickedUpParcel(order),
        parcelLocation: getParcelLocationForFailedOrder(order),
        refundStatus: order.refund.status,
        refundStatusLabel: order.refund.statusLabel,
        customerNotificationStatus: order.customerNotificationStatus,
        customerNotificationStatusLabel: order.customerNotificationStatusLabel,
        priority,
        priorityLabel: adminPriorityLabels[priority],
        failedAt: order.updatedAt,
        resolutionStatus,
        resolutionStatusLabel: adminResolutionStatusLabels[resolutionStatus],
        hasLockerRecoveryIncident: requiresLockerRecovery(order),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      } satisfies FailedOrderRecord;
    });
}

export function getLockerRecoveryIncidents(adminOrders?: AdminOrder[]): LockerRecoveryIncident[] {
  return (adminOrders ?? getAdminOrdersWithRuntime())
    .filter(requiresLockerRecovery)
    .map((order) => {
      const meetingPoint = order.meetingPoints.active;
      const fallbackLocation = getParcelLocationForFailedOrder(order);
      const coordinates = meetingPoint?.coordinates ?? fallbackLocation.coordinates;
      const exactLocation =
        meetingPoint?.label ?? fallbackLocation.label ?? order.pickup?.label ?? null;
      const detachedAt = order.updatedAt;
      const minutesOnField = detachedAt
        ? Math.max(0, Math.floor((Date.now() - Date.parse(detachedAt)) / 60000))
        : null;
      const limitKg = order.parcel.selectedConfiguration?.maxPayloadKg ?? null;
      const detectedWeightKg =
        order.parcel.detectedWeightKg ??
        (order.parcel.estimatedWeightKg && limitKg && order.parcel.estimatedWeightKg > limitKg
          ? order.parcel.estimatedWeightKg
          : null);

      return {
        id: `locker_recovery_${order.id}`,
        lockerId: `locker_${order.id}`,
        orderId: order.id,
        source: order.source,
        exactLocation,
        coordinates,
        meetingPoint,
        customer: order.customer,
        estimatedWeightKg: order.parcel.estimatedWeightKg,
        detectedWeightKg,
        limitKg,
        detachedAt,
        minutesOnField,
        assignedOperatorId: null,
        assignedOperatorName: null,
        status: "locker_detached",
        statusLabel: lockerRecoveryStatusLabels.locker_detached,
        priority: "urgent",
        dataCompleteness: coordinates ? "exact" : exactLocation ? "partial" : "missing_coordinates",
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      } satisfies LockerRecoveryIncident;
    });
}

export function readContactMessages() {
  return readJsonArray<ContactMessage>(adminContactMessagesStorageKey).sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function createContactMessage(input: {
  email: string;
  subject: string;
  category: string;
  message: string;
}) {
  const now = new Date().toISOString();
  const message: ContactMessage = {
    id: createAdminRecordId("contact"),
    source: "runtime_local",
    persistence: canUseLocalStorage() ? "local_only" : "not_persisted",
    email: input.email,
    subject: input.subject,
    category: input.category,
    message: input.message,
    status: "new",
    statusLabel: contactMessageStatusLabels.new,
    internalNote: null,
    preparedReply: null,
    readAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (canUseLocalStorage()) {
    writeJsonArray(adminContactMessagesStorageKey, [
      message,
      ...readContactMessages(),
    ]);
  }

  return message;
}

export function updateContactMessage(
  messageId: string,
  patch: Partial<{
    status: ContactMessageStatus;
    internalNote: string | null;
    preparedReply: string | null;
  }>,
) {
  if (!canUseLocalStorage()) {
    return null;
  }

  const messages = readContactMessages();
  const now = new Date().toISOString();
  const updatedMessages = messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    const nextStatus = patch.status ?? message.status;

    return {
      ...message,
      status: nextStatus,
      statusLabel: contactMessageStatusLabels[nextStatus],
      internalNote:
        "internalNote" in patch ? patch.internalNote ?? null : message.internalNote,
      preparedReply:
        "preparedReply" in patch
          ? patch.preparedReply ?? null
          : message.preparedReply,
      readAt:
        nextStatus === "read" ||
        nextStatus === "in_progress" ||
        nextStatus === "prepared_reply" ||
        nextStatus === "archived"
          ? message.readAt ?? now
          : message.readAt,
      archivedAt: nextStatus === "archived" ? message.archivedAt ?? now : null,
      updatedAt: now,
    } satisfies ContactMessage;
  });

  writeJsonArray(adminContactMessagesStorageKey, updatedMessages);

  return updatedMessages.find((message) => message.id === messageId) ?? null;
}

export function deleteContactMessage(messageId: string) {
  if (!canUseLocalStorage()) {
    return false;
  }

  const messages = readContactMessages();
  writeJsonArray(
    adminContactMessagesStorageKey,
    messages.filter((message) => message.id !== messageId),
  );

  return true;
}

export const defaultOperationalSettings: OperationalSettings = {
  id: "default",
  source: "default_config",
  persistence: "not_persisted",
  serviceRadiusKm: serviceAreaConfig.coverageRadiusKm,
  hubAddress: activeHub.address,
  basePrice: { amountMinor: 990, currency: "RON" },
  pricePerKm: { amountMinor: 220, currency: "RON" },
  timeouts: {
    meetingPointConfirmationMinutes: 10,
    parcelLoadMinutes: 10,
    parcelUnloadMinutes: 10,
  },
  platformStatus: "active",
  platformStatusLabel: operationalPlatformStatusLabels.active,
  updatedAt: null,
  updatedBy: null,
};

export function readOperationalSettings(): OperationalSettings {
  const storedSettings = readJsonObject<OperationalSettings>(
    adminOperationalSettingsStorageKey,
  );

  if (!storedSettings) {
    return defaultOperationalSettings;
  }

  const platformStatus =
    storedSettings.platformStatus in operationalPlatformStatusLabels
      ? storedSettings.platformStatus
      : defaultOperationalSettings.platformStatus;

  return {
    ...defaultOperationalSettings,
    ...storedSettings,
    platformStatus,
    platformStatusLabel:
      operationalPlatformStatusLabels[platformStatus],
  };
}

export function updateOperationalSettings(
  patch: Partial<
    Pick<
      OperationalSettings,
      | "serviceRadiusKm"
      | "hubAddress"
      | "basePrice"
      | "pricePerKm"
      | "timeouts"
      | "platformStatus"
    >
  >,
  actor?: AdminAuditActor,
) {
  if (!canUseLocalStorage()) {
    return null;
  }

  const platformStatus = patch.platformStatus ?? readOperationalSettings().platformStatus;
  const nextSettings: OperationalSettings = {
    ...readOperationalSettings(),
    ...patch,
    source: "admin_override",
    persistence: "local_only",
    platformStatus,
    platformStatusLabel: operationalPlatformStatusLabels[platformStatus],
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.actorId ?? null,
  };

  writeJsonObject(adminOperationalSettingsStorageKey, nextSettings);

  return nextSettings;
}

export function readExportRequests() {
  return readJsonArray<ExportRequest>(adminExportRequestsStorageKey).sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function createExportRequest({
  kind,
  format,
  filters = {},
  requestedBy = null,
}: {
  kind: ExportKind;
  format: ExportFormat;
  filters?: ExportRequest["filters"];
  requestedBy?: AdminAuditActor | null;
}) {
  const csvSupportedKinds: readonly ExportKind[] = [
    "orders",
    "failed_orders",
    "locker_recoveries",
    "contact_messages",
    "general_report",
  ];
  const status: ExportRequestStatus =
    format === "csv" && csvSupportedKinds.includes(kind)
      ? "prepared"
      : "unsupported";
  const request: ExportRequest = {
    id: createAdminRecordId("export"),
    kind,
    format,
    filters,
    status,
    statusLabel: exportRequestStatusLabels[status],
    requestedBy,
    createdAt: new Date().toISOString(),
    completedAt: null,
    downloadHref: null,
    errorMessage:
      status === "unsupported"
        ? "Exportul cerut nu are încă infrastructură implementată."
        : null,
  };

  if (canUseLocalStorage()) {
    writeJsonArray(adminExportRequestsStorageKey, [
      request,
      ...readExportRequests(),
    ]);
  }

  return request;
}
