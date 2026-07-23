import { notFound } from "next/navigation";
import { LiveMissionTrackingView } from "@/components/delivery/live-mission-tracking-view";
import { OrderBillingDocuments } from "@/components/billing/order-billing-documents";
import { droneClassLabels } from "@/constants/domain";
import { createPageMetadata } from "@/lib/metadata";
import { getClientOrderDetail } from "@/lib/client-orders";
import { activeHub } from "@/constants/hub";
import { calculateDistanceKm } from "@/lib/mission-route";
import { calculateSkySendPricing } from "@/lib/pricing";
import {
  formatDeliveryUrgency,
  formatOrderStatus,
} from "@/lib/orders";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { CreatedDeliveryPaymentStatus } from "@/types/create-delivery";
import type { DeliveryUrgency, DroneClass } from "@/types/domain";
import type { ClientOrderDetail } from "@/types/client-orders";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import {
  completeOrderHandoffSnapshot,
  storedPointToDeliveryPoint,
} from "@/lib/meeting-point-snapshot";
import { ensureOrderMission } from "@/lib/mission-bootstrap-server";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

const fallbackEta = {
  minMinutes: 2,
  maxMinutes: 4,
};

function isLocalCreatedOrderId(orderId: string) {
  return orderId.startsWith("SKY-PT-");
}

function isDroneClass(value?: string | null): value is DroneClass {
  return Boolean(value && value in droneClassLabels);
}

function toRuntimeOrder(order: ClientOrderDetail): CreatedDeliveryOrder {
  const droneClass = isDroneClass(order.recommendedDroneClass?.id)
    ? order.recommendedDroneClass.id
    : "medium_standard";
  const routeDistanceKm =
    calculateDistanceKm(activeHub.address.location, order.pickupCoordinates) +
    calculateDistanceKm(order.pickupCoordinates, order.dropoffCoordinates);
  const pricingSnapshot = calculateSkySendPricing({
    pickupCoordinates: order.pickupCoordinates,
    dropoffCoordinates: order.dropoffCoordinates,
    distanceKm: routeDistanceKm,
    selectedDroneId: droneClass,
    dispatchTiming: order.urgency,
    scheduledAt: null,
    weightKg: 2.4,
    dimensionsCm: {
      lengthCm: 34,
      widthCm: 24,
      heightCm: 16,
    },
    fragilityLevel: "moderate",
    routeComplexity: "standard",
  });

  return {
    id: order.id,
    status: "scheduled",
    href: order.href,
    payload: {
      userId: null,
      pickupAddress: {
        input: order.pickupAddress,
        formattedAddress: order.pickupAddress,
        notes: order.pickupPointNote ?? null,
        location: order.pickupCoordinates,
        city: "Pitesti",
        county: "Arges",
        country: "Romania",
        postalCode: null,
      },
      dropoffAddress: {
        input: order.dropoffAddress,
        formattedAddress: order.dropoffAddress,
        notes: order.dropoffPointNote ?? null,
        location: order.dropoffCoordinates,
        city: "Pitesti",
        county: "Arges",
        country: "Romania",
        postalCode: null,
      },
      selectedPickupPoint: {
        id: `${order.id}:pickup`,
        label: order.pickupArea,
        type: "public_point",
        description: order.pickupPointNote ?? order.pickupAddress,
        location: order.pickupCoordinates,
        eligibilityState: "eligible",
        recommendationState: "recommended",
        smartScore: 92,
        distanceFromOriginMeters: 35,
      },
      selectedDropoffPoint: {
        id: `${order.id}:dropoff`,
        label: order.dropoffArea,
        type: "public_point",
        description: order.dropoffPointNote ?? order.dropoffAddress,
        location: order.dropoffCoordinates,
        eligibilityState: "eligible",
        recommendationState: "recommended",
        smartScore: 91,
        distanceFromOriginMeters: 40,
      },
      parcel: {
        category: "retail",
        packaging: "boxed",
        approximateSize: "medium",
        contentDescription: order.parcelSummary ?? "SkySend parcel",
        weightKg: 2.4,
        lengthCm: 34,
        widthCm: 24,
        heightCm: 16,
        fragilityLevel: "moderate",
        recommendedDroneClass: droneClass,
        valueSource: "manual",
        assistantResult: null,
        estimatedWeightRange: "1-3 kg",
      },
      urgency: order.urgency,
      scheduledAt: null,
      recommendedDroneClass: droneClass,
      estimatedPrice: {
        amountMinor: pricingSnapshot.total.amountMinor,
        currency: "RON",
      },
      pricingSnapshot,
      estimatedEcoMetrics: {
        estimatedCo2SavedGrams: 0,
        estimatedRoadDistanceSavedKm: 0,
        estimatedEnergyUseKwh: 0,
      },
      estimatedEta: fallbackEta,
      coverageStatus: "inside",
      coverageSummary: {
        state: "inside",
        title: "Inside active Pitesti coverage",
        description: "Ridicare and drop-off are inside the active SkySend zone.",
        tone: "success",
      },
      createdAt: order.createdAt,
    },
  };
}

function shouldStartMission(status: ClientOrderDetail["status"]) {
  return status === "scheduled" || status === "queued" || status === "in_flight";
}

function toTrackingPaymentStatus(
  status: ClientOrderDetail["payment"]["status"],
): CreatedDeliveryPaymentStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return "unpaid";
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getClientOrderDetail(orderId);

  if (!order) {
    if (isLocalCreatedOrderId(orderId)) {
      return createPageMetadata(
        `Comanda ${orderId}`,
        "Verificare the SkySend order created through the initial session submit flow.",
      );
    }

    return createPageMetadata(
      "Comandă negăsită",
      "The requested SkySend client order could not be found.",
    );
  }

  return createPageMetadata(
    `Comanda ${order.id}`,
    `Track the live SkySend mission for order ${order.id} in Pitesti.`,
  );
}

export default async function ClientOrderDetailsPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getClientOrderDetail(orderId);

  if (!order) {
    notFound();
  }

  const runtimeOrder = toRuntimeOrder(order);
  const db = createAdminSupabaseClient();
  const storedOrder = await new OrdersRepository(db).getByLocalOrderId(order.id);
  let mission =
    storedOrder.ok && storedOrder.data
      ? await new MissionsRepository(db).getByOrderId(storedOrder.data.id)
      : null;
  if (
    storedOrder.ok &&
    storedOrder.data &&
    storedOrder.data.paymentStatus === "paid" &&
    storedOrder.data.status !== "completed" &&
    storedOrder.data.status !== "failed" &&
    (!mission?.ok || !mission.data)
  ) {
    const ensuredMission = await ensureOrderMission(db, storedOrder.data);
    if (ensuredMission) {
      mission = { ok: true, data: ensuredMission };
    }
  }
  if (storedOrder.ok && storedOrder.data) {
    runtimeOrder.paidAt = storedOrder.data.paidAt ?? null;
    runtimeOrder.dispatchStartsAt = storedOrder.data.dispatchStartsAt ?? null;
    const handoffSnapshot = completeOrderHandoffSnapshot(storedOrder.data);
    const pickupOrigin =
      storedOrder.data.selectedPickupHandoffPoint ?? handoffSnapshot.pickup[0];
    const dropoffOrigin =
      storedOrder.data.selectedDropoffHandoffPoint ?? handoffSnapshot.dropoff[0];
    if (pickupOrigin && dropoffOrigin) {
      runtimeOrder.payload.selectedPickupPoint = storedPointToDeliveryPoint(
        pickupOrigin,
        pickupOrigin,
      );
      runtimeOrder.payload.selectedDropoffPoint = storedPointToDeliveryPoint(
        dropoffOrigin,
        dropoffOrigin,
      );
      runtimeOrder.payload.pickupMeetingPoints = handoffSnapshot.pickup.map(
        (point) => storedPointToDeliveryPoint(point, pickupOrigin),
      );
      runtimeOrder.payload.dropoffMeetingPoints = handoffSnapshot.dropoff.map(
        (point) => storedPointToDeliveryPoint(point, dropoffOrigin),
      );
    }
  }
  if (mission?.ok && mission.data) {
    runtimeOrder.missionId = mission.data.id;
    runtimeOrder.missionStatus = mission.data.currentStatus;
    runtimeOrder.missionStepStartedAt = mission.data.stepStartedAt;
    runtimeOrder.missionStepExpiresAt = mission.data.stepExpiresAt;
    runtimeOrder.missionFailureCode = mission.data.failureCode;
    runtimeOrder.fallbackReason = mission.data.fallbackReason;
    runtimeOrder.missionStateVersion = mission.data.stateVersion;
    runtimeOrder.missionRuntimeState = mission.data.runtimeState;
    runtimeOrder.missionDroneTelemetry = mission.data.droneTelemetrySnapshot;
    runtimeOrder.missionPickupPin = mission.data.pickupPin;
    runtimeOrder.missionDropoffPin = mission.data.dropoffPin;
    runtimeOrder.missionStartedAt = mission.data.startedAt;
    runtimeOrder.missionUpdatedAt = mission.data.updatedAt;
  }
  if (order.status === "failed") runtimeOrder.fulfillmentStatus = "failed_mission";
  if (order.status === "delivered") runtimeOrder.fulfillmentStatus = "completed_mission";
  runtimeOrder.completedAt = order.completedAt ?? null;
  runtimeOrder.publicCodeAccessMode =
    storedOrder.ok && storedOrder.data
      ? storedOrder.data.publicCodeAccessMode
      : "view";
  const etaLabel = `${runtimeOrder.payload.estimatedEta.minMinutes} to ${runtimeOrder.payload.estimatedEta.maxMinutes} min`;
  const paymentStatus = toTrackingPaymentStatus(order.payment.status);

  return (
    <>
    <LiveMissionTrackingView
      order={runtimeOrder}
      statusLabel={formatOrderStatus(order.status)}
      urgencyLabel={formatDeliveryUrgency(order.urgency as DeliveryUrgency)}
      priceLabel={order.estimatedCostLabel}
      etaLabel={etaLabel}
      paymentLabel={`${order.paymentStatusLabel ?? "Pending"} / ${
        order.paymentMethodDetail ?? "Method de payment în așteptare"
      }`}
      paymentStatus={paymentStatus}
      checkoutHref="/client/create-delivery?checkout=moved"
      parcelSummary={order.parcelSummary ?? "Rezumat colet not available."}
      droneSummary={
        order.recommendedDroneClass
          ? `${order.recommendedDroneClass.name}: ${order.recommendedDroneClass.shortDescription}`
          : "Clasă drone will be assigned before dispatch."
      }
      outcomeSummary={
        order.proofSummary ??
        order.failureSummary ??
        "Proof of delivery will be prepared after recipient collection and mission closeout."
      }
      startOnMount={shouldStartMission(order.status) && paymentStatus === "paid"}
    />
    <div className="app-container mt-6">
      <OrderBillingDocuments
        orderId={order.id}
        refundDownloadOnly={order.status === "failed"}
      />
    </div>
    </>
  );
}
