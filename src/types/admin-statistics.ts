import type {
  AdminFailureReasonCode,
  AdminRefundStatus,
  ExportKind,
} from "@/types/admin";
import type { DroneClass, OrderStatus } from "@/types/domain";
import type { MoneyAmount } from "@/types/entities";

export type AdminStatisticKpi = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "success" | "warning" | "destructive" | "info";
};

export type AdminStatisticsSnapshot = {
  generatedAt: string;
  totals: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    failedOrders: number;
    estimatedRevenue: MoneyAmount;
    successRate: number;
  };
  kpis: AdminStatisticKpi[];
};

export type AdminExportKind = ExportKind;

export type AdminExportFilter = {
  dateFrom: string;
  dateTo: string;
  orderStatus: "all" | OrderStatus;
  refundStatus: "all" | AdminRefundStatus;
  incidentType: "all" | AdminFailureReasonCode;
  droneClass: "all" | DroneClass | string;
  areaQuery: string;
};

export type AdminCsvExportResult =
  | {
      ok: true;
      kind: AdminExportKind;
      filename: string;
      csv: string;
      rowCount: number;
    }
  | {
      ok: false;
      reason: "invalid_date_range" | "no_results" | "unsupported";
      rowCount: 0;
    };
