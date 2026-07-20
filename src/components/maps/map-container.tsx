"use client";

import { memo, useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import { AlertCircle, MapPin } from "lucide-react";
import {
  renderMapMarkerIcon,
  resolveMapMarkerKind,
  resolveMapMarkerState,
} from "@/components/maps/markers";
import {
  defaultMapStyle,
  getFallbackMapStyleForTheme,
  mapConfig,
} from "@/constants/map";
import { cn } from "@/lib/utils";
import type { MapContainerProps, MapMarkerDefinition, MapOverlayDefinition } from "@/types/map";
import type { GeoPoint } from "@/types/service-area";

const overlaySourcePrefix = "skysend-overlay-source-";
const overlayFillPrefix = "skysend-overlay-fill-";
const overlayLinePrefix = "skysend-overlay-line-";
const routeLineSourcePrefix = "skysend-line-source-";
const routeLineLayerPrefix = "skysend-line-layer-";
const mapInitializationTimeoutMs = 15000;
const fallbackStyleTimeoutMs = 8000;
const emptyMapMarkers: readonly MapMarkerDefinition[] = [];
const emptyMapOverlays: readonly MapOverlayDefinition[] = [];
const emptyMapLines: NonNullable<MapContainerProps["lines"]> = [];

type MapDiagnostics = {
  containerWidth: number;
  containerHeight: number;
  hasMapInstance: boolean;
  hasCanvas: boolean;
  canvasWidth: number;
  canvasHeight: number;
  styleLoaded: boolean;
  lastError: string | null;
};

type MapWithInternalStyle = MapLibreMap & {
  style?: {
    _loaded?: boolean;
  };
};

const initialDiagnostics: MapDiagnostics = {
  containerWidth: 0,
  containerHeight: 0,
  hasMapInstance: false,
  hasCanvas: false,
  canvasWidth: 0,
  canvasHeight: 0,
  styleLoaded: false,
  lastError: null,
};

function isMapStyleReadyForMutation(map: MapLibreMap) {
  return Boolean((map as MapWithInternalStyle).style?._loaded);
}

function isStyleNotDoneLoadingError(error: unknown) {
  return error instanceof Error && error.message.includes("Style is not done loading");
}

function createMarkerElement(marker: MapMarkerDefinition) {
  const element = document.createElement("div");
  const kind = resolveMapMarkerKind(marker);
  const state = resolveMapMarkerState(marker);
  const variant = marker.variant ?? "default";
  const glyph = document.createElement("span");

  element.className = cn(
    "map-marker",
    `map-marker--kind-${kind}`,
    `map-marker--state-${state}`,
    `map-marker--variant-${variant}`,
    variant === "candidate" ? "map-marker--candidate" : undefined,
    variant === "recommended" ? "map-marker--recommended" : undefined,
    variant === "drone" ? "map-marker--drone" : undefined,
    variant === "unavailable" ? "map-marker--unavailable" : undefined,
    marker.confirmationOpen ? "map-marker--confirmation-open" : undefined,
    marker.onClick || marker.onConfirm ? "map-marker--interactive" : undefined,
  );
  element.tabIndex = marker.onClick || marker.onConfirm ? 0 : -1;
  element.setAttribute("role", marker.onClick || marker.onConfirm ? "button" : "img");
  element.setAttribute("aria-label", marker.label ?? "Map marker");
  element.title = marker.label ?? marker.description ?? "Map marker";
  element.dataset.markerKind = kind;
  element.dataset.markerState = state;
  glyph.className = "map-marker__icon";
  glyph.setAttribute("aria-hidden", "true");
  glyph.innerHTML = renderMapMarkerIcon(kind);

  if (variant === "drone") {
    const heading = marker.headingDegrees ?? 0;

    element.style.setProperty("--marker-heading", `${heading}deg`);
  }

  element.appendChild(glyph);

  if (marker.label || marker.description) {
    const tooltip = document.createElement("span");
    const hasDistinctDescription =
      marker.description && marker.description !== marker.label;

    tooltip.className = "map-marker__tooltip";
    tooltip.textContent = hasDistinctDescription
      ? `${marker.label ?? "Punct"} - ${marker.description}`
      : marker.label ?? marker.description ?? "";
    element.appendChild(tooltip);
  }

  if (marker.confirmationOpen) {
    const popup = document.createElement("div");
    const title = document.createElement("p");
    const description = document.createElement("p");
    const action = document.createElement("button");

    popup.className = "map-marker__confirm";
    popup.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    title.className = "map-marker__confirm-title";
    title.textContent = marker.confirmationTitle ?? marker.label ?? "Confirmă punctul";
    description.className = "map-marker__confirm-description";
    description.textContent =
      marker.confirmationDescription !== undefined
        ? marker.confirmationDescription
        : marker.description && marker.description !== title.textContent
          ? marker.description
          : "";
    if (!description.textContent) {
      description.hidden = true;
    }
    action.type = "button";
    action.className = "map-marker__confirm-action";
    action.textContent = marker.confirmationActionLabel ?? "Confirmă";
    action.disabled = Boolean(marker.confirmationActionDisabled);
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      if (marker.confirmationActionDisabled) {
        return;
      }

      marker.onConfirm?.();
    });
    popup.append(title, description, action);
    element.appendChild(popup);
  }

  if (marker.onClick) {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      marker.onClick?.();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      marker.onClick?.();
    });
  }

  return element;
}

function createSelectedPointElement() {
  const element = document.createElement("span");

  element.className = "map-marker map-marker--selected";
  element.setAttribute("aria-hidden", "true");

  return element;
}

function syncMarkers(
  map: MapLibreMap,
  markers: readonly MapMarkerDefinition[],
  markerInstancesRef: MutableRefObject<MapLibreMarker[]>,
) {
  markerInstancesRef.current.forEach((marker) => marker.remove());
  markerInstancesRef.current = markers.map((marker) => {
    const shouldCenterOnCoordinate =
      marker.kind === "meeting" ||
      marker.kind === "alternative" ||
      marker.variant === "candidate" ||
      marker.variant === "recommended" ||
      marker.variant === "drone";
    const instance = new maplibregl.Marker({
      element: createMarkerElement(marker),
      anchor: shouldCenterOnCoordinate ? "center" : "bottom",
    })
      .setLngLat([marker.point.longitude, marker.point.latitude])
      .addTo(map);

    return instance;
  });
}

function syncSelectedPoint(
  map: MapLibreMap,
  point: GeoPoint | null | undefined,
  selectedPointMarkerRef: MutableRefObject<MapLibreMarker | null>,
) {
  selectedPointMarkerRef.current?.remove();
  selectedPointMarkerRef.current = null;

  if (!point) {
    return;
  }

  selectedPointMarkerRef.current = new maplibregl.Marker({
    element: createSelectedPointElement(),
    anchor: "center",
  })
    .setLngLat([point.longitude, point.latitude])
    .addTo(map);
}

function syncOverlays(
  map: MapLibreMap,
  overlays: readonly MapOverlayDefinition[],
  activeOverlayIdsRef: MutableRefObject<string[]>,
) {
  const activeSourceIds = new Set(
    overlays.map((overlay) => `${overlaySourcePrefix}${overlay.id}`),
  );

  for (const overlay of overlays) {
    const sourceId = `${overlaySourcePrefix}${overlay.id}`;
    const fillId = `${overlayFillPrefix}${overlay.id}`;
    const lineId = `${overlayLinePrefix}${overlay.id}`;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;

    if (source) {
      source.setData(overlay.data);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: overlay.data,
      });
    }

    if (!map.getLayer(fillId)) {
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": overlay.fillColor ?? "#8ba7ca",
          "fill-opacity": overlay.fillOpacity ?? 0.16,
        },
      });
    }

    if (!map.getLayer(lineId)) {
      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": overlay.lineColor ?? "#1c2940",
          "line-width": overlay.lineWidth ?? 2,
        },
      });
    }
  }

  for (const sourceId of activeOverlayIdsRef.current) {
    if (!sourceId.startsWith(overlaySourcePrefix) || activeSourceIds.has(sourceId)) {
      continue;
    }

    const overlayId = sourceId.replace(overlaySourcePrefix, "");
    const fillId = `${overlayFillPrefix}${overlayId}`;
    const lineId = `${overlayLinePrefix}${overlayId}`;

    if (map.getLayer(lineId)) {
      map.removeLayer(lineId);
    }

    if (map.getLayer(fillId)) {
      map.removeLayer(fillId);
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }

  activeOverlayIdsRef.current = [...activeSourceIds];
}

function syncLines(
  map: MapLibreMap,
  lines: NonNullable<MapContainerProps["lines"]>,
  activeLineIdsRef: MutableRefObject<string[]>,
) {
  const activeSourceIds = new Set(
    lines.map((line) => `${routeLineSourcePrefix}${line.id}`),
  );

  for (const line of lines) {
    const sourceId = `${routeLineSourcePrefix}${line.id}`;
    const layerId = `${routeLineLayerPrefix}${line.id}`;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;

    if (source) {
      source.setData(line.data);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: line.data,
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": line.lineColor ?? "#1c2940",
          "line-opacity": line.lineOpacity ?? 0.72,
          "line-width": line.lineWidth ?? 3,
          ...(line.lineDasharray
            ? { "line-dasharray": line.lineDasharray }
            : {}),
        },
      });
    }
  }

  for (const sourceId of activeLineIdsRef.current) {
    if (!sourceId.startsWith(routeLineSourcePrefix) || activeSourceIds.has(sourceId)) {
      continue;
    }

    const lineId = sourceId.replace(routeLineSourcePrefix, "");
    const layerId = `${routeLineLayerPrefix}${lineId}`;

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }

  activeLineIdsRef.current = [...activeSourceIds];
}

let maplibregl: typeof import("maplibre-gl");

export const MapContainer = memo(function MapContainer({
  className,
  ariaLabel = "SkySend map",
  center = mapConfig.defaultCenter,
  zoom = mapConfig.defaultZoom,
  padding,
  interactive = true,
  showNavigation = true,
  selectionMode = "preview",
  markers = emptyMapMarkers,
  overlays = emptyMapOverlays,
  lines = emptyMapLines,
  selectedPoint,
  onPointSelect,
  onViewportSettled,
  overlayContent,
}: MapContainerProps) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerInstancesRef = useRef<MapLibreMarker[]>([]);
  const selectedPointMarkerRef = useRef<MapLibreMarker | null>(null);
  const activeOverlayIdsRef = useRef<string[]>([]);
  const activeLineIdsRef = useRef<string[]>([]);
  const clickHandlerRef = useRef(onPointSelect);
  const viewportSettledHandlerRef = useRef(onViewportSettled);
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const hasAppliedFallbackStyleRef = useRef(false);
  const hasLoadedStyleRef = useRef(false);
  const descriptionId = useId();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [styleRevision, setStyleRevision] = useState(0);
  const [diagnostics, setDiagnostics] = useState<MapDiagnostics>(initialDiagnostics);
  const shouldShowDiagnostics =
    process.env.NEXT_PUBLIC_SHOW_MAP_DIAGNOSTICS === "true";
  const mapPadding = useMemo(
    () => ({
      top: padding?.top ?? 0,
      right: padding?.right ?? 0,
      bottom: padding?.bottom ?? 0,
      left: padding?.left ?? 0,
    }),
    [padding?.bottom, padding?.left, padding?.right, padding?.top],
  );

  useEffect(() => {
    clickHandlerRef.current = onPointSelect;
  }, [onPointSelect]);

  useEffect(() => {
    viewportSettledHandlerRef.current = onViewportSettled;
  }, [onViewportSettled]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let initializationTimeout: number | null = null;
    let fallbackStyleTimeout: number | null = null;

    function readContainerSize() {
      if (!mapNodeRef.current) {
        return { width: 0, height: 0 };
      }

      const rect = mapNodeRef.current.getBoundingClientRect();

      return {
        width: rect.width,
        height: rect.height,
      };
    }

    function readDiagnostics(lastError: string | null = null): MapDiagnostics {
      const size = readContainerSize();
      const canvas = mapNodeRef.current?.querySelector("canvas") ?? null;

      return {
        containerWidth: Math.round(size.width),
        containerHeight: Math.round(size.height),
        hasMapInstance: Boolean(mapRef.current),
        hasCanvas: Boolean(canvas),
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        styleLoaded: Boolean(mapRef.current?.isStyleLoaded()),
        lastError,
      };
    }

    function syncDiagnostics(lastError: string | null = null) {
      if (!disposed && shouldShowDiagnostics) {
        setDiagnostics(readDiagnostics(lastError));
      }
    }

    function markMapReady() {
      if (disposed || !mapRef.current) {
        return;
      }

      hasLoadedStyleRef.current = true;
      mapRef.current.resize();
      setIsReady(true);
      setIsInitializing(false);
      setError(null);
      setStyleRevision((currentRevision) => currentRevision + 1);
      syncDiagnostics(null);
    }

    function applyFallbackStyle(reason: string) {
      if (
        disposed ||
        !mapRef.current ||
        hasAppliedFallbackStyleRef.current ||
        typeof defaultMapStyle !== "string"
      ) {
        return false;
      }

      hasAppliedFallbackStyleRef.current = true;
      setError(null);
      setIsReady(false);
      setIsInitializing(true);
      setStyleRevision((currentRevision) => currentRevision + 1);
      hasLoadedStyleRef.current = false;
      activeOverlayIdsRef.current = [];
      activeLineIdsRef.current = [];
      syncDiagnostics(reason);
      const fallbackTheme = document.documentElement.classList.contains("light")
        ? "light"
        : "dark";
      mapRef.current.setStyle(getFallbackMapStyleForTheme(fallbackTheme));

      if (fallbackStyleTimeout) {
        window.clearTimeout(fallbackStyleTimeout);
      }

      fallbackStyleTimeout = window.setTimeout(() => {
        if (disposed || hasLoadedStyleRef.current) {
          return;
        }

        setIsInitializing(false);
        setError("Harta nu a putut încărca nici stilul de rezervă.");
        syncDiagnostics("Stilul de rezervă nu s-a încărcat complet.");
      }, fallbackStyleTimeoutMs);

      return true;
    }

    async function initializeMap() {
      if (!mapNodeRef.current || mapRef.current) {
        return;
      }

      const initialSize = readContainerSize();

      if (initialSize.width === 0 || initialSize.height === 0) {
        syncDiagnostics();
        return;
      }

      try {
        const maplibreModule = await import("maplibre-gl");
        const maplibre =
          "default" in maplibreModule && maplibreModule.default
            ? maplibreModule.default
            : maplibreModule;

        if (disposed || !mapNodeRef.current) {
          return;
        }

        maplibregl = maplibre as typeof import("maplibre-gl");

        const initialTheme = document.documentElement.classList.contains("light")
          ? "light"
          : "dark";
        const initialStyle =
          typeof defaultMapStyle === "string"
            ? defaultMapStyle
            : getFallbackMapStyleForTheme(initialTheme);

        const map = new maplibregl.Map({
          container: mapNodeRef.current,
          style: initialStyle,
          center: [
            initialCenterRef.current.longitude,
            initialCenterRef.current.latitude,
          ],
          zoom: initialZoomRef.current,
          minZoom: mapConfig.minZoom,
          maxZoom: mapConfig.maxZoom,
          maxPitch: mapConfig.maxPitch,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: false,
        });

        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        setError(null);
        syncDiagnostics();

        const resizeMap = () => {
          if (disposed || !mapRef.current) {
            return;
          }

          mapRef.current.resize();
          syncDiagnostics();
        };

        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(() => {
          window.requestAnimationFrame(resizeMap);
        });

        resizeObserver.observe(mapNodeRef.current);

        if (!interactive) {
          map.scrollZoom.disable();
          map.boxZoom.disable();
          map.dragPan.disable();
          map.keyboard.disable();
          map.doubleClickZoom.disable();
          map.touchZoomRotate.disable();
        }

        if (showNavigation) {
          map.addControl(
            new maplibregl.NavigationControl({
              showCompass: false,
              visualizePitch: false,
            }),
            "top-right",
          );
        }

        map.on("click", (event: MapMouseEvent) => {
          clickHandlerRef.current?.({
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          });
        });

        map.on("moveend", (event) => {
          if (!event.originalEvent) {
            return;
          }

          const settledCenter = map.getCenter();
          viewportSettledHandlerRef.current?.({
            center: {
              latitude: settledCenter.lat,
              longitude: settledCenter.lng,
            },
            zoom: map.getZoom(),
          });
        });

        map.on("error", (event) => {
          if (!disposed) {
            const message = event.error?.message || "Eroare hartă necunoscută";

            if (!hasLoadedStyleRef.current && applyFallbackStyle(message)) {
              return;
            }

            syncDiagnostics(message);
          }
        });

        map.on("load", markMapReady);

        map.on("style.load", markMapReady);

        map.on("styledata", () => {
          syncDiagnostics();
        });

        map.on("idle", () => {
          syncDiagnostics();
        });

        window.requestAnimationFrame(resizeMap);

        map.once("remove", () => {
          resizeObserver?.disconnect();
        });
      } catch (err) {
        if (!disposed) {
          const errorMessage =
            err instanceof Error ? err.message : "Nu s-a putut inițializa harta.";
          setError(`Eroare de inițializare: ${errorMessage}`);
          setIsInitializing(false);
          syncDiagnostics(errorMessage);
          console.error("MapLibre initialization error:", err);
        }
      }
    }

    resizeObserver = new ResizeObserver(() => {
      const size = readContainerSize();

      syncDiagnostics();

      if (size.width > 0 && size.height > 0 && !mapRef.current) {
        void initializeMap();
      }
    });

    if (mapNodeRef.current) {
      resizeObserver.observe(mapNodeRef.current);
    }

    initializationTimeout = window.setTimeout(() => {
      if (!mapRef.current) {
        setIsInitializing(false);
        setError("Containerul hărții nu a devenit vizibil înainte de expirarea inițializării.");
        syncDiagnostics("Container stayed at 0 x 0 before MapLibre could mount.");
        return;
      }

      if (!hasLoadedStyleRef.current) {
        if (applyFallbackStyle("Încărcarea stilului principal a expirat.")) {
          return;
        }

        setIsInitializing(false);
        setError("MapLibre a pornit, dar stilul hărții nu s-a încărcat.");
        syncDiagnostics("Style load timed out after MapLibre created the map instance.");
      }
    }, mapInitializationTimeoutMs);

    void initializeMap();

    return () => {
      disposed = true;
      if (initializationTimeout) {
        window.clearTimeout(initializationTimeout);
      }
      if (fallbackStyleTimeout) {
        window.clearTimeout(fallbackStyleTimeout);
      }
      resizeObserver?.disconnect();
      setIsReady(false);
      setIsInitializing(true);
      setStyleRevision(0);
      markerInstancesRef.current.forEach((marker) => marker.remove());
      markerInstancesRef.current = [];
      selectedPointMarkerRef.current?.remove();
      selectedPointMarkerRef.current = null;
      activeOverlayIdsRef.current = [];
      activeLineIdsRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      hasAppliedFallbackStyleRef.current = false;
      hasLoadedStyleRef.current = false;
      setDiagnostics(initialDiagnostics);
    };
  }, [interactive, shouldShowDiagnostics, showNavigation]);

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }

    mapRef.current.setPadding(mapPadding);
  }, [isReady, mapPadding]);

  useEffect(() => {
    if (!mapRef.current || !isReady) {
      return;
    }

    mapRef.current.easeTo({
      center: [center.longitude, center.latitude],
      zoom,
      padding: mapPadding,
      duration: 720,
      essential: true,
    });
  }, [center.latitude, center.longitude, isReady, mapPadding, zoom]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    syncMarkers(mapRef.current, markers, markerInstancesRef);

    return () => {
      markerInstancesRef.current.forEach((marker) => marker.remove());
      markerInstancesRef.current = [];
    };
  }, [isReady, markers]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    syncSelectedPoint(mapRef.current, selectedPoint, selectedPointMarkerRef);

    return () => {
      selectedPointMarkerRef.current?.remove();
      selectedPointMarkerRef.current = null;
    };
  }, [isReady, selectedPoint]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    if (!hasLoadedStyleRef.current || !isMapStyleReadyForMutation(mapRef.current)) {
      const map = mapRef.current;

      map.once("styledata", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
      map.once("idle", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
      return;
    }

    try {
      syncOverlays(mapRef.current, overlays, activeOverlayIdsRef);
    } catch (error) {
      if (!isStyleNotDoneLoadingError(error)) {
        throw error;
      }

      const map = mapRef.current;

      map.once("styledata", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
      map.once("idle", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
    }
  }, [isReady, overlays, styleRevision]);

  useEffect(() => {
    if (!isReady || !mapRef.current) {
      return;
    }

    if (!hasLoadedStyleRef.current || !isMapStyleReadyForMutation(mapRef.current)) {
      const map = mapRef.current;

      map.once("styledata", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
      map.once("idle", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
      return;
    }

    try {
      syncLines(mapRef.current, lines, activeLineIdsRef);
    } catch (error) {
      if (!isStyleNotDoneLoadingError(error)) {
        throw error;
      }

      const map = mapRef.current;

      map.once("styledata", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
      map.once("idle", () => {
        setStyleRevision((currentRevision) => currentRevision + 1);
      });
    }
  }, [isReady, lines, styleRevision]);

  return (
    <div
      className={cn(
        "map-surface relative min-h-[24rem] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--elevation-soft)]",
        className,
      )}
      data-map-ready={isReady}
      data-selectable={Boolean(onPointSelect) && interactive}
    >
      <div
        ref={mapNodeRef}
        aria-label={ariaLabel}
        aria-describedby={descriptionId}
        className="absolute inset-0 z-0 h-full w-full bg-[linear-gradient(90deg,color-mix(in_srgb,var(--border)_44%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_srgb,var(--border)_44%,transparent)_1px,transparent_1px)] bg-[size:2rem_2rem]"
        data-skysend-map-node="true"
        role="region"
      />

      {!isReady && !error ? (
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-end justify-start bg-secondary/35 p-4">
          <div className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-[var(--elevation-soft)] backdrop-blur">
            {isInitializing ? "Harta se încarcă..." : "Harta așteaptă layout-ul..."}
          </div>
        </div>
      ) : null}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-destructive/5 to-destructive/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm text-foreground">Harta nu s-a putut încărca</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>Centrată pe Pitești, România</span>
          </div>
        </div>
      )}

      {shouldShowDiagnostics ? (
        <div className="pointer-events-none absolute bottom-3 right-3 z-30 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card/92 px-3 py-2 font-mono text-[0.68rem] leading-5 text-muted-foreground shadow-[var(--elevation-soft)] backdrop-blur">
          <div>container: {diagnostics.containerWidth}x{diagnostics.containerHeight}</div>
          <div>map: {diagnostics.hasMapInstance ? "yes" : "no"}</div>
          <div>
            canvas: {diagnostics.hasCanvas ? "yes" : "no"}{" "}
            {diagnostics.hasCanvas ? `${diagnostics.canvasWidth}x${diagnostics.canvasHeight}` : ""}
          </div>
          <div>style: {diagnostics.styleLoaded ? "loaded" : "pending"}</div>
          {diagnostics.lastError ? <div>ultima eroare: {diagnostics.lastError}</div> : null}
        </div>
      ) : null}

      <p id={descriptionId} className="sr-only">
        {onPointSelect && interactive
          ? `Hartă interactivă. Folosește controalele hărții sau apasă pentru a selecta punctul ${selectionMode}.`
          : "Hartă cu acoperire și markere de serviciu."}
      </p>

      {overlayContent ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-start sm:inset-x-auto sm:left-4">
          <div className="pointer-events-auto">{overlayContent}</div>
        </div>
      ) : null}
    </div>
  );
});

MapContainer.displayName = "MapContainer";
