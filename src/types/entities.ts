import type {
  DeliveryUrgency,
  DroneClass,
  NotificationType,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";
import type { DroneConfig, ParcelDimensions } from "@/types/drone";
import type {
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";
import type { UserRole } from "@/types/roles";
import type { GeoPoint } from "@/types/service-area";

export type ISODateTimeString = string;
export type CurrencyCode = "RON" | "EUR";

export type UserProfileId = string;
export type DeliveryOrderId = string;
export type OrderPointId = string;
export type ParcelId = string;
export type PaymentMethodId = string;
export type PaymentRecordId = string;
export type EcoMetricId = string;
export type NotificationId = string;

export type EntityTimestamps = {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
};

export type MoneyAmount = {
  amountMinor: number;
  currency: CurrencyCode;
};

export type UserProfileStatus = "invited" | "active" | "suspended";
export type PaymentMethodType = "card" | "invoice";
export type PaymentProvider = "stripe";
export type NotificationChannel = "in_app" | "email" | "sms";
export type NotificationStatus = "queued" | "sent" | "delivered" | "read";
export type OrderPointType = "pickup" | "dropoff" | "waypoint";
export type OrderPointStatus = "pending" | "confirmed" | "completed" | "failed";
export type EcoMetricStatus = "estimated" | "measured";

export type ContactPoint = {
  name?: string | null;
  phoneE164?: string | null;
  email?: string | null;
};

export type AddressSnapshot = {
  formattedAddress: string;
  city: string;
  county: string;
  country: string;
  postalCode?: string | null;
  location: GeoPoint;
};

export type UserProfile = EntityTimestamps & {
  id: UserProfileId;
  clerkUserId: string;
  role: UserRole;
  status: UserProfileStatus;
  fullName: string;
  email: string;
  phoneE164?: string | null;
  companyName?: string | null;
  defaultAddress?: AddressSnapshot | null;
  defaultPaymentMethodId?: PaymentMethodId | null;
};

export type DroneClassModel = EntityTimestamps & {
  id: DroneClass;
  isActivee: boolean;
  config: DroneConfig;
};

export type Parcel = EntityTimestamps & {
  id: ParcelId;
  orderId: DeliveryOrderId;
  contentsSummary: string;
  packagingType: ParcelPackagingType;
  approximateSize: ParcelSizeOption;
  fragileLevel: ParcelFragileLevel;
  estimatedWeightKg: number;
  estimatedWeightRangeLabel: string;
  dimensionsCm: ParcelDimensions;
  declaredValue?: MoneyAmount | null;
  requiresFragileHandling: boolean;
};

export type OrderPoint = EntityTimestamps & {
  id: OrderPointId;
  orderId: DeliveryOrderId;
  type: OrderPointType;
  sequence: number;
  status: OrderPointStatus;
  address: AddressSnapshot;
  contact?: ContactPoint | null;
  notes?: string | null;
  arrivedAt?: ISODateTimeString | null;
  completedAt?: ISODateTimeString | null;
};

export type DeliveryOrder = EntityTimestamps & {
  id: DeliveryOrderId;
  customerProfileId: UserProfileId;
  operatorProfileId?: UserProfileId | null;
  status: OrderStatus;
  urgency: DeliveryUrgency;
  pickupPointId: OrderPointId;
  dropoffPointId: OrderPointId;
  parcelId: ParcelId;
  assignedDroneClassId?: DroneClass | null;
  assignedPaymentRecordId?: PaymentRecordId | null;
  serviceAreaEligible: boolean;
  scheduledFor?: ISODateTimeString | null;
  completedAt?: ISODateTimeString | null;
  cancellationReason?: string | null;
};

export type PaymentMethod = EntityTimestamps & {
  id: PaymentMethodId;
  userProfileId: UserProfileId;
  provider: PaymentProvider;
  type: PaymentMethodType;
  isDefault: boolean;
  label: string;
  brand?: string | null;
  last4?: string | null;
  expiresAt?: string | null;
  providerReference: string;
};

export type PaymentRecord = EntityTimestamps & {
  id: PaymentRecordId;
  orderId: DeliveryOrderId;
  userProfileId: UserProfileId;
  paymentMethodId?: PaymentMethodId | null;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: MoneyAmount;
  capturedAmount?: MoneyAmount | null;
  refundedAmount?: MoneyAmount | null;
  providerReference: string;
  paidAt?: ISODateTimeString | null;
  failedAt?: ISODateTimeString | null;
  failureReason?: string | null;
};

export type EcoMetric = EntityTimestamps & {
  id: EcoMetricId;
  orderId: DeliveryOrderId;
  status: EcoMetricStatus;
  estimatedCo2SavedGrams: number;
  estimatedRoadDistanceSavedKm: number;
  estimatedEnergyUseKwh: number;
  methodologyNote: string;
};

export type Notification = EntityTimestamps & {
  id: NotificationId;
  userProfileId: UserProfileId;
  orderId?: DeliveryOrderId | null;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  actionHref?: string | null;
  sentAt?: ISODateTimeString | null;
  readAt?: ISODateTimeString | null;
};
