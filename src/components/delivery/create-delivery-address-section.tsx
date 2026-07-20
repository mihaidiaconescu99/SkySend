"use client";

import { memo, useMemo } from "react";
import {
  LoaderCircle,
  MapPinned,
} from "lucide-react";
import { AddressAutocompleteInput } from "@/components/maps/address-autocomplete-input";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { candidatePointRecommendationLabels } from "@/lib/candidate-points";
import { cn } from "@/lib/utils";
import type {
  CreateDeliveryAddressDraft,
  CreateDeliveryAddressField,
  CreateDeliveryAddressValidation,
} from "@/lib/create-delivery-addresses";
import type { CandidatePoint } from "@/types/candidate-points";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";
import type { SavedPlace } from "@/types/saved-places";

type CreateDeliveryAddressSectionProps = {
  pickup: CreateDeliveryAddressDraft;
  dropoff: CreateDeliveryAddressDraft;
  pickupValidation: CreateDeliveryAddressValidation;
  dropoffValidation: CreateDeliveryAddressValidation;
  pickupCandidatePoints: readonly CandidatePoint[];
  dropoffCandidatePoints: readonly CandidatePoint[];
  isPlanningPickupHandoffPoints?: boolean;
  isPlanningDropoffHandoffPoints?: boolean;
  isPickupLocked?: boolean;
  isDropoffLocked?: boolean;
  pickupLockMessage?: string | null;
  dropoffLockMessage?: string | null;
  selectedPickupCandidatePointId: string | null;
  selectedDropoffCandidatePointId: string | null;
  activeMapSelectionMode?: CreateDeliveryAddressField | null;
  savedPlaces?: readonly SavedPlace[];
  onAddressChange: (field: CreateDeliveryAddressField, value: string) => void;
  onAddressSelect: (
    field: CreateDeliveryAddressField,
    suggestion: GeoapifyAddressSuggestion,
  ) => void;
  onSavedPlaceSelect?: (
    field: CreateDeliveryAddressField,
    place: SavedPlace,
  ) => void;
  onNotesChange: (field: CreateDeliveryAddressField, value: string) => void;
  onMapSelect?: (field: CreateDeliveryAddressField) => void;
  onCandidatePointSelect?: (
    field: CreateDeliveryAddressField,
    candidatePointId: string,
  ) => void;
};

type AddressFieldBlockProps = {
  field: CreateDeliveryAddressField;
  title: string;
  noteLabel?: string;
  value: CreateDeliveryAddressDraft;
  validation: CreateDeliveryAddressValidation;
  candidatePoints: readonly CandidatePoint[];
  isPlanningHandoffPoints?: boolean;
  isLocked?: boolean;
  lockMessage?: string | null;
  selectedCandidatePointId: string | null;
  isMapModeActive?: boolean;
  savedPlaces?: readonly SavedPlace[];
  onAddressChange: (field: CreateDeliveryAddressField, value: string) => void;
  onAddressSelect: (
    field: CreateDeliveryAddressField,
    suggestion: GeoapifyAddressSuggestion,
  ) => void;
  onSavedPlaceSelect?: (
    field: CreateDeliveryAddressField,
    place: SavedPlace,
  ) => void;
  onNotesChange: (field: CreateDeliveryAddressField, value: string) => void;
  onMapSelect?: (field: CreateDeliveryAddressField) => void;
  onCandidatePointSelect?: (
    field: CreateDeliveryAddressField,
    candidatePointId: string,
  ) => void;
};

const coverageStateClassNames = {
  ready: "border-border/80 bg-secondary/45",
  inside: "border-primary/30 bg-primary/10",
  review: "border-warning/35 bg-warning/10",
  outside: "border-destructive/15 bg-destructive/5",
} as const;

function PlaceShortcutList({
  field,
  title,
  places,
  disabled,
  onSavedPlaceSelect,
}: {
  field: CreateDeliveryAddressField;
  title: string;
  places: readonly SavedPlace[];
  disabled?: boolean;
  onSavedPlaceSelect?: (
    field: CreateDeliveryAddressField,
    place: SavedPlace,
  ) => void;
}) {
  if (!places.length || !onSavedPlaceSelect) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2 pb-1">
        {places.slice(0, 4).map((place) => (
          <button
            key={`${field}-${title}-${place.id}`}
            type="button"
            disabled={disabled}
            onClick={() => onSavedPlaceSelect(field, place)}
            className="min-h-11 max-w-full rounded-full border border-border/80 bg-background/80 px-3.5 py-2 text-left text-xs font-medium leading-tight text-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55"
          >
            Folosește {place.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MeetingPointSelector({
  field,
  candidatePoints,
  hasSelectedAddress,
  isPlanningHandoffPoints,
  disabled,
  selectedCandidatePointId,
  onCandidatePointSelect,
}: {
  field: CreateDeliveryAddressField;
  candidatePoints: readonly CandidatePoint[];
  hasSelectedAddress: boolean;
  isPlanningHandoffPoints?: boolean;
  disabled?: boolean;
  selectedCandidatePointId: string | null;
  onCandidatePointSelect?: (
    field: CreateDeliveryAddressField,
    candidatePointId: string,
  ) => void;
}) {
  const sortedCandidatePoints = useMemo(() => {
    const recommendationOrder = {
      recommended: 0,
      alternative: 1,
      unavailable: 2,
    } as const;

    return [...candidatePoints].sort((left, right) => {
      if (
        recommendationOrder[left.recommendationState] !==
        recommendationOrder[right.recommendationState]
      ) {
        return (
          recommendationOrder[left.recommendationState] -
          recommendationOrder[right.recommendationState]
        );
      }

      return right.smartScore - left.smartScore;
    });
  }, [candidatePoints]);

  if (candidatePoints.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-background/65 px-4 py-3">
        <p className="text-sm leading-6 text-muted-foreground">
          {hasSelectedAddress && !isPlanningHandoffPoints
            ? "Căutăm puncte de întâlnire stradale sau pietonale pe o rază extinsă în jurul adresei selectate."
            : "Punctele de întâlnire apar după ce selectezi o adresă sau un punct pe hartă."}
        </p>
      </div>
    );
  }

  const recommendedPoint = sortedCandidatePoints.find(
    (candidatePoint) => candidatePoint.recommendationState === "recommended",
  );
  const selectedPoint = sortedCandidatePoints.find(
    (candidatePoint) => candidatePoint.id === selectedCandidatePointId,
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Punct de întâlnire cu drona
        </p>
        {isPlanningHandoffPoints ? (
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background/70 px-3 py-2.5">
        <p className="text-sm font-medium leading-6 text-foreground">
          {candidatePoints.length} puncte evaluate
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Selectat: {selectedPoint?.label ?? recommendedPoint?.label ?? "alege un marker de pe hartă"}
        </p>
      </div>

      <div className="grid gap-2 compact-ui:grid expanded-ui:hidden">
        {sortedCandidatePoints.slice(0, 4).map((candidatePoint) => {
          const isSelected = candidatePoint.id === selectedCandidatePointId;
          const isUnavailable =
            candidatePoint.recommendationState === "unavailable" ||
            candidatePoint.eligibilityState === "outside";

          return (
            <button
              key={`${field}-${candidatePoint.id}`}
              type="button"
              disabled={disabled || isUnavailable || !onCandidatePointSelect}
              aria-pressed={isSelected}
              onClick={() => onCandidatePointSelect?.(field, candidatePoint.id)}
              className={cn(
                "grid min-h-16 gap-2 rounded-[calc(var(--radius)+0.25rem)] border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow,opacity] focus-visible:ring-4 focus-visible:ring-ring",
                isSelected
                  ? "border-primary/55 bg-primary/10 shadow-[var(--elevation-soft)]"
                  : "border-border/75 bg-background/62 hover:border-primary/30 hover:bg-secondary/55",
                (disabled || isUnavailable) && "pointer-events-none opacity-55",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5 text-foreground">
                    {candidatePoint.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {candidatePoint.distanceFromOriginMeters} m de adresă · scor {candidatePoint.smartScore}
                  </p>
                </div>
                <StatusBadge
                  label={candidatePointRecommendationLabels[candidatePoint.recommendationState]}
                  tone={
                    candidatePoint.recommendationState === "recommended"
                      ? "success"
                      : candidatePoint.recommendationState === "alternative"
                        ? "warning"
                        : "neutral"
                  }
                  className="shrink-0 px-2 py-1 text-[0.68rem]"
                />
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                {candidatePoint.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AddressFieldBlock = memo(function AddressFieldBlock({
  field,
  title,
  noteLabel,
  value,
  validation,
  candidatePoints,
  isPlanningHandoffPoints,
  isLocked,
  lockMessage,
  selectedCandidatePointId,
  isMapModeActive,
  savedPlaces = [],
  onAddressChange,
  onAddressSelect,
  onSavedPlaceSelect,
  onNotesChange,
  onMapSelect,
  onCandidatePointSelect,
}: AddressFieldBlockProps) {
  return (
    <section
      className={cn(
        "grid min-w-0 gap-3 rounded-[calc(var(--radius)+0.5rem)] border p-3 lg:gap-4 lg:rounded-[calc(var(--radius)+0.75rem)] lg:p-5",
        isMapModeActive
          ? "border-primary/45 bg-primary/10"
          : coverageStateClassNames[
              validation.state === "empty" ? "ready" : validation.state
            ],
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground lg:text-lg">{title}</p>
          {validation.state === "outside" ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-destructive">
              În afara acoperirii
            </p>
          ) : null}
        </div>
      </div>

      {isLocked && lockMessage ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
          <span>{lockMessage}</span>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 lg:gap-3">
        <AddressAutocompleteInput
          label={field === "pickup" ? "Adresă de ridicare" : "Adresă de livrare"}
          value={value.address}
          placeholder={
            field === "pickup"
              ? "Ex: Strada Victoriei 12, Pitești"
              : "Ex: VIVO Mall, Pitești"
          }
          ariaInvalid={validation.state === "outside"}
          hasResolvedSelection={
            value.selectedAddress?.formattedAddress === value.address.trim()
          }
          disabled={isLocked}
          onChange={(nextValue) => onAddressChange(field, nextValue)}
          onSelect={(suggestion) => onAddressSelect(field, suggestion)}
        />
        <AppButton
          type="button"
          variant={isMapModeActive ? "default" : "outline"}
          size="icon"
          aria-label={
            field === "pickup"
              ? "Selectează punctul de ridicare pe hartă"
              : "Selectează punctul de livrare pe hartă"
          }
          disabled={isLocked || !onMapSelect}
          onClick={() => onMapSelect?.(field)}
        >
          <MapPinned className="size-4" />
        </AppButton>
      </div>

      <div className="grid gap-3">
        <PlaceShortcutList
          field={field}
          title="Locații salvate"
          places={savedPlaces}
          disabled={isLocked}
          onSavedPlaceSelect={onSavedPlaceSelect}
        />
      </div>

      {noteLabel ? (
        <details className="group rounded-[calc(var(--radius)+0.3rem)] border border-border/70 bg-background/45 px-3.5 py-3 compact-ui:block expanded-ui:hidden">
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
            {noteLabel}
          </summary>
          <textarea
            value={value.notes}
            rows={3}
            aria-label={`Observații ${title.toLowerCase()}`}
            placeholder="Intrare, recepție, lateral clădire sau o notă scurtă de acces"
            onChange={(event) => onNotesChange(field, event.target.value)}
            className="mt-3 min-h-20 w-full rounded-[var(--ui-radius-card)] border border-input bg-card px-4 py-3 text-sm leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/90 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
          />
        </details>
      ) : null}

      <MeetingPointSelector
        field={field}
        candidatePoints={candidatePoints}
        hasSelectedAddress={Boolean(validation.geocodedAddress)}
        isPlanningHandoffPoints={isPlanningHandoffPoints}
        disabled={isLocked}
        selectedCandidatePointId={selectedCandidatePointId}
        onCandidatePointSelect={onCandidatePointSelect}
      />
    </section>
  );
});

export const CreateDeliveryAddressSection = memo(function CreateDeliveryAddressSection({
  pickup,
  dropoff,
  pickupValidation,
  dropoffValidation,
  pickupCandidatePoints,
  dropoffCandidatePoints,
  isPlanningPickupHandoffPoints,
  isPlanningDropoffHandoffPoints,
  isPickupLocked,
  isDropoffLocked,
  pickupLockMessage,
  dropoffLockMessage,
  selectedPickupCandidatePointId,
  selectedDropoffCandidatePointId,
  activeMapSelectionMode,
  savedPlaces = [],
  onAddressChange,
  onAddressSelect,
  onSavedPlaceSelect,
  onNotesChange,
  onMapSelect,
  onCandidatePointSelect,
}: CreateDeliveryAddressSectionProps) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-3">
        <AddressFieldBlock
          field="pickup"
          title="Ridicare"
          value={pickup}
          validation={pickupValidation}
          candidatePoints={pickupCandidatePoints}
          isPlanningHandoffPoints={isPlanningPickupHandoffPoints}
          isLocked={isPickupLocked}
          lockMessage={pickupLockMessage}
          selectedCandidatePointId={selectedPickupCandidatePointId}
          isMapModeActive={activeMapSelectionMode === "pickup"}
          savedPlaces={savedPlaces}
          onAddressChange={onAddressChange}
          onAddressSelect={onAddressSelect}
          onSavedPlaceSelect={onSavedPlaceSelect}
          onNotesChange={onNotesChange}
          onMapSelect={onMapSelect}
          onCandidatePointSelect={onCandidatePointSelect}
        />

        <AddressFieldBlock
          field="dropoff"
          title="Livrare"
          noteLabel="Adaugă observații pentru livrare"
          value={dropoff}
          validation={dropoffValidation}
          candidatePoints={dropoffCandidatePoints}
          isPlanningHandoffPoints={isPlanningDropoffHandoffPoints}
          isLocked={isDropoffLocked}
          lockMessage={dropoffLockMessage}
          selectedCandidatePointId={selectedDropoffCandidatePointId}
          isMapModeActive={activeMapSelectionMode === "dropoff"}
          savedPlaces={savedPlaces}
          onAddressChange={onAddressChange}
          onAddressSelect={onAddressSelect}
          onSavedPlaceSelect={onSavedPlaceSelect}
          onNotesChange={onNotesChange}
          onMapSelect={onMapSelect}
          onCandidatePointSelect={onCandidatePointSelect}
        />
      </div>

    </div>
  );
});

AddressFieldBlock.displayName = "AddressFieldBlock";
CreateDeliveryAddressSection.displayName = "CreateLivrareAddressSection";

