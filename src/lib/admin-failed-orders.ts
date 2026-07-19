import {
  adminCustomerNotificationStatusLabels,
  adminRefundStatusLabels,
  adminResolutionStatusLabels,
  getAdminOrdersWithRuntime,
  getFailedOrderRecords,
  updateAdminOrder,
} from "@/lib/admin-data";
import type {
  AdminAuditActor,
  AdminOrder,
  AdminOrderEditablePatch,
} from "@/types/admin";
import type {
  AdminFailedOrderDetail,
  AdminFailedOrderUpdatePatch,
} from "@/types/admin-failed-orders";

export function getAdminFailedOrderDetails(adminOrders?: AdminOrder[]): AdminFailedOrderDetail[] {
  const orders = adminOrders ?? getAdminOrdersWithRuntime();
  const orderById = new Map(orders.map((order) => [order.id, order]));

  return getFailedOrderRecords(adminOrders)
    .map((record) => {
      const order = orderById.get(record.orderId) ?? null;

      return {
        ...record,
        order,
        clientEmail: order?.customer.email ?? null,
        parcelStatusLabel: order?.parcelStatusLabel ?? "Necunoscut",
        assignedDroneLabel: order?.assignedDroneClassLabel ?? "Neatribuita",
        internalNotes: order?.internalNotes ?? null,
        auditEventCount: order?.auditTrail.length ?? 0,
        failedOrderHref: `/admin/failed-orders?orderId=${encodeURIComponent(
          record.orderId,
        )}`,
        lockerRecoveryHref: record.hasLockerRecoveryIncident
          ? `/admin/locker-recoveries?orderId=${encodeURIComponent(record.orderId)}`
          : null,
      } satisfies AdminFailedOrderDetail;
    })
    .sort((left, right) => {
      const leftDate = left.failedAt ?? left.updatedAt;
      const rightDate = right.failedAt ?? right.updatedAt;

      return Date.parse(rightDate) - Date.parse(leftDate);
    });
}

export function getAdminFailedOrderDetail(orderId: string) {
  return (
    getAdminFailedOrderDetails().find(
      (detail) => detail.orderId === orderId || detail.id === orderId,
    ) ?? null
  );
}

export function updateAdminFailedOrder({
  orderId,
  patch,
  actor,
  reason,
}: {
  orderId: string;
  patch: AdminFailedOrderUpdatePatch;
  actor: AdminAuditActor;
  reason?: string | null;
}) {
  const orderPatch: AdminOrderEditablePatch = {
    resolutionStatus: patch.resolutionStatus,
    refundStatus: patch.refundStatus,
    customerNotificationStatus: patch.customerNotificationStatus,
    internalNotes: patch.internalNotes,
  };

  if (patch.refundStatus === "started") {
    orderPatch.paymentStatus = "refund_pending";
  }

  if (patch.refundStatus === "completed") {
    orderPatch.paymentStatus = "refunded";
  }

  return updateAdminOrder({
    orderId,
    patch: orderPatch,
    actor,
    reason,
  });
}

export const failedOrderResolutionOptions = Object.entries(
  adminResolutionStatusLabels,
);

export const failedOrderRefundOptions = Object.entries(adminRefundStatusLabels);

export const failedOrderNotificationOptions = Object.entries(
  adminCustomerNotificationStatusLabels,
);
