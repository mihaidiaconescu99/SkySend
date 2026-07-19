import { getAdminOrdersWithRuntime } from "@/lib/admin-data";
import type {
  AdminOrderManagementRow,
  AdminOrderReviewStatus,
} from "@/types/admin-orders";
import type { AdminOrder } from "@/types/admin";

function getReviewStatus(order: AdminOrder): AdminOrderReviewStatus {
  if (order.resolutionStatus === "resolved") {
    return "resolved";
  }

  if (
    order.status === "failed" ||
    order.status === "cancelled" ||
    order.payment.status === "failed" ||
    order.payment.status === "refunded" ||
    order.payment.status === "refund_pending" ||
    order.failureReasonCode ||
    (order.urgency === "critical" && order.status !== "delivered")
  ) {
    return "needs_review";
  }

  return "clear";
}

function getReviewReason(order: AdminOrder) {
  if (order.failureReasonLabel) {
    return order.failureReasonLabel;
  }

  if (order.status === "failed") {
    return order.originalFailureReason ?? "Livrarea necesita verificare administrativa.";
  }

  if (order.status === "cancelled") {
    return order.originalFailureReason ?? "Comanda anulata trebuie verificata.";
  }

  if (order.payment.status === "failed") {
    return order.payment.failureReason ?? "Plata a esuat inainte de inchiderea comenzii.";
  }

  if (order.payment.status === "refunded") {
    return "Plata este rambursata si trebuie corelata cu rezultatul livrarii.";
  }

  if (order.urgency === "critical" && order.status !== "delivered") {
    return "Comanda critica necesita vizibilitate operationala.";
  }

  return "Nu exista probleme active pentru aceasta comanda.";
}

export function getAdminOrderManagementRows(): AdminOrderManagementRow[] {
  return getAdminOrdersWithRuntime().map((order) => {
    const reviewStatus = getReviewStatus(order);

    return {
      id: order.id,
      clientName: order.customer.name,
      clientCompany: order.customer.companyName,
      pickupSummary: order.pickup?.label ?? "Locatie de ridicare indisponibila",
      dropoffSummary: order.dropoff?.label ?? "Locatie de livrare indisponibila",
      status: order.status,
      urgency: order.urgency === "scheduled" || !order.urgency ? "standard" : order.urgency,
      paymentStatus:
        order.payment.status === "unpaid" ||
        order.payment.status === "processing" ||
        order.payment.status === "refund_pending"
          ? "pending"
          : order.payment.status,
      paymentStatusLabel: order.payment.statusLabel,
      assignedDroneClass: order.assignedDroneClass,
      assignedDroneClassLabel: order.assignedDroneClassLabel,
      createdAt: order.createdAt,
      scheduledFor: order.eta.scheduledFor,
      reviewStatus,
      reviewReason: getReviewReason(order),
    } satisfies AdminOrderManagementRow;
  });
}

export function getAdminOrderDetails() {
  return getAdminOrdersWithRuntime();
}

export function getAdminOrderDetail(orderId: string) {
  return getAdminOrdersWithRuntime().find((order) => order.id === orderId) ?? null;
}
