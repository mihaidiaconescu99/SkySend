import type { DeliveryUrgency, DroneClass, OrderStatus, PaymentStatus } from "@/types/domain";
import type {
  AdminOrder,
  AdminOrderAuditEvent,
  AdminOrderEditablePatch,
} from "@/types/admin";

export type AdminOrderReviewStatus = "clear" | "needs_review" | "resolved";
export type AdminOrderDetail = AdminOrder;
export type AdminOrderDetailPatch = AdminOrderEditablePatch;
export type AdminOrderDetailAuditEvent = AdminOrderAuditEvent;

export type AdminOrderManagementRow = {
  id: string;
  clientName: string;
  clientCompany: string | null;
  pickupSummary: string;
  dropoffSummary: string;
  status: OrderStatus;
  urgency: DeliveryUrgency;
  paymentStatus: PaymentStatus | "missing";
  paymentStatusLabel: string;
  assignedDroneClass: DroneClass | null;
  assignedDroneClassLabel: string;
  createdAt: string;
  scheduledFor: string | null;
  reviewStatus: AdminOrderReviewStatus;
  reviewReason: string;
};
