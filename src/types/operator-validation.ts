import type { DroneClass, OrderStatus } from "@/types/domain";

export type OperatorValidationStatus =
  | "pending"
  | "verified"
  | "failed"
  | "requires_fallback";

export type OperatorValidationContext = {
  orderId: string;
  orderStatus: OrderStatus;
  pickupPoint: {
    label: string;
    contactName: string;
    contactDetail: string;
    notes: string | null;
  };
  dropoffPoint: {
    label: string;
    contactName: string;
    contactDetail: string;
    notes: string | null;
  };
  parcel: {
    summary: string;
    packagingType: string;
    size: string;
    fragileLevel: string;
    estimatedWeightRange: string;
  };
  assignedDroneClass: DroneClass | null;
  assignedDroneClassLabel: string;
};
