import type { DeliveryUrgency, DroneClass, OrderStatus } from "@/types/domain";

export type OperatorTaskType =
  | "current"
  | "upcoming"
  | "pickup_validation"
  | "dropoff_validation"
  | "incident";

export type OperatorTaskActionState =
  | "open"
  | "pickup_started"
  | "package_loaded"
  | "dropoff_started"
  | "issue_reported";

export type OperatorTask = {
  id: string;
  orderId: string;
  type: OperatorTaskType;
  status: OrderStatus;
  statusLabel: string;
  pickupSummary: string;
  dropoffSummary: string;
  assignedDroneClass: DroneClass | null;
  assignedDroneClassLabel: string;
  priority: DeliveryUrgency;
  priorityLabel: string;
  requiredAction: string;
  scheduledFor: string | null;
  issueSummary?: string | null;
};

export type OperatorDashboardData = {
  currentTask: OperatorTask | null;
  upcomingTasks: OperatorTask[];
  pickupValidations: OperatorTask[];
  dropoffValidations: OperatorTask[];
  incidents: OperatorTask[];
};
