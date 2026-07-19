import { activeHub } from "@/constants/hub";
import {
  getAdminOrdersWithRuntime,
  getFailedOrderRecords,
  readOperationalSettings,
} from "@/lib/admin-data";
import { getAdminContactMessageDetails } from "@/lib/admin-contact-messages";
import { getAdminLockerRecoveryDetails } from "@/lib/admin-locker-recoveries";
import {
  calculateHeadingDegrees,
  interpolateGeoPoint,
} from "@/lib/mission-route";
import type {
  AdminOrder,
  FailedOrderRecord,
  LockerRecoveryIncident,
  OperationalSettings,
} from "@/types/admin";
import type { AdminContactMessageDetail } from "@/types/admin-contact";
import type {
  OperationalCenterData,
  OperationalContactMessage,
  OperationalDroneMarker,
  OperationalEvent,
  OperationalIncident,
  OperationalMapOrder,
  OperationalPlatformSnapshot,
} from "@/types/admin-operational";
import type { OrderStatus } from "@/types/domain";
import type { OperatorParcelEvaluation } from "@/types/operator-parcel-evaluation";
import type { GeoPoint } from "@/types/service-area";

const activeOrderStatuses: readonly OrderStatus[] = [
  "scheduled",
  "queued",
  "in_flight",
];

function formatOrderId(orderId: string) {
  return orderId.split("_").at(-1)?.replace(/^0+/, "") || orderId;
}

function isToday(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getShortLocationLabel(label: string | null | undefined, fallback: string) {
  return label?.split(",")[0]?.trim() || fallback;
}

function getOrderActivePoint(order: AdminOrder) {
  if (order.status === "in_flight" && order.pickup?.coordinates && order.dropoff?.coordinates) {
    return interpolateGeoPoint(order.pickup.coordinates, order.dropoff.coordinates, 0.46);
  }

  return (
    order.meetingPoints.active?.coordinates ??
    order.pickup?.coordinates ??
    order.dropoff?.coordinates ??
    null
  );
}

function getRoutePoints(order: AdminOrder) {
  const points: GeoPoint[] = [activeHub.address.location];

  if (order.pickup?.coordinates) {
    points.push(order.pickup.coordinates);
  }

  if (order.dropoff?.coordinates) {
    points.push(order.dropoff.coordinates);
  }

  return points;
}

function getDronePoint(order: AdminOrder) {
  if (
    order.status !== "in_flight" ||
    !order.pickup?.coordinates ||
    !order.dropoff?.coordinates
  ) {
    return null;
  }

  return interpolateGeoPoint(order.pickup.coordinates, order.dropoff.coordinates, 0.46);
}

function getEtaLabel(order: AdminOrder) {
  if (order.eta.minMinutes && order.eta.maxMinutes) {
    return `${order.eta.minMinutes}-${order.eta.maxMinutes} min`;
  }

  if (order.eta.scheduledFor) {
    return "Programată";
  }

  return "ETA indisponibil";
}

function mapOrderToOperationalOrder(order: AdminOrder): OperationalMapOrder {
  const pickupCoordinates = order.pickup?.coordinates ?? null;
  const dropoffCoordinates = order.dropoff?.coordinates ?? null;
  const dronePoint = getDronePoint(order);
  const droneHeadingDegrees =
    dronePoint && dropoffCoordinates
      ? calculateHeadingDegrees(dronePoint, dropoffCoordinates)
      : null;

  return {
    id: `order_${order.id}`,
    orderId: order.id,
    shortId: formatOrderId(order.id),
    customerName: order.customer.name,
    status: order.status,
    statusLabel: order.statusLabel,
    urgencyLabel: order.urgencyLabel,
    pickup: {
      label: getShortLocationLabel(order.pickup?.label, "Ridicare necunoscută"),
      coordinates: pickupCoordinates,
    },
    dropoff: {
      label: getShortLocationLabel(order.dropoff?.label, "Livrare necunoscută"),
      coordinates: dropoffCoordinates,
    },
    handoff: order.meetingPoints.active
      ? {
          label: order.meetingPoints.active.label,
          coordinates: order.meetingPoints.active.coordinates,
        }
      : null,
    activePoint: getOrderActivePoint(order),
    dronePoint,
    droneHeadingDegrees,
    assignedDroneLabel: order.assignedDroneClassLabel,
    routePoints: getRoutePoints(order),
    etaLabel: getEtaLabel(order),
    price: order.price,
    href: `/admin/orders?orderId=${encodeURIComponent(order.id)}`,
    hasCompleteRoute: Boolean(pickupCoordinates && dropoffCoordinates),
    updatedAt: order.updatedAt,
  };
}

function mapOrderToDroneMarker(order: OperationalMapOrder): OperationalDroneMarker | null {
  if (!order.dronePoint) {
    return null;
  }

  return {
    id: `drone_${order.orderId}`,
    orderId: order.orderId,
    label: `Drona pentru comanda ${order.shortId}`,
    coordinates: order.dronePoint,
    headingDegrees: order.droneHeadingDegrees ?? 0,
    statusLabel: "În zbor",
    batteryPercent: null,
  };
}

function mapLockerIncidentToOperational(
  incident: LockerRecoveryIncident,
): OperationalIncident {
  return {
    id: incident.id,
    kind: "locker_recovery",
    orderId: incident.orderId,
    shortOrderId: formatOrderId(incident.orderId),
    title: "Recuperare urgentă necesară",
    description:
      incident.exactLocation ??
      "Lockerul este pe teren, dar locația exactă nu este completă.",
    priority: incident.priority,
    priorityLabel: "Urgentă",
    statusLabel: incident.statusLabel,
    locationLabel: incident.exactLocation ?? "Locație locker incompletă",
    coordinates: incident.coordinates,
    href: `/admin/locker-recoveries?incidentId=${encodeURIComponent(incident.id)}`,
    lockerId: incident.lockerId,
    lockerStatus: incident.status,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

function mapFailedOrderToOperational(
  failedOrder: FailedOrderRecord,
): OperationalIncident {
  const isUrgent = failedOrder.priority === "urgent" || failedOrder.priority === "high";

  return {
    id: failedOrder.id,
    kind: "failed_order",
    orderId: failedOrder.orderId,
    shortOrderId: formatOrderId(failedOrder.orderId),
    title: isUrgent ? "Incident operațional prioritar" : "Comandă eșuată",
    description: failedOrder.reasonLabel,
    priority: failedOrder.priority,
    priorityLabel: failedOrder.priorityLabel,
    statusLabel: failedOrder.resolutionStatusLabel,
    locationLabel: failedOrder.parcelLocation.label,
    coordinates: failedOrder.parcelLocation.coordinates,
    href: `/admin/failed-orders?orderId=${encodeURIComponent(failedOrder.orderId)}`,
    lockerId: null,
    lockerStatus: null,
    createdAt: failedOrder.createdAt,
    updatedAt: failedOrder.updatedAt,
  };
}

function createOrderEvent(order: OperationalMapOrder): OperationalEvent {
  if (order.status === "in_flight") {
    return {
      id: `event_in_flight_${order.orderId}`,
      title: `Drona a pornit spre destinație pentru comanda ${order.shortId}.`,
      description: `${order.pickup.label} către ${order.dropoff.label}.`,
      occurredAt: order.updatedAt,
      tone: "info",
      target: { type: "order", id: order.id },
    };
  }

  if (order.status === "queued") {
    return {
      id: `event_queued_${order.orderId}`,
      title: `Comanda ${order.shortId} așteaptă confirmarea operațională.`,
      description: `Punct de ridicare: ${order.pickup.label}.`,
      occurredAt: order.updatedAt,
      tone: "warning",
      target: { type: "order", id: order.id },
    };
  }

  return {
    id: `event_scheduled_${order.orderId}`,
    title: `Comanda ${order.shortId} a fost creată.`,
    description: `ETA: ${order.etaLabel}.`,
    occurredAt: order.updatedAt,
    tone: "neutral",
    target: { type: "order", id: order.id },
  };
}

function createIncidentEvent(incident: OperationalIncident): OperationalEvent {
  if (incident.kind === "locker_recovery") {
    return {
      id: `event_${incident.id}`,
      title: "Alertă: locker detașat, recuperare necesară.",
      description: incident.locationLabel,
      occurredAt: incident.updatedAt,
      tone: "destructive",
      target: { type: "incident", id: incident.id },
    };
  }

  return {
    id: `event_${incident.id}`,
    title: `Comanda ${incident.shortOrderId} necesită verificare.`,
    description: incident.description,
    occurredAt: incident.updatedAt,
    tone: incident.priority === "high" ? "warning" : "neutral",
    target: { type: "incident", id: incident.id },
  };
}

function createCompletedEvent(order: AdminOrder): OperationalEvent | null {
  if (order.status !== "delivered" || !isToday(order.eta.completedAt)) {
    return null;
  }

  return {
    id: `event_completed_${order.id}`,
    title: `Comanda ${formatOrderId(order.id)} a fost finalizată.`,
    description: order.dropoff?.label ?? "Livrare finalizată.",
    occurredAt: order.eta.completedAt ?? order.updatedAt,
    tone: "success",
    target: null,
  };
}

function mapContactMessageToOperational(message: ReturnType<typeof getAdminContactMessageDetails>[number]): OperationalContactMessage {
  return {
    id: message.id,
    email: message.email,
    subject: message.subject,
    categoryLabel: message.categoryLabel,
    statusLabel: message.statusLabel,
    createdAt: message.createdAt,
    href: `/admin/site-messages?messageId=${encodeURIComponent(message.id)}`,
  };
}

function getOperationalPlatformSnapshot(): OperationalPlatformSnapshot {
  const settings = readOperationalSettings();

  return {
    status: settings.platformStatus,
    statusLabel: settings.platformStatusLabel,
    serviceRadiusKm: settings.serviceRadiusKm,
    hubAddressLabel: settings.hubAddress.formattedAddress,
    updatedAt: settings.updatedAt,
  };
}

type OperationalCenterDataOverride = {
  adminOrders?: AdminOrder[];
  contactMessages?: AdminContactMessageDetail[];
  settings?: OperationalSettings;
};

export function getAdminOperationalCenterData(
  override?: OperationalCenterDataOverride,
): OperationalCenterData {
  const adminOrders = override?.adminOrders ?? getAdminOrdersWithRuntime();
  const activeOrders = adminOrders
    .filter((order) => activeOrderStatuses.includes(order.status))
    .map(mapOrderToOperationalOrder);
  const droneMarkers = activeOrders
    .map(mapOrderToDroneMarker)
    .filter((marker): marker is OperationalDroneMarker => marker !== null);
  const lockerIncidents = getAdminLockerRecoveryDetails(adminOrders)
    .filter((incident) => incident.status !== "resolved")
    .map(mapLockerIncidentToOperational);
  const lockerIncidentOrderIds = new Set(
    lockerIncidents.map((incident) => incident.orderId),
  );
  const failedIncidents = getFailedOrderRecords(adminOrders)
    .filter((record) => !lockerIncidentOrderIds.has(record.orderId))
    .map(mapFailedOrderToOperational);
  const incidents = [...lockerIncidents, ...failedIncidents].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
  const completedTodayCount = adminOrders.filter((order) =>
    isToday(order.eta.completedAt),
  ).length;
  const events = [
    ...incidents.map(createIncidentEvent),
    ...activeOrders.map(createOrderEvent),
    ...adminOrders
      .map(createCompletedEvent)
      .filter((event): event is OperationalEvent => event !== null),
  ]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, 12);
  const missingCoordinateCount =
    activeOrders.filter((order) => !order.activePoint || !order.hasCompleteRoute).length +
    incidents.filter((incident) => !incident.coordinates).length;
  const allContactMessages =
    override?.contactMessages ?? getAdminContactMessageDetails();
  const contactMessages = allContactMessages
    .filter((message) => message.status === "new")
    .map(mapContactMessageToOperational);
  const parcelEvaluations: OperatorParcelEvaluation[] = [];
  const platform = override?.settings
    ? {
        status: override.settings.platformStatus,
        statusLabel: override.settings.platformStatusLabel,
        serviceRadiusKm: override.settings.serviceRadiusKm,
        hubAddressLabel: override.settings.hubAddress.formattedAddress,
        updatedAt: override.settings.updatedAt,
      }
    : getOperationalPlatformSnapshot();

  return {
    generatedAt: new Date().toISOString(),
    hub: {
      id: activeHub.id,
      name: activeHub.name,
      addressLabel: activeHub.address.formattedAddress,
      coordinates: activeHub.address.location,
    },
    kpis: [
      {
        id: "active-orders",
        label: "Comenzi active",
        value: `${activeOrders.length}`,
        hint: "Programate, în așteptare sau în zbor.",
        tone: "info",
      },
      {
        id: "drones-in-flight",
        label: "Drone în zbor",
        value: `${droneMarkers.length}`,
        hint: "Calculate din comenzile aflate în zbor.",
        tone: "success",
      },
      {
        id: "active-incidents",
        label: "Incidente active",
        value: `${incidents.length}`,
        hint: "Incidente și recuperări urgente.",
        tone: incidents.some((incident) => incident.kind === "locker_recovery")
          ? "destructive"
          : "warning",
      },
      {
        id: "completed-today",
        label: "Livrări finalizate azi",
        value: `${completedTodayCount}`,
        hint: "Din timestamp-urile de finalizare disponibile.",
        tone: "success",
      },
    ],
    activeOrders,
    droneMarkers,
    incidents,
    parcelEvaluations,
    contactMessages,
    platform,
    events,
    missingCoordinateCount,
  };
}
