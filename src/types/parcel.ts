

import type { ParcelDimensions } from "@/types/drone";
import type {
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";

export type { ParcelDimensions, ParcelFragileLevel, ParcelPackagingType, ParcelSizeOption };

export type ThermalProtection = "none" | "passive_insulated" | "active_thermal";

export type SecurityModule = "standard" | "secure" | "secure_plus";

export interface Parcel {
  id: string;
  contentsDescription: string;
  fragilityLevel: ParcelFragileLevel;
  packagingType: ParcelPackagingType | null;
  securityModule: SecurityModule;
  thermalProtection: ThermalProtection;
  approximateSize: ParcelSizeOption | null;
  declaredDimensionsCm: ParcelDimensions | null;
  declaredWeightKg: number | null;
  estimatedWeightRange: string | null;
  createdAt: string;
}

export interface CreateParcelInput {
  contentsDescription: string;
  fragilityLevel?: ParcelFragileLevel;
  packagingType?: ParcelPackagingType | null;
  securityModule?: SecurityModule;
  thermalProtection?: ThermalProtection;
  approximateSize?: ParcelSizeOption | null;
  declaredDimensionsCm?: ParcelDimensions | null;
  declaredWeightKg?: number | null;
  estimatedWeightRange?: string | null;
}

export interface UpdateParcelInput {
  contentsDescription?: string;
  fragilityLevel?: ParcelFragileLevel;
  packagingType?: ParcelPackagingType | null;
  securityModule?: SecurityModule;
  thermalProtection?: ThermalProtection;
  approximateSize?: ParcelSizeOption | null;
  declaredDimensionsCm?: ParcelDimensions | null;
  declaredWeightKg?: number | null;
  estimatedWeightRange?: string | null;
}
