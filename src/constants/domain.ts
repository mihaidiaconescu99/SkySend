import type {
  DeliveryUrgency,
  DroneClass,
  NotificationType,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";
import type { UserRole } from "@/types/roles";
import type { Option } from "@/types/ui";

export const userRoleLabels: Record<UserRole, string> = {
  client: "Client",
  admin: "Admin",
  operator: "Operator",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: "Ciornă",
  scheduled: "Programată",
  queued: "În așteptare",
  in_flight: "În zbor",
  delivered: "Livrare finalizată",
  failed: "Livrare failed",
  cancelled: "Comandă anulată",
  returned: "Colet returnat",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "În așteptare",
  authorized: "Autorizată",
  paid: "Plată confirmată",
  refunded: "Rambursată",
  failed: "Plată eșuată",
};

export const deliveryUrgencyLabels: Record<DeliveryUrgency, string> = {
  standard: "Livrare standard",
  priority: "Livrare prioritară",
  critical: "Critică",
};

export const droneClassLabels: Record<DroneClass, string> = {
  light_swift: "Light Swift",
  light_secure: "Light Secure",
  medium_standard: "Medium Standard",
  medium_stabilized: "Medium Stabilized",
  medium_long_range: "Medium Long Range",
  heavy_cargo: "Heavy Cargo",
  heavy_max: "Heavy Max",
  light_express: "Light Swift",
  standard_courier: "Medium Standard",
  fragile_care: "Medium Stabilized",
  long_range: "Medium Long Range",
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  info: "Informație",
  success: "Succes",
  warning: "Avertizare",
  critical: "Critică",
  system: "Sistem",
};

export const userRoleOptions: Option<UserRole>[] = [
  { label: userRoleLabels.client, value: "client" },
  { label: userRoleLabels.admin, value: "admin" },
  { label: userRoleLabels.operator, value: "operator" },
];

export const orderStatusOptions: Option<OrderStatus>[] = [
  { label: orderStatusLabels.draft, value: "draft" },
  { label: orderStatusLabels.scheduled, value: "scheduled" },
  { label: orderStatusLabels.queued, value: "queued" },
  { label: orderStatusLabels.in_flight, value: "in_flight" },
  { label: orderStatusLabels.delivered, value: "delivered" },
  { label: orderStatusLabels.failed, value: "failed" },
  { label: orderStatusLabels.cancelled, value: "cancelled" },
  { label: orderStatusLabels.returned, value: "returned" },
];

export const paymentStatusOptions: Option<PaymentStatus>[] = [
  { label: paymentStatusLabels.pending, value: "pending" },
  { label: paymentStatusLabels.authorized, value: "authorized" },
  { label: paymentStatusLabels.paid, value: "paid" },
  { label: paymentStatusLabels.refunded, value: "refunded" },
  { label: paymentStatusLabels.failed, value: "failed" },
];

export const deliveryUrgencyOptions: Option<DeliveryUrgency>[] = [
  { label: deliveryUrgencyLabels.standard, value: "standard" },
  { label: deliveryUrgencyLabels.priority, value: "priority" },
  { label: deliveryUrgencyLabels.critical, value: "critical" },
];

export const droneClassOptions: Option<DroneClass>[] = [
  { label: droneClassLabels.light_swift, value: "light_swift" },
  { label: droneClassLabels.light_secure, value: "light_secure" },
  { label: droneClassLabels.medium_standard, value: "medium_standard" },
  { label: droneClassLabels.medium_stabilized, value: "medium_stabilized" },
  { label: droneClassLabels.medium_long_range, value: "medium_long_range" },
  { label: droneClassLabels.heavy_cargo, value: "heavy_cargo" },
  { label: droneClassLabels.heavy_max, value: "heavy_max" },
];

export const notificationTypeOptions: Option<NotificationType>[] = [
  { label: notificationTypeLabels.info, value: "info" },
  { label: notificationTypeLabels.success, value: "success" },
  { label: notificationTypeLabels.warning, value: "warning" },
  { label: notificationTypeLabels.critical, value: "critical" },
  { label: notificationTypeLabels.system, value: "system" },
];
