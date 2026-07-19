import type {
  CreatedDeliveryFallbackOutcome,
  CreatedDeliveryFulfillmentStatus,
  CreatedDeliveryPaymentStatus,
  CreateDeliverySubmitStatus,
} from "@/types/create-delivery";
import type {
  DeliveryUrgency,
  DroneClass,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";
import type {
  CargoModuleId,
  DeliveryPlatformId,
  ParcelDimensions,
} from "@/types/drone";
import type {
  AddressSnapshot,
  ContactPoint,
  DeliveryOrderId,
  EntityTimestamps,
  ISODateTimeString,
  MoneyAmount,
  OrderPointId,
  ParcelId,
  UserProfileId,
} from "@/types/entities";
import type { LockerId, MissionFailureReason, MissionId } from "@/types/mission";
import type { UserRole } from "@/types/roles";
import type { GeoPoint } from "@/types/service-area";
import type { Json } from "@/types/database";

export type AdminDataSource =
  | "mock"
  | "runtime_local"
  | "admin_override"
  | "supabase"
  | "default_config";

export type AdminPersistenceState =
  | "persisted"
  | "local_only"
  | "not_persisted";

export type AdminRole = Extract<UserRole, "admin" | "operator">;
export type AdminAuditActorRole = AdminRole | "system";

export type AdminAuditActor = {
  actorId: string;
  actorRole: AdminAuditActorRole;
  actorName?: string | null;
};

export type AdminPaymentStatus =
  | PaymentStatus
  | CreatedDeliveryPaymentStatus
  | "missing";

export type AdminRefundStatus =
  | "not_required"
  | "pending"
  | "started"
  | "completed"
  | "failed"
  | "unknown";

export type AdminParcelStatus =
  | "unconfirmed"
  | "waiting_for_load"
  | "loaded"
  | "in_transit"
  | "delivered"
  | "returned_to_hub"
  | "secured_in_locker"
  | "unknown";

export type AdminFailureReasonCode =
  | "meeting_point_confirmation_timeout"
  | "customer_rejected_meeting_points"
  | "parcel_load_timeout"
  | "parcel_unload_timeout"
  | "customer_unavailable"
  | "payload_over_limit"
  | "locker_detached_recovery_required"
  | "system_cancelled"
  | "handoff_zone_unavailable"
  | "payment_failed"
  | "return_to_hub_required"
  | "no_suitable_pickup_meeting_point"
  | "no_suitable_dropoff_meeting_point"
  | "unknown";

export type AdminResolutionStatus =
  | "open"
  | "in_progress"
  | "waiting_for_customer"
  | "resolved"
  | "archived";

export type AdminCustomerNotificationStatus =
  | "not_required"
  | "not_sent"
  | "queued"
  | "sent"
  | "prepared"
  | "unknown";

export type AdminPriority = "low" | "normal" | "high" | "urgent";

export type AdminPointSnapshot = {
  id: OrderPointId | string | null;
  label: string;
  address: AddressSnapshot | null;
  coordinates: GeoPoint | null;
  contact: ContactPoint | null;
  notes: string | null;
  source: AdminDataSource;
};

export type AdminMeetingPointSnapshot = {
  id: string | null;
  label: string;
  type: string | null;
  description: string | null;
  coordinates: GeoPoint | null;
  distanceFromOriginMeters: number | null;
  source: AdminDataSource;
};

export type AdminOrderMeetingPoints = {
  pickup: AdminMeetingPointSnapshot | null;
  dropoff: AdminMeetingPointSnapshot | null;
  active: AdminMeetingPointSnapshot | null;
};

export type AdminCustomerSnapshot = {
  profileId: UserProfileId | string | null;
  clerkUserId: string | null;
  name: string;
  email: string | null;
  phoneE164: string | null;
  companyName: string | null;
};

export type AdminDeliveryConfigurationSnapshot = {
  id: CargoModuleId | string | null;
  platform: DeliveryPlatformId | null;
  moduleName: string | null;
  droneClass: DroneClass | null;
  label: string;
  maxPayloadKg: number | null;
  maxVolumeLiters: number | null;
  maxDimensionsCm: ParcelDimensions | null;
};

export type AdminParcelSnapshot = {
  id: ParcelId | string | null;
  summary: string | null;
  category: string | null;
  packagingType: string | null;
  fragileLevel: string | null;
  estimatedWeightKg: number | null;
  detectedWeightKg: number | null;
  estimatedWeightRangeLabel: string | null;
  dimensionsCm: ParcelDimensions | null;
  aiEstimateLabel: string | null;
  declaredValue: MoneyAmount | null;
  selectedConfiguration: AdminDeliveryConfigurationSnapshot | null;
};

export type AdminPaymentSnapshot = {
  id: string | null;
  provider: string | null;
  status: AdminPaymentStatus;
  statusLabel: string;
  amount: MoneyAmount | null;
  capturedAmount: MoneyAmount | null;
  providerReference: string | null;
  paidAt: ISODateTimeString | null;
  failedAt: ISODateTimeString | null;
  failureReason: string | null;
};

export type AdminRefundSnapshot = {
  status: AdminRefundStatus;
  statusLabel: string;
  amount: MoneyAmount | null;
  reason: string | null;
};

export type AdminEtaSnapshot = {
  minMinutes: number | null;
  maxMinutes: number | null;
  scheduledFor: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
};

export type AdminOrderEditablePatch = Partial<{
  status: OrderStatus;
  parcelStatus: AdminParcelStatus;
  meetingPoints: AdminOrderMeetingPoints;
  estimatedWeightKg: number | null;
  detectedWeightKg: number | null;
  dimensionsCm: ParcelDimensions | null;
  price: MoneyAmount | null;
  paymentStatus: AdminPaymentStatus;
  refundStatus: AdminRefundStatus;
  refundReason: string | null;
  internalNotes: string | null;
  failureReasonCode: AdminFailureReasonCode | null;
  failureReasonLabel: string | null;
  resolutionStatus: AdminResolutionStatus | null;
  customerNotificationStatus: AdminCustomerNotificationStatus;
}>;

export type AdminEditableField = keyof AdminOrderEditablePatch;

export type AdminOrderAuditEvent = {
  id: string;
  orderId: DeliveryOrderId | string;
  actorId: string;
  actorRole: AdminAuditActorRole;
  actorName: string | null;
  field: AdminEditableField | string;
  oldValue: Json;
  newValue: Json;
  reason: string | null;
  createdAt: ISODateTimeString;
};

export type AdminOrder = EntityTimestamps & {
  id: DeliveryOrderId | string;
  source: AdminDataSource;
  persistence: AdminPersistenceState;
  href: string | null;
  customer: AdminCustomerSnapshot;
  pickup: AdminPointSnapshot | null;
  dropoff: AdminPointSnapshot | null;
  meetingPoints: AdminOrderMeetingPoints;
  status: OrderStatus;
  statusLabel: string;
  urgency: DeliveryUrgency | "scheduled" | null;
  urgencyLabel: string;
  fulfillmentStatus: CreatedDeliveryFulfillmentStatus | null;
  submitStatus: CreateDeliverySubmitStatus | null;
  missionId: MissionId | string | null;
  missionStatus: string | null;
  parcelStatus: AdminParcelStatus;
  parcelStatusLabel: string;
  parcel: AdminParcelSnapshot;
  assignedDroneClass: DroneClass | null;
  assignedDroneClassLabel: string;
  price: MoneyAmount | null;
  payment: AdminPaymentSnapshot;
  refund: AdminRefundSnapshot;
  eta: AdminEtaSnapshot;
  internalNotes: string | null;
  failureReasonCode:
    | AdminFailureReasonCode
    | MissionFailureReason
    | CreatedDeliveryFallbackOutcome
    | null;
  failureReasonLabel: string | null;
  originalFailureReason: string | null;
  resolutionStatus: AdminResolutionStatus | null;
  resolutionStatusLabel: string | null;
  customerNotificationStatus: AdminCustomerNotificationStatus;
  customerNotificationStatusLabel: string;
  editableFields: readonly AdminEditableField[];
  readOnlyFields: readonly string[];
  auditTrail: AdminOrderAuditEvent[];
  metadata: {
    publicTrackingCode: string | null;
    recipientTrackingToken: string | null;
    serviceAreaEligible: boolean | null;
    warehousePickupRequired: boolean | null;
    sourceRecordId: string | null;
  };
};

export type AdminParcelLocation = {
  label: string;
  address: AddressSnapshot | null;
  coordinates: GeoPoint | null;
  source: AdminDataSource;
};

export type FailedOrderRecord = {
  id: string;
  orderId: DeliveryOrderId | string;
  source: AdminDataSource;
  customer: AdminCustomerSnapshot;
  reasonCode: AdminFailureReasonCode;
  reasonLabel: string;
  originalReason: string | null;
  dronePickedUpParcel: boolean | null;
  parcelLocation: AdminParcelLocation;
  refundStatus: AdminRefundStatus;
  refundStatusLabel: string;
  customerNotificationStatus: AdminCustomerNotificationStatus;
  customerNotificationStatusLabel: string;
  priority: AdminPriority;
  priorityLabel: string;
  failedAt: ISODateTimeString | null;
  resolutionStatus: AdminResolutionStatus;
  resolutionStatusLabel: string;
  hasLockerRecoveryIncident: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type LockerRecoveryStatus =
  | "locker_detached"
  | "operator_dispatched"
  | "locker_recovered"
  | "parcel_returned_to_hub"
  | "customer_notified"
  | "resolved";

export type LockerRecoveryIncident = {
  id: string;
  lockerId: LockerId | string;
  orderId: DeliveryOrderId | string;
  source: AdminDataSource;
  exactLocation: string | null;
  coordinates: GeoPoint | null;
  meetingPoint: AdminMeetingPointSnapshot | null;
  customer: AdminCustomerSnapshot;
  estimatedWeightKg: number | null;
  detectedWeightKg: number | null;
  limitKg: number | null;
  detachedAt: ISODateTimeString | null;
  minutesOnField: number | null;
  assignedOperatorId: UserProfileId | string | null;
  assignedOperatorName: string | null;
  status: LockerRecoveryStatus;
  statusLabel: string;
  priority: Extract<AdminPriority, "high" | "urgent">;
  dataCompleteness: "exact" | "partial" | "missing_coordinates";
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type ContactMessageStatus =
  | "new"
  | "read"
  | "replied"
  | "in_progress"
  | "prepared_reply"
  | "archived";

export type ContactMessage = EntityTimestamps & {
  id: string;
  source: AdminDataSource;
  persistence: AdminPersistenceState;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: ContactMessageStatus;
  statusLabel: string;
  internalNote: string | null;
  preparedReply: string | null;
  readAt: ISODateTimeString | null;
  archivedAt: ISODateTimeString | null;
};

export type OperationalPlatformStatus =
  | "active"
  | "maintenance";

export type OperationalSettings = {
  id: "default";
  source: AdminDataSource;
  persistence: AdminPersistenceState;
  serviceRadiusKm: number;
  hubAddress: AddressSnapshot;
  basePrice: MoneyAmount;
  pricePerKm: MoneyAmount;
  timeouts: {
    meetingPointConfirmationMinutes: number;
    parcelLoadMinutes: number;
    parcelUnloadMinutes: number;
  };
  platformStatus: OperationalPlatformStatus;
  platformStatusLabel: string;
  updatedAt: ISODateTimeString | null;
  updatedBy: string | null;
};

export type ExportFormat = "csv" | "pdf";

export type ExportKind =
  | "orders"
  | "failed_orders"
  | "locker_recoveries"
  | "contact_messages"
  | "general_report";

export type ExportRequestStatus =
  | "prepared"
  | "queued"
  | "completed"
  | "failed"
  | "unsupported";

export type ExportFilters = Partial<{
  dateFrom: ISODateTimeString;
  dateTo: ISODateTimeString;
  orderStatus: OrderStatus;
  refundStatus: AdminRefundStatus;
  incidentType: AdminFailureReasonCode;
  droneClass: DroneClass;
  areaQuery: string;
}>;

export type ExportRequest = {
  id: string;
  kind: ExportKind;
  format: ExportFormat;
  filters: ExportFilters;
  status: ExportRequestStatus;
  statusLabel: string;
  requestedBy: AdminAuditActor | null;
  createdAt: ISODateTimeString;
  completedAt: ISODateTimeString | null;
  downloadHref: string | null;
  errorMessage: string | null;
};
