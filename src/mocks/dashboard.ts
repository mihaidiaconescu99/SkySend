import type { ClientDashboardStats } from "@/types/dashboard";

export const mockClientDashboardStats: ClientDashboardStats = {
  profileId: "profile_client_andrei_popescu",
  activeOrdersCount: 4,
  completedThisMonthCount: 3,
  failedOrdersCount: 2,
  averageEtaMinutes: 16,
  monthlySpend: {
    amountMinor: 248700,
    currency: "RON",
  },
  co2SavedGramsMonthToDate: 31240,
  nextOrderId: "order_2026_0423_0010",
};
