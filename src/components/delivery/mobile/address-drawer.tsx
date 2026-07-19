"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import {
  ArrowRight,
  Check,
  Heart,
  MapPin,
  MapPinned,
  Navigation,
  X,
} from "lucide-react";
import { AddressAutocompleteInput } from "@/components/maps/address-autocomplete-input";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type {
  CreateDeliveryAddressDraft,
  CreateDeliveryAddressField,
  CreateDeliveryAddressValidation,
} from "@/lib/create-delivery-addresses";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";
import type { SavedPlace } from "@/types/saved-places";

export type AddressDrawerState = "collapsed" | "partial" | "full";

const COLLAPSED_HEIGHT = 248;

const NAV_RESERVE = 100;
const TOPBAR_RESERVE = 112;
const DRAG_THRESHOLD = 44;
const VELOCITY_THRESHOLD = 320;

const expandTransition = { type: "spring", stiffness: 300, damping: 30 } as const;
const collapseTransition = { type: "spring", stiffness: 400, damping: 40 } as const;

type AddressDrawerProps = {
  state: AddressDrawerState;
  onStateChange: (state: AddressDrawerState) => void;
  activeField: CreateDeliveryAddressField;
  onActiveFieldChange: (field: CreateDeliveryAddressField) => void;
  pickup: CreateDeliveryAddressDraft;
  dropoff: CreateDeliveryAddressDraft;
  pickupValidation: CreateDeliveryAddressValidation;
  dropoffValidation: CreateDeliveryAddressValidation;
  savedPlaces: readonly SavedPlace[];
  isLocked: boolean;
  routeReady: boolean;
  outOfZoneMessage: string | null;
  activeMapSelectionField: CreateDeliveryAddressField | null;
  onAddressChange: (field: CreateDeliveryAddressField, value: string) => void;
  onAddressSelect: (
    field: CreateDeliveryAddressField,
    suggestion: GeoapifyAddressSuggestion,
  ) => void;
  onSavedPlaceSelect: (
    field: CreateDeliveryAddressField,
    place: SavedPlace,
  ) => void;
  onMapSelectionToggle: (field: CreateDeliveryAddressField) => void;
  onContinue: () => void;
};

function CollapsedFieldRow({
  field,
  value,
  validation,
  onActivate,
  isMapSelectionActive,
  disabled,
  onMapSelectionToggle,
}: {
  field: CreateDeliveryAddressField;
  value: CreateDeliveryAddressDraft;
  validation: CreateDeliveryAddressValidation;
  onActivate: () => void;
  isMapSelectionActive: boolean;
  disabled: boolean;
  onMapSelectionToggle: () => void;
}) {
  const isPickup = field === "pickup";
  const Icon = isPickup ? MapPin : Navigation;
  const placeholder = isPickup ? "Adresă ridicare" : "Adresă livrare";
  const hasValue = value.address.trim().length > 0;
  const displayValue = hasValue ? value.address.trim() : placeholder;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_3rem] gap-2">
      <button
        type="button"
        onClick={onActivate}
        disabled={disabled}
        className="flex min-h-12 w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/80 bg-card px-3.5 py-2.5 text-left transition-colors hover:border-primary/35 active:bg-secondary/55 disabled:pointer-events-none disabled:opacity-55"
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full",
            isPickup
              ? "bg-primary/15 text-primary"
              : "bg-foreground/10 text-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span
            className={cn(
              "block max-w-full truncate text-sm",
              hasValue ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {displayValue}
          </span>
        </span>
        {hasValue && validation.isEligible ? (
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
        ) : validation.state === "outside" ? (
          <StatusBadge
            label="În afara zonei"
            tone="destructive"
            className="shrink-0 px-2 py-0.5 text-[0.6rem]"
          />
        ) : null}
      </button>
      <button
        type="button"
        onClick={onMapSelectionToggle}
        disabled={disabled}
        aria-pressed={isMapSelectionActive}
        aria-label={
          isPickup
            ? "Poziționează adresa de ridicare cu pinul central"
            : "Poziționează adresa de livrare cu pinul central"
        }
        className={cn(
          "grid min-h-12 place-items-center rounded-2xl border transition-colors focus-visible:ring-4 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55",
          isMapSelectionActive
            ? "border-primary/60 bg-primary text-primary-foreground shadow-[var(--elevation-soft)]"
            : "border-border/80 bg-card text-muted-foreground hover:border-primary/35 hover:text-primary",
        )}
      >
        <MapPinned className="size-4" />
      </button>
    </div>
  );
}

function SavedPlaceShortcuts({
  field,
  places,
  disabled,
  onSelect,
}: {
  field: CreateDeliveryAddressField;
  places: readonly SavedPlace[];
  disabled: boolean;
  onSelect: (place: SavedPlace) => void;
}) {
  if (places.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Locații salvate
      </p>
      <div className="flex flex-wrap gap-2">
        {places.slice(0, 3).map((place) => (
          <button
            key={`${field}-${place.id}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(place)}
            className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-border/80 bg-card px-3.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-55"
          >
            <Heart className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{place.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AddressDrawer({
  state,
  onStateChange,
  activeField,
  onActiveFieldChange,
  pickup,
  dropoff,
  pickupValidation,
  dropoffValidation,
  savedPlaces,
  isLocked,
  routeReady,
  outOfZoneMessage,
  activeMapSelectionField,
  onAddressChange,
  onAddressSelect,
  onSavedPlaceSelect,
  onMapSelectionToggle,
  onContinue,
}: AddressDrawerProps) {
  const isOpen = state !== "collapsed";
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  useEffect(() => {
    const update = () => setViewportHeight(window.innerHeight);

    update();
    window.addEventListener("resize", update);

    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const input = contentRef.current?.querySelector("input");
      input?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, activeField]);

  const maxSheetHeight = Math.max(
    COLLAPSED_HEIGHT,
    viewportHeight - NAV_RESERVE - TOPBAR_RESERVE,
  );
  const partialHeight = Math.min(
    Math.max(Math.round(viewportHeight * 0.55), 320),
    maxSheetHeight,
  );
  const targetHeight =
    state === "collapsed"
      ? COLLAPSED_HEIGHT
      : state === "partial"
        ? partialHeight
        : maxSheetHeight;

  function handleHandleTap() {
    onStateChange(state === "collapsed" ? "partial" : "collapsed");
  }

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.y <= -DRAG_THRESHOLD || info.velocity.y < -VELOCITY_THRESHOLD) {
      onStateChange(state === "collapsed" ? "partial" : "full");
      return;
    }

    if (info.offset.y >= DRAG_THRESHOLD || info.velocity.y > VELOCITY_THRESHOLD) {
      onStateChange(state === "full" ? "partial" : "collapsed");
    }
  }

  const activeValidation =
    activeField === "pickup" ? pickupValidation : dropoffValidation;
  const activeDraft = activeField === "pickup" ? pickup : dropoff;
  const hasActiveResolved =
    activeDraft.selectedAddress?.formattedAddress === activeDraft.address.trim();

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.button
            type="button"
            aria-label="Închide căutarea adresei"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onStateChange("collapsed")}
            style={{
              bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))",
            }}
            className="absolute inset-x-0 top-0 z-20 bg-black/30"
          />
        ) : null}
      </AnimatePresence>

      <motion.section
        aria-label="Adrese de ridicare și livrare"
        initial={false}
        animate={{ height: targetHeight }}
        transition={isOpen ? expandTransition : collapseTransition}
        style={{
          bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))",
          maxHeight:
            "calc(100dvh - var(--bottom-nav-height) - env(safe-area-inset-bottom) - 7rem)",
        }}
        className="pointer-events-auto absolute inset-x-0 z-30 flex flex-col overflow-hidden rounded-t-[20px] border-t border-border/80 bg-background/98 shadow-[var(--elevation-panel)] backdrop-blur-xl"
      >
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          onTap={handleHandleTap}
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2 active:cursor-grabbing"
        >
          <span className="h-1 w-8 rounded-full bg-foreground/30" aria-hidden />
        </motion.div>

        <div
          ref={contentRef}
          className={cn(
            "min-h-0 flex-1 overscroll-contain px-4 pt-3 pb-4",
            isOpen ? "overflow-y-auto" : "overflow-hidden",
          )}
        >
          {isOpen ? (
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-lg font-bold tracking-tight text-foreground">
                  {activeField === "pickup"
                    ? "Adresă de ridicare"
                    : "Adresă de livrare"}
                </p>
                <button
                  type="button"
                  aria-label="Închide"
                  onClick={() => onStateChange("collapsed")}
                  className="grid size-9 place-items-center rounded-full border border-border/80 bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(["pickup", "dropoff"] as const).map((field) => {
                  const isActive = field === activeField;

                  return (
                    <button
                      key={field}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onActiveFieldChange(field)}
                      className={cn(
                        "min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary/55 bg-primary/10 text-foreground"
                          : "border-border/80 bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {field === "pickup" ? "Ridicare" : "Livrare"}
                    </button>
                  );
                })}
              </div>

              <SavedPlaceShortcuts
                field={activeField}
                places={savedPlaces}
                disabled={isLocked}
                onSelect={(place) => {
                  onSavedPlaceSelect(activeField, place);
                  onStateChange("collapsed");
                }}
              />

              <AddressAutocompleteInput
                key={activeField}
                label={
                  activeField === "pickup"
                    ? "Caută strada sau punctul de plecare"
                    : "Caută strada sau destinația"
                }
                value={activeDraft.address}
                placeholder={
                  activeField === "pickup"
                    ? "Ex: Strada Victoriei 12, Pitești"
                    : "Ex: VIVO Mall, Pitești"
                }
                ariaInvalid={activeValidation.state === "outside"}
                hasResolvedSelection={hasActiveResolved}
                disabled={isLocked}
                onChange={(value) => onAddressChange(activeField, value)}
                onSelect={(suggestion) => {
                  onAddressSelect(activeField, suggestion);
                  onStateChange("collapsed");
                }}
              />

              {outOfZoneMessage ? (
                <p className="text-xs leading-5 text-destructive">
                  {outOfZoneMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="font-heading text-lg font-bold tracking-tight text-foreground">
                Unde trimitem?
              </p>

              <div className="grid gap-2">
                <CollapsedFieldRow
                  field="pickup"
                  value={pickup}
                  validation={pickupValidation}
                  onActivate={() => {
                    onActiveFieldChange("pickup");
                    onStateChange("partial");
                  }}
                  isMapSelectionActive={activeMapSelectionField === "pickup"}
                  disabled={isLocked}
                  onMapSelectionToggle={() => {
                    onActiveFieldChange("pickup");
                    onMapSelectionToggle("pickup");
                  }}
                />
                <CollapsedFieldRow
                  field="dropoff"
                  value={dropoff}
                  validation={dropoffValidation}
                  onActivate={() => {
                    onActiveFieldChange("dropoff");
                    onStateChange("partial");
                  }}
                  isMapSelectionActive={activeMapSelectionField === "dropoff"}
                  disabled={isLocked}
                  onMapSelectionToggle={() => {
                    onActiveFieldChange("dropoff");
                    onMapSelectionToggle("dropoff");
                  }}
                />
              </div>

              {outOfZoneMessage ? (
                <p className="text-xs leading-5 text-destructive">
                  {outOfZoneMessage}
                </p>
              ) : null}

              <AppButton
                type="button"
                size="lg"
                className="w-full min-h-12"
                disabled={!routeReady || isLocked}
                onClick={onContinue}
              >
                Continuă
                <ArrowRight className="size-4" />
              </AppButton>
            </div>
          )}
        </div>
      </motion.section>
    </>
  );
}
