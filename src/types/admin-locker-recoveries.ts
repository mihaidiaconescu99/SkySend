import type {
  AdminOrderAuditEvent,
  LockerRecoveryIncident,
  LockerRecoveryStatus,
} from "@/types/admin";
import type { GeoPoint } from "@/types/service-area";

export type LockerLocationSnapshot = {
  label: string | null;
  coordinates: GeoPoint | null;
  dataCompleteness: LockerRecoveryIncident["dataCompleteness"];
  meetingPointLabel: string | null;
};

export type LockerWeightDetection = {
  estimatedWeightKg: number | null;
  detectedWeightKg: number | null;
  limitKg: number | null;
  isOverLimit: boolean | null;
};

export type AssignedRecoveryOperator = {
  id: string | null;
  name: string | null;
};

export type LockerRecoveryStatusHistoryEvent = {
  id: string;
  incidentId: string;
  status: LockerRecoveryStatus;
  statusLabel: string;
  actorId: string;
  actorName: string | null;
  note: string | null;
  createdAt: string;
};

export type AdminLockerRecoveryDetail = LockerRecoveryIncident & {
  location: LockerLocationSnapshot;
  weightDetection: LockerWeightDetection;
  assignedOperator: AssignedRecoveryOperator;
  internalNote: string | null;
  clientNotified: boolean;
  statusHistory: LockerRecoveryStatusHistoryEvent[];
  orderHref: string;
  failedOrderHref: string;
  googleMapsHref: string | null;
  isResolved: boolean;
};

export type AdminLockerRecoveryUpdatePatch = Partial<{
  status: LockerRecoveryStatus;
  assignedOperatorId: string | null;
  assignedOperatorName: string | null;
  internalNote: string | null;
  clientNotified: boolean;
}>;

export type AdminLockerRecoveryUpdateResult =
  | {
      ok: true;
      incident: AdminLockerRecoveryDetail;
      auditEvents: AdminOrderAuditEvent[];
      persistence: "local_only";
    }
  | {
      ok: false;
      reason: "not_found" | "storage_unavailable";
      incident: null;
      auditEvents: [];
    };

