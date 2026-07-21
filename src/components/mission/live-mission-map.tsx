"use client";

import { type ReactNode, useMemo } from "react";
import { LazyMapContainer } from "@/components/maps/lazy-map-container";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeHub } from "@/constants/hub";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { getMarkerDrivenViewport, getServiceAreaMapOverlay } from "@/lib/map";
import { interpolateGeoPoint } from "@/lib/mission-route";
import { cn } from "@/lib/utils";
import type { MapLineDefinition, MapMarkerDefinition } from "@/types/map";
import type { GeoPoint } from "@/types/service-area";
import type { MissionStatus } from "@/types/mission";

type LiveMissionMapProps = {
  fallbackPickup: {
    label: string;
    point: GeoPoint;
  };
  fallbackDropoff: {
    label: string;
    point: GeoPoint;
  };
  className?: string;
  mapClassName?: string;
  presentation?: "card" | "frameless";
  overlayContent?: ReactNode;
  showMapOverlay?: boolean;
  showStatusFooter?: boolean;
};

type HubLockerRecoveryMapProps = {
  className?: string;
};

const serviceAreaOverlays = [getServiceAreaMapOverlay()] as const;
const pickupReachedStatuses: MissionStatus[] = [
  "arrived_at_pickup",
  "awaiting_sender_position_confirmation",
  "pickup_safety_check",
  "locker_descending_pickup",
  "awaiting_pickup_pin",
  "awaiting_parcel_load",
  "locker_ascending_pickup",
  "payload_verification",
  "parcel_secured",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];
const dropoffReachedStatuses: MissionStatus[] = [
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];
const dropoffPhaseStatuses = new Set<MissionStatus>([
  "en_route_to_dropoff",
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
]);

function formatSegmentLabel(value: string) {
  switch (value) {
    case "warehouse_to_pickup":
      return "Spre ridicare";
    case "pickup_to_dropoff":
      return "În zbor spre destinatar";
    case "dropoff_to_warehouse":
      return "Întoarcere la hub";
    default:
      return "Pe traseu";
  }
}

function createLineData(
  points: GeoPoint[],
): MapLineDefinition["data"] {
  if (points.length < 2) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: points.map((point) => [
            point.longitude,
            point.latitude,
          ]),
        },
      },
    ],
  };
}

function buildRouteLinePoints({
  hubPoint,
  pickupPoint,
  dropoffPoint,
  currentStatus,
  activeSegmentType,
  activeSegmentFrom,
  activeSegmentTo,
  segmentProgress,
}: {
  hubPoint: GeoPoint;
  pickupPoint: GeoPoint;
  dropoffPoint: GeoPoint;
  currentStatus: MissionStatus | null;
  activeSegmentType?: string | null;
  activeSegmentFrom?: GeoPoint | null;
  activeSegmentTo?: GeoPoint | null;
  segmentProgress: number;
}) {
  if (activeSegmentType === "warehouse_to_pickup") {
    const routeStart = activeSegmentFrom ?? hubPoint;
    const routeEnd = activeSegmentTo ?? pickupPoint;
    const progressPoint = interpolateGeoPoint(
      routeStart,
      routeEnd,
      segmentProgress,
    );

    return {
      completed: [routeStart, progressPoint],
      remaining: [progressPoint, routeEnd],
    };
  }

  if (activeSegmentType === "pickup_to_dropoff") {
    const routeStart = activeSegmentFrom ?? pickupPoint;
    const routeEnd = activeSegmentTo ?? dropoffPoint;
    const progressPoint = interpolateGeoPoint(
      routeStart,
      routeEnd,
      segmentProgress,
    );

    return {
      completed: [routeStart, progressPoint],
      remaining: [progressPoint, routeEnd],
    };
  }

  if (activeSegmentType === "dropoff_to_warehouse") {
    const routeStart = activeSegmentFrom ?? dropoffPoint;
    const routeEnd = activeSegmentTo ?? hubPoint;
    const fromPoint =
      currentStatus === "returning_to_hub"
        ? interpolateGeoPoint(routeStart, routeEnd, segmentProgress)
        : routeStart;

    return {
      completed: [routeStart, fromPoint],
      remaining: [fromPoint, routeEnd],
    };
  }

  if (currentStatus && dropoffReachedStatuses.includes(currentStatus)) {
    return {
      completed: [hubPoint, pickupPoint, dropoffPoint],
      remaining: [],
    };
  }

  if (currentStatus && pickupReachedStatuses.includes(currentStatus)) {
    return {
      completed: [hubPoint, pickupPoint],
      remaining: dropoffPhaseStatuses.has(currentStatus)
        ? [pickupPoint, dropoffPoint]
        : [],
    };
  }

  return {
    completed: [],
    remaining: [hubPoint, pickupPoint],
  };
}

export function LiveMissionMap({
  fallbackPickup,
  fallbackDropoff,
  className,
  mapClassName,
  presentation = "card",
  overlayContent,
  showMapOverlay = true,
  showStatusFooter = true,
}: LiveMissionMapProps) {
  const {
    currentMission,
    dronePosition,
    droneTelemetry,
    activeSegment,
    segmentProgress,
    currentStatus,
  } = useMissionRuntime();
  const hubPoint = currentMission?.hub.address.location ?? activeHub.address.location;
  const pickupPoint = currentMission?.pickup.location ?? fallbackPickup.point;
  const dropoffPoint = currentMission?.dropoff.location ?? fallbackDropoff.point;
  const liveDronePoint = dronePosition ?? hubPoint;
  const progressPercent = Math.round(segmentProgress * 100);
  const markers: readonly MapMarkerDefinition[] = (() => {
    const meetingPointMarkers: MapMarkerDefinition[] = [];
    const showDropoffCandidates = Boolean(
      currentStatus && dropoffPhaseStatuses.has(currentStatus),
    );

    if (!showDropoffCandidates) currentMission?.meetingPointAttempts.pickupMeetingPoints.forEach((point) => {
      meetingPointMarkers.push({
        id: `pickup-meeting-${point.id}`,
        point: point.coordinates,
        label: point.label,
        description:
          point.status === "rejected"
            ? "Punct de ridicare respins"
            : `${point.distanceFromSelectedAddressMeters} m față de adresa selectată`,
        kind: point.status === "rejected" ? "unavailable" : "meeting",
        tone: point.status === "rejected" ? "destructive" : "meeting",
        variant: point.status === "rejected" ? "unavailable" : "candidate",
        emphasized: point.status === "current" || point.status === "accepted",
        selected: point.status === "current" || point.status === "accepted",
        disabled: point.status === "rejected",
      });
    });

    if (showDropoffCandidates) currentMission?.meetingPointAttempts.dropoffMeetingPoints.forEach((point) => {
      meetingPointMarkers.push({
        id: `dropoff-meeting-${point.id}`,
        point: point.coordinates,
        label: point.label,
        description:
          point.status === "rejected"
            ? "Punct de livrare respins"
            : `${point.distanceFromSelectedAddressMeters} m față de adresa selectată`,
        kind: point.status === "rejected" ? "unavailable" : "meeting",
        tone: point.status === "rejected" ? "destructive" : "alternative",
        variant: point.status === "rejected" ? "unavailable" : "candidate",
        emphasized: point.status === "current" || point.status === "accepted",
        selected: point.status === "current" || point.status === "accepted",
        disabled: point.status === "rejected",
      });
    });

    const fallbackPhaseMarker: MapMarkerDefinition[] =
      meetingPointMarkers.length > 0
        ? []
        : [
            {
              id: showDropoffCandidates ? "mission-dropoff" : "mission-pickup",
              point: showDropoffCandidates ? dropoffPoint : pickupPoint,
              label: showDropoffCandidates
                ? currentMission?.dropoff.label ?? fallbackDropoff.label
                : currentMission?.pickup.label ?? fallbackPickup.label,
              description: showDropoffCandidates ? "Punct de livrare" : "Punct de ridicare",
              kind: showDropoffCandidates ? "dropoff" : "pickup",
              tone: showDropoffCandidates ? "dropoff" : "pickup",
              variant: showDropoffCandidates ? "dropoff" : "pickup",
              emphasized: true,
            },
          ];

    return [
      {
        id: "mission-hub",
        point: hubPoint,
        label: currentMission?.hub.name ?? activeHub.name,
        description: "Hub operațional SkySend activ",
        kind: "warehouse",
        tone: "warehouse",
        variant: "hub",
        emphasized: true,
      },
      {
        id: "mission-drone",
        point: liveDronePoint,
        label: "Poziție live dronă",
        description: "Poziție curentă din telemetrie",
        kind: "drone",
        tone: "meeting",
        variant: "drone",
        headingDegrees: droneTelemetry?.headingDegrees ?? 0,
        emphasized: true,
      },
      ...fallbackPhaseMarker,
      ...meetingPointMarkers,
    ];
  })();
  const viewport = useMemo(() => {
    const markerViewport = getMarkerDrivenViewport(markers);
    return {
      ...markerViewport,
      zoom: Math.max(11, markerViewport.zoom - 0.55),
    };
  }, [markers]);
  const lines = useMemo<readonly MapLineDefinition[]>(() => {
    const routeLinePoints = buildRouteLinePoints({
      hubPoint,
      pickupPoint,
      dropoffPoint,
      currentStatus,
      activeSegmentType: activeSegment?.type,
      activeSegmentFrom: activeSegment?.from.location,
      activeSegmentTo: activeSegment?.to.location,
      segmentProgress,
    });

    return [
      {
        id: "mission-route-remaining",
        data: createLineData(routeLinePoints.remaining),
        lineColor: "#8E8E93",
        lineOpacity: 0.34,
        lineWidth: 3,
        lineDasharray: [1.4, 1.2],
      },
      {
        id: "mission-route-completed",
        data: createLineData(routeLinePoints.completed),
        lineColor: "#0A84FF",
        lineOpacity: 0.82,
        lineWidth: 4,
      },
    ];
  }, [
    activeSegment?.from,
    activeSegment?.to,
    activeSegment?.type,
    currentStatus,
    dropoffPoint,
    hubPoint,
    pickupPoint,
    segmentProgress,
  ]);

  const defaultOverlayContent = (
    <div className="map-overlay-card max-w-[calc(100vw-2rem)] sm:max-w-sm">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-accent motion-safe:animate-pulse" />
        <p className="type-caption">Hartă livrare live</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge label="Pitești activ" tone="success" />
        <StatusBadge
          label={
            activeSegment
              ? formatSegmentLabel(activeSegment.type)
              : "Punct de întâlnire"
          }
          tone="info"
        />
        <StatusBadge label={`${progressPercent}%`} tone="neutral" />
      </div>
    </div>
  );
  const mapElement = (
    <LazyMapContainer
      className={cn(
        presentation === "frameless"
          ? "h-full min-h-full rounded-none border-0 shadow-none"
          : "min-h-[28rem] md:min-h-[34rem]",
        mapClassName,
      )}
      ariaLabel="Hartă live misiune SkySend"
      center={viewport.center}
      zoom={viewport.zoom}
      interactive
      showNavigation
      markers={markers}
      overlays={serviceAreaOverlays}
      lines={lines}
      overlayContent={showMapOverlay ? overlayContent ?? defaultOverlayContent : overlayContent}
    />
  );

  if (presentation === "frameless") {
    return (
      <div className={cn("relative h-full min-h-[24rem] overflow-hidden", className)}>
        {mapElement}
      </div>
    );
  }

  return (
    <SectionCard
      eyebrow="Hartă live"
      title="Traseu misiune"
      description="Traseul live folosește punctul de întâlnire curent, iar fallback-ul poate întoarce drona la hub."
      className={cn("relative", className)}
    >
      {mapElement}

      {showStatusFooter ? (
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <StatusBadge
          label={
            activeSegment
              ? formatSegmentLabel(activeSegment.type)
              : "Așteaptă la punctul de întâlnire"
          }
          tone="info"
        />
        <StatusBadge label={`Progres ${progressPercent}%`} tone="neutral" />
        <StatusBadge
          label={`${liveDronePoint.latitude.toFixed(4)}, ${liveDronePoint.longitude.toFixed(4)}`}
          tone="neutral"
        />
      </div>
      ) : null}
    </SectionCard>
  );
}

function getGoogleMapsDirectionsHref(point: GeoPoint) {
  const query = `${point.latitude},${point.longitude}`;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function HubLockerRecoveryMap({ className }: HubLockerRecoveryMapProps) {
  const hubPoint = activeHub.address.location;
  const markers = useMemo<readonly MapMarkerDefinition[]>(
    () => [
      {
        id: "hub-locker-recovery",
        point: hubPoint,
        label: "Locker SkySend la hub",
        description: activeHub.address.formattedAddress,
        kind: "service",
        tone: "meeting",
        variant: "recommended",
        emphasized: true,
        selected: true,
      },
    ],
    [hubPoint],
  );

  return (
    <SectionCard
      eyebrow="Ridicare colet"
      title="Lockerul este la hub-ul SkySend"
      description="Drona se întoarce la hub cu coletul în locker. Poți merge la locație pentru recuperarea coletului."
      className={className}
      size="sm"
    >
      <div className="grid gap-4">
        <LazyMapContainer
          className="min-h-[16rem] overflow-hidden rounded-[calc(var(--radius)+0.375rem)] border border-border/80"
          ariaLabel="Locația lockerului la hub-ul SkySend"
          center={hubPoint}
          zoom={16}
          interactive
          showNavigation={false}
          markers={markers}
          overlayContent={
            <div className="map-overlay-card max-w-xs">
              <p className="type-caption">Locker SkySend</p>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {activeHub.address.formattedAddress}
              </p>
            </div>
          }
        />

        <AppButton asChild className="w-full sm:w-fit">
          <a
            href={getGoogleMapsDirectionsHref(hubPoint)}
            target="_blank"
            rel="noreferrer"
          >
            Deschide locația în Google Maps
          </a>
        </AppButton>
      </div>
    </SectionCard>
  );
}
