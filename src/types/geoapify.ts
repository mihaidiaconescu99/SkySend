import type { GeocodedAddress } from "@/types/service-area";

export type GeoapifyAutocompleteResult = {
  place_id: string;
  formatted: string;
  name?: string;
  lat: number;
  lon: number;
  housenumber?: string;
  street?: string;
  suburb?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
  result_type?: string;
  address_line1?: string;
  address_line2?: string;
  categories?: string[];
  distance?: number;
};

export type GeoapifyAutocompleteResponse = {
  results: GeoapifyAutocompleteResult[];
};

export type GeoapifyAddressSuggestion = {
  id: string;
  label: string;
  secondaryLabel?: string;
  placeId?: string;
  resultType?: string;
  categories?: string[];
  distanceMeters?: number;
  geocodedAddress: GeocodedAddress;
};
