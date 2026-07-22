import type { StyleSpecification } from "maplibre-gl";
import { serviceAreaConfig } from "@/constants/service-area";
import { createGeoapifyStyleUrlForTheme, geoapifyConfig } from "@/lib/geoapify";
import type { MapProvider } from "@/types/map";

const defaultDarkTileUrl =
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png";
const defaultLightTileUrl =
  "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png";
const defaultGeocodingUrl = "https://nominatim.openstreetmap.org/search";
const defaultAutocompleteUrl = "https://nominatim.openstreetmap.org/search";

function pickFallbackTileUrl(theme: "dark" | "light"): string {
  if (process.env.NEXT_PUBLIC_MAP_TILE_URL) {
    return process.env.NEXT_PUBLIC_MAP_TILE_URL;
  }
  return theme === "light" ? defaultLightTileUrl : defaultDarkTileUrl;
}

const preferredMapProvider: MapProvider = geoapifyConfig.hasApiKey
  ? "geoapify"
  : process.env.NEXT_PUBLIC_MAP_PROVIDER === "openstreetmap"
    ? "openstreetmap"
    : "custom";

export const mapConfig = {
  provider: preferredMapProvider,
  geoapifyApiKey: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
  publicToken: process.env.NEXT_PUBLIC_MAP_PUBLIC_TOKEN,
  styleUrl: geoapifyConfig.styleUrl,
  geocodingUrl:
    process.env.NEXT_PUBLIC_MAP_GEOCODING_URL ??
    geoapifyConfig.forwardGeocodingBaseUrl ??
    defaultGeocodingUrl,
  autocompleteUrl:
    geoapifyConfig.autocompleteBaseUrl ?? defaultAutocompleteUrl,
  reverseGeocodingUrl: geoapifyConfig.reverseGeocodingBaseUrl,
  defaultCenter: serviceAreaConfig.center,
  defaultZoom: 12.8,
  minZoom: 10,
  maxZoom: 18,
  maxPitch: 0,
  supportsPointSelection: true,
  supportsAutocomplete: geoapifyConfig.hasApiKey,
  attribution:
    preferredMapProvider === "geoapify"
      ? "(c) Geoapify, DeschideMapTiles, DeschideStreetMap contributors"
      : "(c) DeschideStreetMap contributors, (c) CARTO",
} as const;

export function buildFallbackMapStyle(theme: "dark" | "light"): StyleSpecification {
  const tileUrl = pickFallbackTileUrl(theme);
  if (theme === "light") {
    return {
      version: 8,
      sources: {
        "skysend-raster-tiles": {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 256,
          attribution: mapConfig.attribution,
        },
      },
      layers: [
        {
          id: "skysend-background",
          type: "background",
          paint: {
            "background-color": "#eef2f6",
          },
        },
        {
          id: "skysend-raster-layer",
          type: "raster",
          source: "skysend-raster-tiles",
          paint: {
            "raster-opacity": 1,
            "raster-brightness-min": 0.78,
            "raster-brightness-max": 1.04,
            "raster-saturation": 0.18,
            "raster-contrast": 0.06,
          },
        },
      ],
    };
  }

  return {
    version: 8,
    sources: {
      "skysend-raster-tiles": {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution: mapConfig.attribution,
      },
    },
    layers: [
      {
        id: "skysend-background",
        type: "background",
        paint: {
          "background-color": "#151719",
        },
      },
      {
        id: "skysend-raster-layer",
        type: "raster",
        source: "skysend-raster-tiles",
        paint: {
          "raster-opacity": 1,
          "raster-brightness-min": 0.18,
          "raster-brightness-max": 1.06,
          "raster-saturation": -0.18,
          "raster-contrast": 0.18,
        },
      },
    ],
  };
}

export const fallbackMapStyle: StyleSpecification = buildFallbackMapStyle("dark");

export const defaultMapStyle: StyleSpecification | string =
  mapConfig.styleUrl ?? fallbackMapStyle;

export function getFallbackMapStyleForTheme(
  theme: "dark" | "light",
): StyleSpecification {
  return buildFallbackMapStyle(theme);
}

export function getPrimaryMapStyleForTheme(
  theme: "dark" | "light",
): StyleSpecification | string {
  return createGeoapifyStyleUrlForTheme(theme) ?? buildFallbackMapStyle(theme);
}
