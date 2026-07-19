import type { OrderStatus } from "@/types/domain";
import type { DeliveryOrder } from "@/types/entities";

export type OrderDateField =
  | "createdAt"
  | "updatedAt"
  | "scheduledFor"
  | "completedAt";

export type OrderSortDirection = "asc" | "desc";

export type OrderProgressSnapshot = {
  value: number;
  label: string;
};

export type OrderTimelineItem = {
  key: string;
  label: string;
  date: string | null;
  status: "done" | "current" | "upcoming";
};

export type OrdersByStatus = Record<OrderStatus, DeliveryOrder[]>;
