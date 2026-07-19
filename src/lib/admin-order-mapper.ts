

import "server-only";

import {
  adminCustomerNotificationStatusLabels,
  adminFailureReasonLabels,
  adminOrderStatusLabels,
  adminParcelStatusLabels,
  adminPaymentStatusLabels,
  adminRefundStatusLabels,
  adminResolutionStatusLabels,
  adminUrgencyLabels,
  defaultEditableOrderFields,
  inferFailureReasonCodeFromText,
} from "@/lib/admin-data";
import type {
  AdminCustomerNotificationStatus,
  AdminFailureReasonCode,
  AdminOrder,
  AdminParcelStatus,
  AdminPaymentStatus,
  AdminRefundStatus,
} from "@/types/admin";
import type { DispatchTiming, Order } from "@/types/order";
import type {
  DeliveryUrgency,
  DroneClass,
  OrderStatus as DomainOrderStatus,
} from "@/types/domain";
import type { GeoPoint } from "@/types/service-area";

const droneClassLabels: Record<string, string> = {
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

function mapRepoStatusToDomain(status: Order["status"]): DomainOrderStatus {
  switch (status) {
    case "pending":
      return "queued";
    case "in_progress":
      return "in_flight";
    case "completed":
      return "delivered";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

function mapDispatchTimingToUrgency(
  timing: DispatchTiming,
): DeliveryUrgency | "scheduled" {
  switch (timing) {
    case "standard":
      return "standard";
    case "priority":
      return "priority";
    case "critical":
      return "critical";
    case "scheduled":
      return "scheduled";
  }
}

function mapDomainStatusToParcelStatus(
  status: DomainOrderStatus,
): AdminParcelStatus {
  switch (status) {
    case "draft":
    case "scheduled":
    case "queued":
      return "waiting_for_load";
    case "in_flight":
      return "in_transit";
    case "delivered":
      return "delivered";
    case "returned":
      return "returned_to_hub";
    case "failed":
    case "cancelled":
      return "loaded";
  }
}

function mapRepoPaymentStatus(
  status: Order["paymentStatus"],
): AdminPaymentStatus {
  return status as AdminPaymentStatus;
}

function mapRepoRefundStatus(refundStatus: string | null): AdminRefundStatus {
  const valid: AdminRefundStatus[] = [
    "not_required",
    "pending",
    "started",
    "completed",
    "failed",
    "unknown",
  ];

  if (refundStatus && valid.includes(refundStatus as AdminRefundStatus)) {
    return refundStatus as AdminRefundStatus;
  }

  return refundStatus ? "unknown" : "not_required";
}

function makeHandoffPoint(
  handoff: NonNullable<Order["selectedPickupHandoffPoint"]>,
) {
  return {
    id: handoff.id,
    label: handoff.label,
    address: null,
    coordinates: {
      latitude: handoff.location.latitude,
      longitude: handoff.location.longitude,
    } satisfies GeoPoint,
    contact: null,
    notes: null,
    source: "supabase" as const,
  };
}

export function mapRepoOrderToAdminOrder(order: Order): AdminOrder {
  const domainStatus = mapRepoStatusToDomain(order.status);
  const parcelStatus = mapDomainStatusToParcelStatus(domainStatus);
  const urgency = mapDispatchTimingToUrgency(order.dispatchTiming);
  const paymentStatus = mapRepoPaymentStatus(order.paymentStatus);
  const refundStatus = mapRepoRefundStatus(order.refundStatus);

  const pickup = order.selectedPickupHandoffPoint
    ? makeHandoffPoint(order.selectedPickupHandoffPoint)
    : null;
  const dropoff = order.selectedDropoffHandoffPoint
    ? makeHandoffPoint(order.selectedDropoffHandoffPoint)
    : null;

  const isFailed = domainStatus === "failed" || domainStatus === "cancelled";
  const failureReasonCode: AdminFailureReasonCode | null = isFailed
    ? inferFailureReasonCodeFromText(order.notes)
    : null;
  const resolutionStatus = failureReasonCode ? ("open" as const) : null;
  const customerNotificationStatus: AdminCustomerNotificationStatus =
    failureReasonCode ? "unknown" : "not_required";

  const droneClass = (droneClassLabels[order.droneClass] !== undefined
    ? order.droneClass
    : null) as DroneClass | null;
  const droneClassLabel = droneClassLabels[order.droneClass] ?? order.droneClass;

  const money = (amountMinor: number) =>
    ({ amountMinor, currency: order.currency as "RON" });

  return {
    id: order.id,
    source: "supabase",
    persistence: "persisted",
    href: `/admin/orders?orderId=${encodeURIComponent(order.id)}`,
    customer: {
      profileId: order.senderProfileId,
      clerkUserId: null,
      name: order.recipientName ?? `Client ${order.senderProfileId.slice(0, 8)}`,
      email: order.recipientEmail,
      phoneE164: order.recipientPhone ?? null,
      companyName: null,
    },
    pickup,
    dropoff,
    meetingPoints: { pickup: null, dropoff: null, active: null },
    status: domainStatus,
    statusLabel: adminOrderStatusLabels[domainStatus],
    urgency,
    urgencyLabel: adminUrgencyLabels[urgency],
    fulfillmentStatus: order.fulfillmentStatus as AdminOrder["fulfillmentStatus"],
    submitStatus: null,
    missionId: null,
    missionStatus: null,
    parcelStatus,
    parcelStatusLabel: adminParcelStatusLabels[parcelStatus],
    parcel: {
      id: order.parcelId,
      summary: null,
      category: null,
      packagingType: null,
      fragileLevel: null,
      estimatedWeightKg: null,
      detectedWeightKg: null,
      estimatedWeightRangeLabel: null,
      dimensionsCm: null,
      aiEstimateLabel: null,
      declaredValue: null,
      selectedConfiguration: null,
    },
    assignedDroneClass: droneClass,
    assignedDroneClassLabel: droneClassLabel,
    price: money(order.totalAmountMinor),
    payment: {
      id: order.stripePaymentIntentId ?? null,
      provider: order.stripePaymentIntentId ? "stripe" : null,
      status: paymentStatus,
      statusLabel: adminPaymentStatusLabels[paymentStatus],
      amount: money(order.totalAmountMinor),
      capturedAmount:
        paymentStatus === "paid" ? money(order.totalAmountMinor) : null,
      providerReference: order.stripePaymentIntentId ?? null,
      paidAt: null,
      failedAt: null,
      failureReason: null,
    },
    refund: {
      status: refundStatus,
      statusLabel: adminRefundStatusLabels[refundStatus],
      amount: null,
      reason: null,
    },
    eta: {
      minMinutes: order.etaMinMinutes,
      maxMinutes: order.etaMaxMinutes,
      scheduledFor: order.scheduledAt,
      completedAt: null,
    },
    internalNotes: order.notes ?? null,
    failureReasonCode,
    failureReasonLabel: failureReasonCode
      ? adminFailureReasonLabels[failureReasonCode]
      : null,
    originalFailureReason: order.notes ?? null,
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
    auditTrail: [],
    metadata: {
      publicTrackingCode: order.publicTrackingCode,
      recipientTrackingToken: order.recipientTrackingToken,
      serviceAreaEligible: null,
      warehousePickupRequired: null,
      sourceRecordId: order.id,
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
