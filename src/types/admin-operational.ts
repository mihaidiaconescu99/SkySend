import type { AdminPriority, LockerRecoveryStatus } from "@/types/admin";
import type { OperationalPlatformStatus } from "@/types/admin";
import type { OrderStatus } from "@/types/domain";
import type { MoneyAmount } from "@/types/entities";
import type { OperatorParcelEvaluation } from "@/types/operator-parcel-evaluation";
import type { GeoPoint } from "@/types/service-area";

export type OperationalSelection =
  | { type: "order"; id: string }
  | { type: "incident"; id: string };

export type OperationalKpiTone = "info" | "success" | "warning" | "destructive";

export type OperationalKpi = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: OperationalKpiTone;
};

export type OperationalMapPoint = {
  label: string;
  coordinates: GeoPoint | null;
};

export type OperationalMapOrder = {
  id: string;
  orderId: string;
  shortId: string;
  customerName: string;
  status: OrderStatus;
  statusLabel: string;
  urgencyLabel: string;
  pickup: OperationalMapPoint;
  dropoff: OperationalMapPoint;
  handoff: OperationalMapPoint | null;
  activePoint: GeoPoint | null;
  dronePoint: GeoPoint | null;
  droneHeadingDegrees: number | null;
  assignedDroneLabel: string;
  routePoints: GeoPoint[];
  etaLabel: string;
  price: MoneyAmount | null;
  href: string;
  hasCompleteRoute: boolean;
  updatedAt: string;
};

export type OperationalDroneMarker = {
  id: string;
  orderId: string;
  label: string;
  coordinates: GeoPoint;
  headingDegrees: number;
  statusLabel: string;
  batteryPercent: number | null;
};

export type OperationalIncidentKind = "failed_order" | "locker_recovery";

export type OperationalIncident = {
  id: string;
  kind: OperationalIncidentKind;
  orderId: string;
  shortOrderId: string;
  title: string;
  description: string;
  priority: AdminPriority;
  priorityLabel: string;
  statusLabel: string;
  locationLabel: string;
  coordinates: GeoPoint | null;
  href: string;
  lockerId: string | null;
  lockerStatus: LockerRecoveryStatus | null;
  createdAt: string;
  updatedAt: string;
};

export type OperationalEventTone = "neutral" | "info" | "success" | "warning" | "destructive";

export type OperationalEvent = {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  tone: OperationalEventTone;
  target: OperationalSelection | null;
};

export type OperationalContactMessage = {
  id: string;
  email: string;
  subject: string;
  categoryLabel: string;
  statusLabel: string;
  createdAt: string;
  href: string;
};

export type OperationalPlatformSnapshot = {
  status: OperationalPlatformStatus;
  statusLabel: string;
  serviceRadiusKm: number;
  hubAddressLabel: string;
  updatedAt: string | null;
};

export type OperationalHubSnapshot = {
  id: string;
  name: string;
  addressLabel: string;
  coordinates: GeoPoint;
};

export type OperationalCenterData = {
  generatedAt: string;
  hub: OperationalHubSnapshot;
  kpis: OperationalKpi[];
  activeOrders: OperationalMapOrder[];
  droneMarkers: OperationalDroneMarker[];
  incidents: OperationalIncident[];
  parcelEvaluations: OperatorParcelEvaluation[];
  contactMessages: OperationalContactMessage[];
  platform: OperationalPlatformSnapshot;
  events: OperationalEvent[];
  missingCoordinateCount: number;
};
