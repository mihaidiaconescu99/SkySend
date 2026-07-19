import {
  adminFailureReasonLabels,
  adminOrderStatusLabels,
  adminRefundStatusLabels,
  createExportRequest,
  getAdminOrdersWithRuntime,
} from "@/lib/admin-data";
import { getAdminContactMessageDetails } from "@/lib/admin-contact-messages";
import { getAdminFailedOrderDetails } from "@/lib/admin-failed-orders";
import { getAdminLockerRecoveryDetails } from "@/lib/admin-locker-recoveries";
import type {
  AdminFailureReasonCode,
  ExportFilters,
  AdminOrder,
} from "@/types/admin";
import type {
  AdminCsvExportResult,
  AdminExportFilter,
  AdminExportKind,
} from "@/types/admin-statistics";

export const defaultAdminExportFilters: AdminExportFilter = {
  dateFrom: "",
  dateTo: "",
  orderStatus: "all",
  refundStatus: "all",
  incidentType: "all",
  droneClass: "all",
  areaQuery: "",
};

export const adminExportKindLabels: Record<AdminExportKind, string> = {
  orders: "Comenzi",
  failed_orders: "Incidente",
  locker_recoveries: "Recuperări locker",
  contact_messages: "Mesaje",
  general_report: "Raport operațional",
};

type CsvRow = Record<string, string | number | boolean | null | undefined>;

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ro-RO");
}

function parseDateBoundary(value: string, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
  const timestamp = Date.parse(`${value}${suffix}`);

  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasInvalidDateRange(filters: AdminExportFilter) {
  const from = parseDateBoundary(filters.dateFrom, "start");
  const to = parseDateBoundary(filters.dateTo, "end");

  return from !== null && to !== null && from > to;
}

function isInDateRange(value: string | null | undefined, filters: AdminExportFilter) {
  if (!value) {
    return true;
  }

  const timestamp = Date.parse(value);
  const from = parseDateBoundary(filters.dateFrom, "start");
  const to = parseDateBoundary(filters.dateTo, "end");

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return (from === null || timestamp >= from) && (to === null || timestamp <= to);
}

function matchesAreaQuery(texts: (string | null | undefined)[], filters: AdminExportFilter) {
  const query = normalizeSearch(filters.areaQuery);

  if (!query) {
    return true;
  }

  return texts.some((text) => normalizeSearch(text ?? "").includes(query));
}

function formatMoneyMinor(amountMinor?: number | null) {
  if (amountMinor === null || amountMinor === undefined) {
    return "";
  }

  return (amountMinor / 100).toFixed(2);
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

function getEstimatedRevenueMinor(orders: AdminOrder[]) {
  return orders
    .filter((order) => order.payment.status !== "failed")
    .filter((order) => order.payment.status !== "refunded")
    .filter((order) => order.status !== "cancelled")
    .reduce((total, order) => total + (order.price?.amountMinor ?? 0), 0);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getFilteredOrders(filters: AdminExportFilter) {
  return getAdminOrdersWithRuntime()
    .filter((order) => isInDateRange(order.createdAt, filters))
    .filter((order) => filters.orderStatus === "all" || order.status === filters.orderStatus)
    .filter((order) => filters.refundStatus === "all" || order.refund.status === filters.refundStatus)
    .filter((order) => filters.droneClass === "all" || order.assignedDroneClass === filters.droneClass)
    .filter((order) =>
      matchesAreaQuery(
        [
          order.pickup?.label,
          order.dropoff?.label,
          order.meetingPoints.active?.label,
          order.customer.name,
        ],
        filters,
      ),
    );
}

function getOrderRows(filters: AdminExportFilter): CsvRow[] {
  return getFilteredOrders(filters)
    .map((order) => ({
      "ID comandă": order.id,
      Client: order.customer.name,
      Email: order.customer.email,
      Status: order.statusLabel,
      "Status plată": order.payment.statusLabel,
      "Status rambursare": order.refund.statusLabel,
      Pickup: order.pickup?.label,
      Dropoff: order.dropoff?.label,
      "Punct întâlnire": order.meetingPoints.active?.label,
      "Drona / modul": order.assignedDroneClassLabel,
      "Preț RON": formatMoneyMinor(order.price?.amountMinor),
      "Creat la": order.createdAt,
      "Actualizat la": order.updatedAt,
    }));
}

function getFailedOrderRows(filters: AdminExportFilter): CsvRow[] {
  return getAdminFailedOrderDetails()
    .filter((order) => isInDateRange(order.failedAt ?? order.createdAt, filters))
    .filter((order) => filters.refundStatus === "all" || order.refundStatus === filters.refundStatus)
    .filter((order) => filters.incidentType === "all" || order.reasonCode === filters.incidentType)
    .filter((order) => filters.droneClass === "all" || order.order?.assignedDroneClass === filters.droneClass)
    .filter((order) =>
      matchesAreaQuery(
        [order.parcelLocation.label, order.customer.name, order.clientEmail],
        filters,
      ),
    )
    .map((order) => ({
      "ID comandă": order.orderId,
      Client: order.customer.name,
      Email: order.clientEmail,
      "Motiv eșec": order.reasonLabel,
      "Locație colet": order.parcelLocation.label,
      "Status rambursare": order.refundStatusLabel,
      "Notificare client": order.customerNotificationStatusLabel,
      Prioritate: order.priorityLabel,
      Rezolvare: order.resolutionStatusLabel,
      "Data eșec": order.failedAt,
    }));
}

function getLockerRecoveryRows(filters: AdminExportFilter): CsvRow[] {
  return getAdminLockerRecoveryDetails()
    .filter((incident) => isInDateRange(incident.detachedAt ?? incident.createdAt, filters))
    .filter(() =>
      filters.incidentType === "all"
        ? true
        : filters.incidentType === "locker_detached_recovery_required" ||
          filters.incidentType === "payload_over_limit",
    )
    .filter((incident) =>
      matchesAreaQuery(
        [incident.exactLocation, incident.meetingPoint?.label, incident.customer.name],
        filters,
      ),
    )
    .map((incident) => ({
      "ID locker": incident.lockerId,
      "ID comandă": incident.orderId,
      Client: incident.customer.name,
      "Locație exactă": incident.exactLocation,
      Latitudine: incident.coordinates?.latitude,
      Longitudine: incident.coordinates?.longitude,
      "Greutate estimată kg": incident.estimatedWeightKg,
      "Greutate detectată kg": incident.detectedWeightKg,
      "Limită dronă kg": incident.limitKg,
      "Timp pe teren minute": incident.minutesOnField,
      Operator: incident.assignedOperatorName,
      Status: incident.statusLabel,
      "Detașat la": incident.detachedAt,
    }));
}

function getContactMessageRows(filters: AdminExportFilter): CsvRow[] {
  return getAdminContactMessageDetails()
    .filter((message) => isInDateRange(message.createdAt, filters))
    .filter((message) =>
      matchesAreaQuery(
        [
          message.email,
          message.subject,
          message.categoryLabel,
          message.message,
          message.internalNote,
          message.preparedReply,
        ],
        filters,
      ),
    )
    .map((message) => ({
      Email: message.email,
      Subiect: message.subject,
      Categorie: message.categoryLabel,
      Mesaj: message.message,
      Status: message.statusLabel,
      "Notă internă": message.internalNote,
      "Răspuns pregătit": message.preparedReply,
      "Trimis la": message.createdAt,
      "Actualizat la": message.updatedAt,
    }));
}

function getGeneralReportRows(filters: AdminExportFilter): CsvRow[] {
  const orders = getFilteredOrders(filters);
  const activeOrders = orders.filter(isActive);
  const completedOrders = orders.filter(isCompleted);
  const failedOrders = orders.filter(isFailed);
  const successRate =
    orders.length > 0 ? (completedOrders.length / orders.length) * 100 : 0;

  return [
    {
      Indicator: "Comenzi totale",
      Valoare: orders.length,
      Detalii: "După filtrele curente",
    },
    {
      Indicator: "Comenzi active",
      Valoare: activeOrders.length,
      Detalii: "Comenzi care nu sunt finalizate și nu sunt eșuate",
    },
    {
      Indicator: "Livrări finalizate",
      Valoare: completedOrders.length,
      Detalii: "Comenzi cu status finalizat",
    },
    {
      Indicator: "Comenzi eșuate",
      Valoare: failedOrders.length,
      Detalii: "Include comenzi anulate, eșuate și fallback operațional",
    },
    {
      Indicator: "Venit estimat RON",
      Valoare: formatMoneyMinor(getEstimatedRevenueMinor(orders)),
      Detalii: "Comenzi neanulate și nerambursate",
    },
    {
      Indicator: "Rata succes",
      Valoare: formatPercent(successRate),
      Detalii: "Livrări finalizate raportate la total comenzi",
    },
  ];
}

function getRows(kind: AdminExportKind, filters: AdminExportFilter): CsvRow[] | null {
  switch (kind) {
    case "orders":
      return getOrderRows(filters);
    case "failed_orders":
      return getFailedOrderRows(filters);
    case "locker_recoveries":
      return getLockerRecoveryRows(filters);
    case "contact_messages":
      return getContactMessageRows(filters);
    case "general_report":
      return getGeneralReportRows(filters);
  }
}

function csvEscape(value: CsvRow[string]) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(rows: CsvRow[]) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

function createFilename(kind: AdminExportKind) {
  const stamp = new Date().toISOString().slice(0, 10);

  return `skysend-${kind.replace(/_/g, "-")}-${stamp}.csv`;
}

function toStoredExportFilters(filters: AdminExportFilter): ExportFilters {
  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    orderStatus:
      filters.orderStatus === "all" ? undefined : filters.orderStatus,
    refundStatus:
      filters.refundStatus === "all" ? undefined : filters.refundStatus,
    incidentType:
      filters.incidentType === "all" ? undefined : filters.incidentType,
    droneClass:
      filters.droneClass === "all"
        ? undefined
        : (filters.droneClass as ExportFilters["droneClass"]),
    areaQuery: filters.areaQuery.trim() || undefined,
  };
}

export function prepareAdminCsvExport(
  kind: AdminExportKind,
  filters: AdminExportFilter,
): AdminCsvExportResult {
  if (hasInvalidDateRange(filters)) {
    return {
      ok: false,
      reason: "invalid_date_range",
      rowCount: 0,
    };
  }

  const rows = getRows(kind, filters);

  if (!rows) {
    return {
      ok: false,
      reason: "unsupported",
      rowCount: 0,
    };
  }

  if (rows.length === 0) {
    createExportRequest({
      kind,
      format: "csv",
      filters: toStoredExportFilters(filters),
    });

    return {
      ok: false,
      reason: "no_results",
      rowCount: 0,
    };
  }

  createExportRequest({
    kind,
    format: "csv",
    filters: toStoredExportFilters(filters),
  });

  return {
    ok: true,
    kind,
    filename: createFilename(kind),
    csv: toCsv(rows),
    rowCount: rows.length,
  };
}

export function getAvailableExportFilterOptions() {
  const orders = getAdminOrdersWithRuntime();
  const incidentCodes = new Set<AdminFailureReasonCode>();
  const failedOrders = getAdminFailedOrderDetails();

  failedOrders.forEach((order) => incidentCodes.add(order.reasonCode));
  getAdminLockerRecoveryDetails().forEach(() => {
    incidentCodes.add("locker_detached_recovery_required");
    incidentCodes.add("payload_over_limit");
  });

  return {
    orderStatuses: [...new Set(orders.map((order) => order.status))].map((status) => ({
      value: status,
      label: adminOrderStatusLabels[status],
    })),
    refundStatuses: [...new Set(orders.map((order) => order.refund.status))].map(
      (status) => ({
        value: status,
        label: adminRefundStatusLabels[status],
      }),
    ),
    incidentTypes: [...incidentCodes].map((reasonCode) => ({
      value: reasonCode,
      label: adminFailureReasonLabels[reasonCode],
    })),
    droneClasses: [
      ...new Map(
        orders
          .filter((order): order is AdminOrder & { assignedDroneClass: string } =>
            Boolean(order.assignedDroneClass),
          )
          .map((order) => [
            order.assignedDroneClass,
            {
              value: order.assignedDroneClass,
              label: order.assignedDroneClassLabel,
            },
          ]),
      ).values(),
    ],
  };
}
