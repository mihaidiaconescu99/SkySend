import type { ReactNode } from "react";
import type { GeoPoint } from "@/types/service-area";

export type MapProvider = "geoapify" | "openstreetmap" | "custom";
export type MapSelectionMode = "preview" | "pickup" | "dropoff";

export type MapMarkerTone =
  | "primary"
  | "success"
  | "warning"
  | "destructive"
  | "warehouse"
  | "hub"
  | "pickup"
  | "dropoff"
  | "meeting"
  | "alternative";
export type MapMarkerKind =
  | "default"
  | "warehouse"
  | "pickup"
  | "dropoff"
  | "meeting"
  | "alternative"
  | "drone"
  | "service"
  | "unavailable";
export type MapMarkerVariant =
  | "default"
  | "hub"
  | "pickup"
  | "dropoff"
  | "candidate"
  | "recommended"
  | "drone"
  | "unavailable";

export type MapMarkerDefinition = {
  id: string;
  point: GeoPoint;
  label?: string;
  description?: string;
  kind?: MapMarkerKind;
  tone?: MapMarkerTone;
  emphasized?: boolean;
  selected?: boolean;
  active?: boolean;
  disabled?: boolean;
  variant?: MapMarkerVariant;
  headingDegrees?: number;
  confirmationOpen?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  confirmationActionLabel?: string;
  confirmationActionDisabled?: boolean;
  onClick?: () => void;
  onConfirm?: () => void;
};

export type MapOverlayDefinition = {
  id: string;
  data: GeoJSON.FeatureCollection<GeoJSON.Polygon, GeoJSON.GeoJsonProperties>;
  fillColor?: string;
  fillOpacity?: number;
  lineColor?: string;
  lineWidth?: number;
};

export type MapLineDefinition = {
  id: string;
  data: GeoJSON.FeatureCollection<GeoJSON.LineString, GeoJSON.GeoJsonProperties>;
  lineColor?: string;
  lineOpacity?: number;
  lineWidth?: number;
  lineDasharray?: number[];
};

export type MapContainerProps = {
  className?: string;
  ariaLabel?: string;
  center?: GeoPoint;
  zoom?: number;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  interactive?: boolean;
  showNavigation?: boolean;
  selectionMode?: MapSelectionMode;
  markers?: readonly MapMarkerDefinition[];
  overlays?: readonly MapOverlayDefinition[];
  lines?: readonly MapLineDefinition[];
  selectedPoint?: GeoPoint | null;
  onPointSelect?: (point: GeoPoint) => void;
  onViewportSettled?: (viewport: MapViewport) => void;
  overlayContent?: ReactNode;
};

export type MapAutocompleteSuggestion = {
  id: string;
  label: string;
  secondaryLabel?: string;
  point: GeoPoint;
};

export type MapViewport = {
  center: GeoPoint;
  zoom: number;
};
