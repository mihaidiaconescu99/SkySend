

export interface OperationalSettings {
  id: string;
  isActive: boolean;
  manualStatus?: "active" | "maintenance";

  serviceRadiusKm: number;

  basePriceMinor: number;

  pricePerKmMinor: number;
  confirmationTimerMinutes: number;
  loadingTimerMinutes: number;
  unloadingTimerMinutes: number;
  hubLatitude: number;
  hubLongitude: number;

  lastSavedAt: string;

  lastSavedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOperationalSettingsInput {
  isActive?: boolean;
  serviceRadiusKm?: number;
  basePriceMinor?: number;
  pricePerKmMinor?: number;
  confirmationTimerMinutes?: number;
  loadingTimerMinutes?: number;
  unloadingTimerMinutes?: number;
  hubLatitude?: number;
  hubLongitude?: number;

  lastSavedBy?: string | null;
}
