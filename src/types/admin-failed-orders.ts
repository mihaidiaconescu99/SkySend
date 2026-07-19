import type {
  AdminCustomerNotificationStatus,
  AdminFailureReasonCode,
  AdminOrder,
  AdminParcelLocation,
  AdminRefundStatus,
  AdminResolutionStatus,
  FailedOrderRecord,
} from "@/types/admin";

export type FailureReasonCode = AdminFailureReasonCode;
export type FailureReasonLabel = string;
export type ParcelCurrentLocation = AdminParcelLocation;
export type FailedOrderResolutionStatus = AdminResolutionStatus;
export type CustomerNotificationStatus = AdminCustomerNotificationStatus;
export type RefundStatus = AdminRefundStatus;

export type AdminFailedOrderDetail = FailedOrderRecord & {
  order: AdminOrder | null;
  clientEmail: string | null;
  parcelStatusLabel: string;
  assignedDroneLabel: string;
  internalNotes: string | null;
  auditEventCount: number;
  failedOrderHref: string;
  lockerRecoveryHref: string | null;
};

export type AdminFailedOrderUpdatePatch = Partial<{
  resolutionStatus: FailedOrderResolutionStatus;
  refundStatus: RefundStatus;
  customerNotificationStatus: CustomerNotificationStatus;
  internalNotes: string | null;
}>;
