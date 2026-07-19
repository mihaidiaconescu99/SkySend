export type OrderStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "in_flight"
  | "delivered"
  | "failed"
  | "cancelled"
  | "returned";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "refunded"
  | "failed";

export type DeliveryUrgency = "standard" | "priority" | "critical";

export type DroneClass =
  | "light_swift"
  | "light_secure"
  | "medium_standard"
  | "medium_stabilized"
  | "medium_long_range"
  | "heavy_cargo"
  | "heavy_max"
  | "light_express"
  | "standard_courier"
  | "fragile_care"
  | "long_range";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "system";
