

import type { GeoPoint } from "@/types/service-area";

export interface Address {
  id: string;

  profileId: string | null;

  label: string | null;
  formattedAddress: string;
  city: string | null;
  county: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;

  isSaved: boolean;

  usageCount: number;

  lastUsedAt: string;

  createdAt: string;
}

export interface CreateAddressInput {

  profileId?: string | null;
  label?: string | null;
  formattedAddress: string;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude: number;
  longitude: number;

  isSaved?: boolean;
}

export interface UpdateAddressInput {
  label?: string | null;
  formattedAddress?: string;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number;
  longitude?: number;
  isSaved?: boolean;
  usageCount?: number;

  lastUsedAt?: string;
}

export function addressToGeoPoint(address: Address): GeoPoint {
  return { latitude: address.latitude, longitude: address.longitude };
}
