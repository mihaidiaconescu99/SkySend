import { renderToStaticMarkup } from "react-dom/server";
import type { SVGProps } from "react";
import type { MapMarkerDefinition, MapMarkerKind } from "@/types/map";

export type MapMarkerVisualState = "default" | "selected" | "active" | "disabled";

export const mapMarkerKindConfig = {
  default: {
    label: "Punct pe hartă",
    colorName: "cyan",
  },
  warehouse: {
    label: "Centru depozit",
    colorName: "indigo",
  },
  pickup: {
    label: "Ridicare",
    colorName: "cyan",
  },
  dropoff: {
    label: "Livrare",
    colorName: "emerald",
  },
  meeting: {
    label: "Punct de întâlnire cu drona",
    colorName: "amber",
  },
  alternative: {
    label: "Punct de întâlnire apropiat",
    colorName: "muted amber",
  },
  drone: {
    label: "Dronă live",
    colorName: "amber",
  },
  service: {
    label: "Punct de serviciu",
    colorName: "teal",
  },
  unavailable: {
    label: "Punct indisponibil",
    colorName: "red",
  },
} as const satisfies Record<MapMarkerKind, { label: string; colorName: string }>;

function MarkerSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export function WarehouseMarkerIcon() {
  return (
    <MarkerSvg>
      <path d="M4.5 10.4 12 6l7.5 4.4" />
      <path d="M6.5 10v8h11v-8" />
      <path d="M9 18v-5.2h6V18" />
      <path d="M9.2 10h5.6" />
    </MarkerSvg>
  );
}

export function PickupMarkerIcon() {
  return (
    <MarkerSvg>
      <path d="m5.4 8.3 6.6-3.8 6.6 3.8v7.4l-6.6 3.8-6.6-3.8Z" />
      <path d="m5.9 8.7 6.1 3.5 6.1-3.5" />
      <path d="M12 12.2v7" />
      <path d="M8.8 6.4 15.2 10" />
    </MarkerSvg>
  );
}

export function DropoffMarkerIcon() {
  return (
    <MarkerSvg>
      <path d="m5.4 9.2 5.9-3.4 5.9 3.4v6.5l-5.9 3.4-5.9-3.4Z" />
      <path d="m5.9 9.6 5.4 3.1 5.4-3.1" />
      <path d="M11.3 12.7v6" />
      <path d="m15.1 4.4 1.8 1.8 3.6-3.8" />
    </MarkerSvg>
  );
}

export function MeetingMarkerIcon() {
  return (
    <MarkerSvg>
      <path d="M9.2 12h5.6" />
      <path d="M12 9.2v5.6" />
      <path d="m9.2 12-3.4-3.4" />
      <path d="m14.8 12 3.4-3.4" />
      <path d="m9.2 12-3.4 3.4" />
      <path d="m14.8 12 3.4 3.4" />
      <circle cx="5.2" cy="8" r="2.2" />
      <circle cx="18.8" cy="8" r="2.2" />
      <circle cx="5.2" cy="16" r="2.2" />
      <circle cx="18.8" cy="16" r="2.2" />
      <path d="M9.7 9.7h4.6l1.5 2.3-1.5 2.3H9.7L8.2 12Z" />
      <path d="M10.9 12h2.2" />
    </MarkerSvg>
  );
}

export function ServiceMarkerIcon() {
  return (
    <MarkerSvg>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 5.2v3.1" />
      <path d="M12 15.7v3.1" />
      <path d="M5.2 12h3.1" />
      <path d="M15.7 12h3.1" />
    </MarkerSvg>
  );
}

export function UnavailableMarkerIcon() {
  return (
    <MarkerSvg>
      <path d="M7.2 7.2 16.8 16.8" />
      <path d="M16.8 7.2 7.2 16.8" />
      <circle cx="12" cy="12" r="7.2" />
    </MarkerSvg>
  );
}

export function SkySendMapMarkerIcon({ kind }: { kind: MapMarkerKind }) {
  if (kind === "warehouse") {
    return <WarehouseMarkerIcon />;
  }

  if (kind === "pickup") {
    return <PickupMarkerIcon />;
  }

  if (kind === "dropoff") {
    return <DropoffMarkerIcon />;
  }

  if (kind === "meeting" || kind === "alternative" || kind === "drone") {
    return <MeetingMarkerIcon />;
  }

  if (kind === "service" || kind === "default") {
    return <ServiceMarkerIcon />;
  }

  return <UnavailableMarkerIcon />;
}

export function resolveMapMarkerKind(marker: MapMarkerDefinition): MapMarkerKind {
  if (marker.kind) {
    return marker.kind;
  }

  if (marker.variant === "hub" || marker.tone === "hub") {
    return "warehouse";
  }

  if (marker.variant === "pickup" || marker.tone === "pickup") {
    return "pickup";
  }

  if (marker.variant === "dropoff" || marker.tone === "dropoff") {
    return "dropoff";
  }

  if (marker.variant === "candidate" || marker.tone === "alternative") {
    return "alternative";
  }

  if (marker.variant === "recommended") {
    return "meeting";
  }

  if (marker.variant === "drone") {
    return "drone";
  }

  if (marker.variant === "unavailable" || marker.tone === "destructive") {
    return "unavailable";
  }

  if (marker.tone === "success" || marker.tone === "warning") {
    return "service";
  }

  return "default";
}

export function resolveMapMarkerState(
  marker: MapMarkerDefinition,
): MapMarkerVisualState {
  if (marker.disabled || marker.variant === "unavailable") {
    return "disabled";
  }

  if (marker.active || marker.confirmationOpen) {
    return "active";
  }

  if (marker.selected || marker.emphasized) {
    return "selected";
  }

  return "default";
}

export function renderMapMarkerIcon(kind: MapMarkerKind) {
  return renderToStaticMarkup(<SkySendMapMarkerIcon kind={kind} />);
}
