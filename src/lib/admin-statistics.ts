import { getAdminOrdersWithRuntime } from "@/lib/admin-data";
import type { AdminOrder } from "@/types/admin";
import type { AdminStatisticsSnapshot } from "@/types/admin-statistics";
import type { MoneyAmount } from "@/types/entities";

const currency = "RON" as const;

function money(amountMinor: number): MoneyAmount {
  return {
    amountMinor,
    currency,
  };
}

function formatMoney(value: MoneyAmount) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: value.currency,
  }).format(value.amountMinor / 100);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function isCompleted(order: AdminOrder) {
  return order.status === "delivered" || order.fulfillmentStatus === "completed_mission";
}

function isFailed(order: AdminOrder) {
  return (
    order.status === "failed" ||
    order.status === "cancelled" ||
    order.fulfillmentStatus === "failed_mission" ||
    order.fulfillmentStatus === "fallback_required" ||
    Boolean(order.failureReasonCode)
  );
}

function isActive(order: AdminOrder) {
  return !isCompleted(order) && !isFailed(order);
}

function getEstimatedRevenue(orders: AdminOrder[]) {
  return orders
    .filter((order) => order.payment.status !== "failed")
    .filter((order) => order.payment.status !== "refunded")
    .filter((order) => order.status !== "cancelled")
    .reduce((total, order) => total + (order.price?.amountMinor ?? 0), 0);
}

export function getAdminStatisticsSnapshot(adminOrders?: AdminOrder[]): AdminStatisticsSnapshot {
  const orders = adminOrders ?? getAdminOrdersWithRuntime();
  const activeOrders = orders.filter(isActive);
  const completedOrders = orders.filter(isCompleted);
  const failedOrders = orders.filter(isFailed);
  const estimatedRevenue = money(getEstimatedRevenue(orders));
  const successRate =
    orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0;
  const kpis = [
    {
      id: "orders-total",
      label: "Comenzi totale",
      value: `${orders.length}`,
      hint: "Comenzi din datele disponibile pentru admin.",
      tone: "info" as const,
    },
    {
      id: "orders-active",
      label: "Comenzi active",
      value: `${activeOrders.length}`,
      hint: "Comenzi care nu sunt finalizate si nu sunt esuate.",
      tone: activeOrders.length > 0 ? ("info" as const) : ("neutral" as const),
    },
    {
      id: "orders-completed",
      label: "Livrari finalizate",
      value: `${completedOrders.length}`,
      hint: "Comenzi cu status finalizat.",
      tone: "success" as const,
    },
    {
      id: "orders-failed",
      label: "Comenzi esuate",
      value: `${failedOrders.length}`,
      hint: "Include esecuri si fallback operational.",
      tone: failedOrders.length > 0 ? ("warning" as const) : ("neutral" as const),
    },
    {
      id: "estimated-revenue",
      label: "Venit estimat",
      value: formatMoney(estimatedRevenue),
      hint: "Calculat din preturile comenzilor neanulate.",
      tone: "info" as const,
    },
    {
      id: "success-rate",
      label: "Rata de succes",
      value: formatPercent(successRate),
      hint: "Livrari finalizate raportate la total comenzi.",
      tone: successRate >= 80 ? ("success" as const) : ("warning" as const),
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      completedOrders: completedOrders.length,
      failedOrders: failedOrders.length,
      estimatedRevenue,
      successRate,
    },
    kpis,
  };
}
