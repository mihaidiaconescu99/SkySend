

import { activeHub } from "@/constants/hub";
import { droneClassLabels } from "@/constants/domain";
import { calculateDistanceKm } from "@/lib/mission-route";
import { formatEstimatedCo2Saved, formatRoadDistanceAvoided } from "@/lib/eco";
import { getOrderProgress, getOrderTimelineLabels } from "@/lib/orders";
import {
  AddressesRepository,
} from "@/lib/repositories/addresses-repository";
import { ParcelsRepository } from "@/lib/repositories/parcels-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientOrderDetail,
  ClientOrderPaymentSnapshot,
  ClientOrderStatusFilter,
  ClientOrderSummary,
} from "@/types/client-orders";
import type { DeliveryUrgency, OrderStatus } from "@/types/domain";
import type { Address } from "@/types/address";
import type { Order, PaymentStatus as DbPaymentStatus } from "@/types/order";
import type { Parcel } from "@/types/parcel";
import type { PaymentRecord } from "@/types/payment-record";
import type { Database } from "@/types/database";
import type {
  CreatedDeliveryFulfillmentStatus,
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
  CreateDeliveryPayload,
} from "@/types/create-delivery";
import {
  completeOrderHandoffSnapshot,
  storedPointToDeliveryPoint,
} from "@/lib/meeting-point-snapshot";

const ROAD_PREFIX_PATTERN =
  /^(strada|bulevardul|piata|piaÈ›a|calea|bd\.|blvd\.|b-dul)\s+/i;

export function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function normalizeDbPaymentStatus(
  status: DbPaymentStatus,
): ClientOrderPaymentSnapshot["status"] {
  switch (status) {
    case "paid":
    case "failed":
    case "refunded":
      return status;
    case "refund_pending":
    case "pending":
    default:
      return "pending";
  }
}

function paymentStatusLabel(status: ClientOrderPaymentSnapshot["status"]) {
  switch (status) {
    case "paid":
      return "PlatÄƒ confirmatÄƒ";
    case "failed":
      return "PlatÄƒ eÈ™uatÄƒ";
    case "refunded":
      return "RambursatÄƒ";
    case "processing":
      return "ÃŽn procesare";
    case "unpaid":
      return "NeplÄƒtitÄƒ";
    case "pending":
    default:
      return "ÃŽn aÈ™teptare";
  }
}

export function getPaymentSnapshot(
  order: Order,
  payment?: PaymentRecord | null,
): ClientOrderPaymentSnapshot {
  const status = normalizeDbPaymentStatus(order.paymentStatus);
  const hasStripeReference =
    Boolean(order.stripePaymentIntentId) ||
    Boolean(payment?.stripePaymentIntentId);

  return {
    id: payment?.id ?? order.stripePaymentIntentId,
    status,
    statusLabel: paymentStatusLabel(status),
    methodLabel: hasStripeReference
      ? "PlatÄƒ securizatÄƒ cu cardul"
      : "MetodÄƒ de platÄƒ Ã®n aÈ™teptare",
    methodDetail: hasStripeReference
      ? "Stripe card"
      : "Nicio metodÄƒ de platÄƒ salvatÄƒ",
    amountLabel: formatCurrency(order.totalAmountMinor, order.currency),
    hasPaymentIssue: status === "failed" || status === "refunded",
  };
}

export function mapDbStatusToClientStatus(status: Order["status"]): OrderStatus {
  switch (status) {
    case "pending":
      return "scheduled";
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

export function getClientOrderStatusFilter(
  order: Order,
): ClientOrderStatusFilter {
  if (
    order.dispatchTiming === "scheduled" &&
    order.scheduledAt &&
    Date.parse(order.scheduledAt) > Date.now()
  ) {
    return "scheduled";
  }

  switch (order.status) {
    case "pending":
      return "scheduled";
    case "in_progress":
      return "active";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

function mapDispatchTimingToUrgency(order: Order): DeliveryUrgency {
  if (
    order.dispatchTiming === "priority" ||
    order.dispatchTiming === "critical"
  ) {
    return order.dispatchTiming;
  }

  return "standard";
}

function getAreaLabel(
  handoffLabel?: string | null,
  address?: Address | null,
) {
  const rawLabel =
    handoffLabel?.trim() ||
    address?.label?.trim() ||
    address?.formattedAddress.split(",")[0]?.trim();

  if (!rawLabel) {
    return "PiteÈ™ti";
  }

  return rawLabel
    .replace(ROAD_PREFIX_PATTERN, "")
    .replace(/\s+\d+[A-Za-z/-]*$/u, "")
    .trim();
}

export function mapOrderSummary(
  order: Order,
  addressesById?: Map<string, Address>,
  payment?: PaymentRecord | null,
): ClientOrderSummary {
  const pickupAddress = addressesById?.get(order.pickupAddressId) ?? undefined;
  const dropoffAddress =
    addressesById?.get(order.dropoffAddressId) ?? undefined;
  const statusFilter = getClientOrderStatusFilter(order);

  return {
    id: order.localOrderId,
    href: `/client/orders/${order.localOrderId}`,
    pickupArea: getAreaLabel(
      order.selectedPickupHandoffPoint?.label,
      pickupAddress,
    ),
    dropoffArea: getAreaLabel(
      order.selectedDropoffHandoffPoint?.label,
      dropoffAddress,
    ),
    status: mapDbStatusToClientStatus(order.status),
    statusFilter,
    urgency: mapDispatchTimingToUrgency(order),
    createdAt: order.createdAt,
    scheduledFor: order.scheduledAt,
    estimatedCostLabel: formatCurrency(order.totalAmountMinor, order.currency),
    payment: getPaymentSnapshot(order, payment),
    operationalStateLabel:
      statusFilter === "scheduled" && order.dispatchTiming === "scheduled"
        ? "NelivratÄƒ Ã®ncÄƒ"
        : null,
  };
}

export function mapDbPaymentStatusToCreated(
  status: DbPaymentStatus,
): CreatedDeliveryPaymentStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "refund_pending":
      return "refund_pending";
    case "pending":
    default:
      return "unpaid";
  }
}

export function mapOrderToCreatedDelivery(
  order: Order,
): CreatedDeliveryOrder {
  const pickup = order.selectedPickupHandoffPoint;
  const dropoff = order.selectedDropoffHandoffPoint;
  const fallback = activeHub.address.location;
  const pickupLocation = pickup?.location ?? fallback;
  const dropoffLocation = dropoff?.location ?? fallback;
  const handoffSnapshot = completeOrderHandoffSnapshot(order);
  const pickupOrigin = pickup ?? handoffSnapshot.pickup[0];
  const dropoffOrigin = dropoff ?? handoffSnapshot.dropoff[0];

  const payload = {
    userId: order.senderProfileId,
    pickupAddress: {
      input: pickup?.label ?? "",
      formattedAddress: pickup?.label ?? "",
      notes: null,
      location: pickupLocation,
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    dropoffAddress: {
      input: dropoff?.label ?? "",
      formattedAddress: dropoff?.label ?? "",
      notes: null,
      location: dropoffLocation,
      city: null,
      county: null,
      country: null,
      postalCode: null,
    },
    selectedPickupPoint: {
      id: pickup?.id ?? `${order.localOrderId}:pickup`,
      label: pickup?.label ?? "Punct ridicare",
      type: "handoff",
      description: pickup?.label ?? "",
      location: pickupLocation,
      eligibilityState: "eligible",
      recommendationState: "none",
      smartScore: pickup?.smartScore ?? 0,
      distanceFromOriginMeters: 0,
    },
    selectedDropoffPoint: {
      id: dropoff?.id ?? `${order.localOrderId}:dropoff`,
      label: dropoff?.label ?? "Punct livrare",
      type: "handoff",
      description: dropoff?.label ?? "",
      location: dropoffLocation,
      eligibilityState: "eligible",
      recommendationState: "none",
      smartScore: dropoff?.smartScore ?? 0,
      distanceFromOriginMeters: 0,
    },
    pickupMeetingPoints: pickupOrigin
      ? handoffSnapshot.pickup.map((point) =>
          storedPointToDeliveryPoint(point, pickupOrigin),
        )
      : [],
    dropoffMeetingPoints: dropoffOrigin
      ? handoffSnapshot.dropoff.map((point) =>
          storedPointToDeliveryPoint(point, dropoffOrigin),
        )
      : [],
    parcel: {} as unknown,
    urgency:
      order.dispatchTiming === "scheduled"
        ? "scheduled"
        : (order.dispatchTiming as CreateDeliveryPayload["urgency"]),
    scheduledAt: order.scheduledAt,
    recommendedDroneClass: order.droneClass,
    estimatedPrice: {
      amountMinor: order.totalAmountMinor,
      currency: order.currency as "RON",
    },
    pricingSnapshot: {
      ...order.pricingSnapshot,
      currency: order.currency,
      total: {
        amountMinor: order.totalAmountMinor,
        currency: order.currency,
      },
    } as unknown,
    estimatedEcoMetrics: {
      estimatedCo2SavedGrams: 0,
      estimatedRoadDistanceSavedKm: 0,
      estimatedEnergyUseKwh: 0,
    },
    estimatedEta: {
      minMinutes: order.etaMinMinutes ?? 0,
      maxMinutes: order.etaMaxMinutes ?? 0,
    },
    coverageStatus: "available",
    coverageSummary: {} as unknown,
    createdAt: order.createdAt,
  } as unknown as CreateDeliveryPayload;

  return {
    id: order.localOrderId,
    status: "scheduled",
    paymentStatus: mapDbPaymentStatusToCreated(order.paymentStatus),
    fulfillmentStatus:
      (order.fulfillmentStatus as CreatedDeliveryFulfillmentStatus) ??
      "order_created",
    publicTrackingCode: order.publicTrackingCode,
    recipientTrackingToken: order.recipientTrackingToken,
    stripePaymentIntentId: order.stripePaymentIntentId,
    paidAt: null,
    completedAt: order.status === "completed" ? order.updatedAt : null,
    refundStatus: order.refundStatus as CreatedDeliveryOrder["refundStatus"],
    href: `/client/orders/${order.localOrderId}`,
    payload,
  };
}

export async function buildClientOrderDetail(
  supabase: SupabaseClient<Database>,
  order: Order,
): Promise<ClientOrderDetail> {
  const addressesRepo = new AddressesRepository(supabase);
  const parcelsRepo = new ParcelsRepository(supabase);
  const paymentsRepo = new PaymentRecordsRepository(supabase);

  const [pickupAddressResult, dropoffAddressResult, parcelResult, paymentsResult] =
    await Promise.all([
      addressesRepo.getById(order.pickupAddressId),
      addressesRepo.getById(order.dropoffAddressId),
      parcelsRepo.getById(order.parcelId),
      paymentsRepo.listByOrderId(order.id),
    ]);

  const addressesById = new Map<string, Address>();
  if (pickupAddressResult.ok && pickupAddressResult.data) {
    addressesById.set(order.pickupAddressId, pickupAddressResult.data);
  }
  if (dropoffAddressResult.ok && dropoffAddressResult.data) {
    addressesById.set(order.dropoffAddressId, dropoffAddressResult.data);
  }

  const payment =
    paymentsResult.ok && paymentsResult.data.length > 0
      ? [...paymentsResult.data].sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        )[0]
      : null;

  const summary = mapOrderSummary(order, addressesById, payment);
  const pickupAddressData = pickupAddressResult.ok
    ? pickupAddressResult.data
    : null;
  const dropoffAddressData = dropoffAddressResult.ok
    ? dropoffAddressResult.data
    : null;
  const parcelData: Parcel | null = parcelResult.ok ? parcelResult.data : null;
  const pickupCoordinates = {
    latitude:
      order.selectedPickupHandoffPoint?.location.latitude ??
      pickupAddressData?.latitude ??
      activeHub.address.location.latitude,
    longitude:
      order.selectedPickupHandoffPoint?.location.longitude ??
      pickupAddressData?.longitude ??
      activeHub.address.location.longitude,
  };
  const dropoffCoordinates = {
    latitude:
      order.selectedDropoffHandoffPoint?.location.latitude ??
      dropoffAddressData?.latitude ??
      activeHub.address.location.latitude,
    longitude:
      order.selectedDropoffHandoffPoint?.location.longitude ??
      dropoffAddressData?.longitude ??
      activeHub.address.location.longitude,
  };
  const progress = getOrderProgress({ status: summary.status });
  const routeDistanceKm =
    calculateDistanceKm(activeHub.address.location, pickupCoordinates) +
    calculateDistanceKm(pickupCoordinates, dropoffCoordinates);
  const co2SavedGrams = Math.round(routeDistanceKm * 115);
  const dimensions = parcelData?.declaredDimensionsCm;
  const parcelSummary = parcelData
    ? [
        parcelData.contentsDescription,
        parcelData.approximateSize
          ? `mÄƒrime ${parcelData.approximateSize}`
          : null,
        parcelData.declaredWeightKg
          ? `${parcelData.declaredWeightKg} kg`
          : parcelData.estimatedWeightRange,
        dimensions
          ? `${dimensions.lengthCm}x${dimensions.widthCm}x${dimensions.heightCm} cm`
          : null,
      ]
        .filter(Boolean)
        .join(" / ")
    : null;

  return {
    ...summary,
    completedAt: order.status === "completed" ? order.updatedAt : null,
    progressValue: progress.value,
    progressLabel: progress.label,
    paymentStatusLabel: summary.payment.statusLabel,
    paymentId: summary.payment.id,
    paymentMethodLabel: summary.payment.methodLabel,
    paymentMethodDetail: summary.payment.methodDetail,
    pickupAddress: pickupAddressData?.formattedAddress ?? summary.pickupArea,
    dropoffAddress: dropoffAddressData?.formattedAddress ?? summary.dropoffArea,
    pickupPointNote: order.selectedPickupHandoffPoint?.label ?? null,
    dropoffPointNote: order.selectedDropoffHandoffPoint?.label ?? null,
    parcelSummary,
    recommendedDroneClass:
      order.droneClass in droneClassLabels
        ? {
            id: order.droneClass,
            name: droneClassLabels[
              order.droneClass as keyof typeof droneClassLabels
            ],
            shortDescription: "DronÄƒ selectatÄƒ pentru aceastÄƒ comandÄƒ.",
          }
        : null,
    ecoEstimate: {
      co2SavedLabel: formatEstimatedCo2Saved(co2SavedGrams),
      roadDistanceLabel: formatRoadDistanceAvoided(routeDistanceKm),
      methodologyNote:
        "Estimare calculatÄƒ din traseul salvat Ã®n baza de date.",
    },
    proofSummary:
      order.status === "completed" ? "Livrarea a fost finalizatÄƒ." : null,
    failureSummary:
      order.status === "failed"
        ? order.notes ?? "Livrarea a fost marcatÄƒ ca eÈ™uatÄƒ."
        : null,
    fallbackSummary: order.refundStatus
      ? `Refund: ${order.refundStatus}`
      : null,
    pickupCoordinates,
    dropoffCoordinates,
    timeline: getOrderTimelineLabels({
      createdAt: order.createdAt,
      scheduledFor: order.scheduledAt,
      completedAt: order.status === "completed" ? order.updatedAt : null,
      status: summary.status,
    }),
  };
}
