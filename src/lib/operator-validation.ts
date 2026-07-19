import { droneClassLabels } from "@/constants/domain";
import {
  getMockOrderPoints,
  getMockOrders,
  getMockParcels,
} from "@/lib/mock-data";
import { sortOrdersByDate } from "@/lib/orders";
import type { OrderPoint } from "@/types/entities";
import type { OperatorValidationContext } from "@/types/operator-validation";

function pointContactName(point?: OrderPoint | null) {
  return point?.contact?.name ?? "Contact necompletat";
}

function pointContactDetail(point?: OrderPoint | null) {
  return (
    point?.contact?.phoneE164 ??
    point?.contact?.email ??
    "Manual verification required"
  );
}

export function getOperatorValidationContext(): OperatorValidationContext | null {
  const orders = getMockOrders();
  const orderPoints = getMockOrderPoints();
  const parcels = getMockParcels();
  const pointById = new Map(orderPoints.map((point) => [point.id, point]));
  const parcelById = new Map(parcels.map((parcel) => [parcel.id, parcel]));
  const activeOrders = sortOrdersByDate(
    orders.filter((order) =>
      ["queued", "scheduled", "in_flight"].includes(order.status),
    ),
    "scheduledFor",
    "asc",
  );
  const order =
    activeOrders.find((item) => item.status === "in_flight") ??
    activeOrders[0] ??
    null;

  if (!order) {
    return null;
  }

  const pickup = pointById.get(order.pickupPointId);
  const dropoff = pointById.get(order.dropoffPointId);
  const parcel = parcelById.get(order.parcelId);

  return {
    orderId: order.id,
    orderStatus: order.status,
    pickupPoint: {
      label: pickup?.address.formattedAddress ?? "Punct de pickup indisponibil",
      contactName: pointContactName(pickup),
      contactDetail: pointContactDetail(pickup),
      notes: pickup?.notes ?? null,
    },
    dropoffPoint: {
      label: dropoff?.address.formattedAddress ?? "Punct de livrare indisponibil",
      contactName: pointContactName(dropoff),
      contactDetail: pointContactDetail(dropoff),
      notes: dropoff?.notes ?? null,
    },
    parcel: {
      summary: parcel?.contentsSummary ?? "Rezumat colet indisponibil",
      packagingType: parcel?.packagingType ?? "unknown",
      size: parcel?.approximateSize ?? "unknown",
      fragileLevel: parcel?.fragileLevel ?? "unknown",
      estimatedWeightRange:
        parcel?.estimatedWeightRangeLabel ?? "Interval greutate indisponibil",
    },
    assignedDroneClass: order.assignedDroneClassId ?? null,
    assignedDroneClassLabel: order.assignedDroneClassId
      ? droneClassLabels[order.assignedDroneClassId]
      : "Clasă drone pending",
  };
}
