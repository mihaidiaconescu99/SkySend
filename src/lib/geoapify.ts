import type { GeoPoint } from "@/types/service-area";
import type {
  GeoapifyAddressSuggestion,
  GeoapifyAutocompleteResponse,
  GeoapifyAutocompleteResult,
} from "@/types/geoapify";

const GEOAPIFY_MAPS_BASE_URL = "https://maps.geoapify.com/v1/styles";
const GEOAPIFY_GEOCODING_BASE_URL = "https://api.geoapify.com/v1/geocode";
const DEFAULT_GEOAPIFY_STYLE = "dark-matter";
const DEFAULT_GEOAPIFY_LIGHT_STYLE = "osm-bright";

export type GeoapifyAutocompleteOptions = {
  limit?: number;
  lang?: string;
  type?: "country" | "state" | "city" | "postcode" | "street" | "amenity";
  filter?: string;
  bias?: string;
};

function toSecondaryLabel(result: GeoapifyAutocompleteResult) {
  return [
    result.suburb,
    result.city,
    result.county,
    result.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function toGeoapifyAddressSuggestion(
  result: GeoapifyAutocompleteResult,
): GeoapifyAddressSuggestion {
  return {
    id: result.place_id,
    label: result.formatted,
    secondaryLabel: toSecondaryLabel(result),
    placeId: result.place_id,
    resultType: result.result_type,
    categories: result.categories ?? [],
    distanceMeters: result.distance,
    geocodedAddress: {
      formattedAddress: result.formatted,
      location: {
        latitude: result.lat,
        longitude: result.lon,
      },
      city: result.city ?? null,
      county: result.county ?? result.state ?? null,
      country: result.country ?? null,
      postalCode: result.postcode ?? null,
    },
  };
}

export function hasGeoapifyApiKey() {
  return Boolean(process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim());
}

export function getGeoapifyApiKey() {
  return process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim();
}

export function createGeoapifyStyleUrl(
  style = process.env.NEXT_PUBLIC_GEOAPIFY_MAP_STYLE?.trim() ||
    DEFAULT_GEOAPIFY_STYLE,
) {
  const apiKey = getGeoapifyApiKey();

  if (!apiKey) {
    return null;
  }

  return `${GEOAPIFY_MAPS_BASE_URL}/${style}/style.json?apiKey=${encodeURIComponent(apiKey)}`;
}

export function createGeoapifyStyleUrlForTheme(theme: "dark" | "light") {
  const configuredStyle =
    theme === "light"
      ? process.env.NEXT_PUBLIC_GEOAPIFY_MAP_STYLE_LIGHT?.trim()
      : process.env.NEXT_PUBLIC_GEOAPIFY_MAP_STYLE_DARK?.trim();
  return createGeoapifyStyleUrl(
    configuredStyle ||
      (theme === "light" ? DEFAULT_GEOAPIFY_LIGHT_STYLE : DEFAULT_GEOAPIFY_STYLE),
  );
}

function withGeoapifyQuery(
  pathname: string,
  searchParams: Record<string, string | number | undefined>,
) {
  const apiKey = getGeoapifyApiKey();

  if (!apiKey) {
    return null;
  }

  const url = new URL(`${GEOAPIFY_GEOCODING_BASE_URL}/${pathname}`);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  url.searchParams.set("apiKey", apiKey);

  return url.toString();
}

export function createGeoapifyAutocompleteUrl(
  text: string,
  options: GeoapifyAutocompleteOptions = {},
) {
  return withGeoapifyQuery("autocomplete", {
    text,
    format: "json",
    limit: options.limit ?? 5,
    lang: options.lang ?? "ro",
    type: options.type,
    filter: options.filter,
    bias: options.bias,
  });
}

export async function fetchGeoapifyAutocompleteSuggestions(
  text: string,
  options: GeoapifyAutocompleteOptions & { signal?: AbortSignal } = {},
) {
  const trimmedText = text.trim();

  if (!trimmedText || trimmedText.length < 3) {
    return [] satisfies GeoapifyAddressSuggestion[];
  }

  const url = createGeoapifyAutocompleteUrl(trimmedText, options);

  if (!url) {
    return [] satisfies GeoapifyAddressSuggestion[];
  }

  const response = await fetch(url, {
    method: "GET",
    signal: options.signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Geoapify autocomplete request failed with status ${response.status}`,
    );
  }

  const data = (await response.json()) as GeoapifyAutocompleteResponse;

  return (data.results ?? []).map(toGeoapifyAddressSuggestion);
}

export function createGeoapifyForwardGeocodingUrl(text: string) {
  return withGeoapifyQuery("search", {
    text,
    format: "json",
    lang: "ro",
  });
}

export function createGeoapifyReverseGeocodingUrl(point: GeoPoint) {
  return withGeoapifyQuery("reverse", {
    lat: point.latitude,
    lon: point.longitude,
    format: "json",
    lang: "ro",
  });
}

export async function fetchGeoapifyReverseGeocodedSuggestion(
  point: GeoPoint,
  options: { signal?: AbortSignal } = {},
) {
  const url = createGeoapifyReverseGeocodingUrl(point);

  if (!url) {
    return null;
  }

  const response = await fetch(url, {
    method: "GET",
    signal: options.signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Geoapify reverse geocoding request failed with status ${response.status}`,
    );
  }

  const data = (await response.json()) as GeoapifyAutocompleteResponse;
  const firstResult = data.results?.[0];

  if (!firstResult?.formatted) {
    return null;
  }

  return toGeoapifyAddressSuggestion(firstResult);
}

export const geoapifyConfig = {
  hasApiKey: hasGeoapifyApiKey(),
  styleUrl: createGeoapifyStyleUrl(),
  autocompleteBaseUrl: hasGeoapifyApiKey()
    ? `${GEOAPIFY_GEOCODING_BASE_URL}/autocomplete`
    : null,
  forwardGeocodingBaseUrl: hasGeoapifyApiKey()
    ? `${GEOAPIFY_GEOCODING_BASE_URL}/search`
    : null,
  reverseGeocodingBaseUrl: hasGeoapifyApiKey()
    ? `${GEOAPIFY_GEOCODING_BASE_URL}/reverse`
    : null,
} as const;
