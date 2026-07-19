"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import { AddressDrawer, type AddressDrawerState } from "@/components/delivery/mobile/address-drawer";
import { useMapCenterSelectionController } from "@/components/delivery/mobile/map-tap-controller";
import { LazyMapContainer } from "@/components/maps/lazy-map-container";
import { cn } from "@/lib/utils";
import type {
  CreateDeliveryAddressDraft,
  CreateDeliveryAddressField,
  CreateDeliveryAddressValidation,
} from "@/lib/create-delivery-addresses";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";
import type {
  MapLineDefinition,
  MapMarkerDefinition,
  MapOverlayDefinition,
  MapViewport,
} from "@/types/map";
import type { SavedPlace } from "@/types/saved-places";
import type { GeoPoint } from "@/types/service-area";

type CreateDeliveryMapStepProps = {
  mapViewport: { center: GeoPoint; zoom: number };
  mapMarkers: readonly MapMarkerDefinition[];
  routeMapLines: readonly MapLineDefinition[];
  serviceAreaOverlays: readonly MapOverlayDefinition[];
  pickup: CreateDeliveryAddressDraft;
  dropoff: CreateDeliveryAddressDraft;
  pickupValidation: CreateDeliveryAddressValidation;
  dropoffValidation: CreateDeliveryAddressValidation;
  savedPlaces: readonly SavedPlace[];
  isLocked: boolean;
  routeReady: boolean;
  platformGateMessage: string | null;
  onAddressChange: (field: CreateDeliveryAddressField, value: string) => void;
  onAddressSelect: (
    field: CreateDeliveryAddressField,
    suggestion: GeoapifyAddressSuggestion,
  ) => void;
  onSavedPlaceSelect: (
    field: CreateDeliveryAddressField,
    place: SavedPlace,
  ) => void;
  onResolveAddressFromMapPoint: (
    field: CreateDeliveryAddressField,
    point: GeoPoint,
    signal: AbortSignal,
  ) => Promise<boolean>;
  onContinue: () => void;
};

export function CreateDeliveryMapStep({
  mapViewport,
  mapMarkers,
  routeMapLines,
  serviceAreaOverlays,
  pickup,
  dropoff,
  pickupValidation,
  dropoffValidation,
  savedPlaces,
  isLocked,
  routeReady,
  platformGateMessage,
  onAddressChange,
  onAddressSelect,
  onSavedPlaceSelect,
  onResolveAddressFromMapPoint,
  onContinue,
}: CreateDeliveryMapStepProps) {
  const [drawerState, setDrawerState] = useState<AddressDrawerState>("collapsed");
  const [activeField, setActiveField] =
    useState<CreateDeliveryAddressField>("pickup");
  const currentViewportRef = useRef<MapViewport>(mapViewport);
  const [selectionViewport, setSelectionViewport] =
    useState<MapViewport | null>(null);

  const resolveViewportCenter = useCallback(
    (
      field: CreateDeliveryAddressField,
      viewport: MapViewport,
      signal: AbortSignal,
    ) => onResolveAddressFromMapPoint(field, viewport.center, signal),
    [onResolveAddressFromMapPoint],
  );
  const {
    activeField: activeMapSelectionField,
    feedback,
    isResolving,
    toggleField,
    stopSelection,
    handleViewportSettled,
  } = useMapCenterSelectionController({
    onResolve: resolveViewportCenter,
  });

  useEffect(() => {
    if (!activeMapSelectionField) {
      currentViewportRef.current = mapViewport;
    }
  }, [activeMapSelectionField, mapViewport]);

  const handleMapSelectionToggle = useCallback(
    (field: CreateDeliveryAddressField) => {
      if (!activeMapSelectionField) {
        setSelectionViewport(currentViewportRef.current);
      } else if (activeMapSelectionField === field) {
        setSelectionViewport(null);
      }

      setDrawerState("collapsed");
      toggleField(field);
    },
    [activeMapSelectionField, toggleField],
  );

  const handleMapViewportSettled = useCallback(
    (viewport: MapViewport) => {
      currentViewportRef.current = viewport;
      void handleViewportSettled(viewport);
    },
    [handleViewportSettled],
  );

  const closeMapSelection = useCallback(() => {
    stopSelection();
    setSelectionViewport(null);
  }, [stopSelection]);

  const handleContinue = useCallback(() => {
    closeMapSelection();
    onContinue();
  }, [closeMapSelection, onContinue]);

  const noticeMessage =
    pickupValidation.state === "outside" || dropoffValidation.state === "outside"
      ? "Adresa e în afara zonei active Pitești."
      : platformGateMessage;

  const continueReady = routeReady && !platformGateMessage;
  const showCenterPin = Boolean(activeMapSelectionField);
  const displayedViewport = selectionViewport ?? mapViewport;

  return (
    <div className="relative h-dvh min-h-svh overflow-hidden bg-[#081416]">
      <LazyMapContainer
        className={cn(
          "mobile-create-map map-surface--premium absolute inset-0 z-0 h-full min-h-full rounded-none border-0 shadow-none",
          showCenterPin && "[&_canvas]:cursor-grab [&_canvas:active]:cursor-grabbing",
        )}
        ariaLabel="Hartă creare livrare"
        center={displayedViewport.center}
        zoom={displayedViewport.zoom}
        interactive
        showNavigation={false}
        markers={mapMarkers}
        lines={routeMapLines}
        overlays={serviceAreaOverlays}
        onViewportSettled={handleMapViewportSettled}
      />

      {showCenterPin ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-full"
          aria-hidden="true"
        >
          <div className="relative drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]">
            <MapPin className="size-11 fill-red-500 text-red-200" strokeWidth={2.25} />
            <span className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-red-400 ring-4 ring-red-500/25" />
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-4"
          style={{
            bottom:
              "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 248px + 0.75rem)",
          }}
        >
          <div
            className="flex max-w-full items-center gap-2 rounded-full border border-border/80 bg-background/95 px-4 py-2 text-xs font-medium text-foreground shadow-[var(--elevation-soft)] backdrop-blur-md"
            aria-live="polite"
          >
            {isResolving ? <LoaderCircle className="size-3.5 shrink-0 animate-spin" /> : null}
            <span className="truncate">{feedback}</span>
          </div>
        </div>
      ) : null}

      <AddressDrawer
        state={drawerState}
        onStateChange={setDrawerState}
        activeField={activeField}
        onActiveFieldChange={setActiveField}
        pickup={pickup}
        dropoff={dropoff}
        pickupValidation={pickupValidation}
        dropoffValidation={dropoffValidation}
        savedPlaces={savedPlaces}
        isLocked={isLocked}
        routeReady={continueReady}
        outOfZoneMessage={noticeMessage}
        activeMapSelectionField={activeMapSelectionField}
        onAddressChange={(field, value) => {
          closeMapSelection();
          onAddressChange(field, value);
        }}
        onAddressSelect={(field, suggestion) => {
          closeMapSelection();
          onAddressSelect(field, suggestion);
        }}
        onSavedPlaceSelect={(field, place) => {
          closeMapSelection();
          onSavedPlaceSelect(field, place);
        }}
        onMapSelectionToggle={handleMapSelectionToggle}
        onContinue={handleContinue}
      />
    </div>
  );
}
