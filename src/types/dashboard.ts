import type {
  DeliveryOrderId,
  MoneyAmount,
  UserProfileId,
} from "@/types/entities";

export type ClientDashboardStats = {
  profileId: UserProfileId;
  activeOrdersCount: number;
  completedThisMonthCount: number;
  failedOrdersCount: number;
  averageEtaMinutes: number;
  monthlySpend: MoneyAmount;
  co2SavedGramsMonthToDate: number;
  nextOrderId?: DeliveryOrderId | null;
};
