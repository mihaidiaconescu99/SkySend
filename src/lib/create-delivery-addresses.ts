import {
  getServiceAreaUnavailableMessage,
  isGeocodedAddressEligible,
} from "@/lib/service-area";
import type { GeocodedAddress } from "@/types/service-area";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";

export type CreateDeliveryAddressField = "pickup" | "dropoff";

export type CreateDeliveryAddressDraft = {
  address: string;
  notes: string;
  selectedAddress: GeocodedAddress | null;
};

export type CreateDeliveryAddressValidationState =
  | "empty"
  | "ready"
  | "inside"
  | "review"
  | "outside";

export type CreateDeliveryAddressValidationTone =
  | "neutral"
  | "success"
  | "warning"
  | "destructive"
  | "info";

export type CreateDeliveryAddressValidation = {
  state: CreateDeliveryAddressValidationState;
  tone: CreateDeliveryAddressValidationTone;
  badgeLabel: string;
  helperText: string;
  geocodedAddress: GeocodedAddress | null;
  isEligible: boolean;
  needsManualReview: boolean;
};

export type CreateDeliveryCoverageSummary = {
  state: "ready" | "inside" | "review" | "outside";
  tone: CreateDeliveryAddressValidationTone;
  title: string;
  description: string;
};

export const defaultCreateDeliveryAddressDrafts: Record<
  CreateDeliveryAddressField,
  CreateDeliveryAddressDraft
> = {
  pickup: {
    address: "",
    notes: "",
    selectedAddress: null,
  },
  dropoff: {
    address: "",
    notes: "",
    selectedAddress: null,
  },
};

export function validateCreateDeliveryAddress(
  draft: CreateDeliveryAddressDraft,
): CreateDeliveryAddressValidation {
  const trimmedValue = draft.address.trim();

  if (!trimmedValue) {
    return {
      state: "empty",
      tone: "neutral",
      badgeLabel: "Adresă necesară",
      helperText:
        "Adaugă mai întâi adresa. Verificarea acoperirii apare când traseul este suficient de specific.",
      geocodedAddress: null,
      isEligible: false,
      needsManualReview: false,
    };
  }

  const geocodedAddress =
    draft.selectedAddress?.formattedAddress === trimmedValue
      ? draft.selectedAddress
      : null;

  if (!geocodedAddress) {
    return {
      state: "ready",
      tone: "info",
      badgeLabel: "Selectează o sugestie",
      helperText:
        "Alege una dintre sugestiile de adresă pentru a confirma locația exactă și acoperirea în zona activă Pitești.",
      geocodedAddress: null,
      isEligible: false,
      needsManualReview: false,
    };
  }

  const eligibility = isGeocodedAddressEligible(geocodedAddress);

  if (!eligibility.isEligible) {
    return {
      state: "outside",
      tone: "destructive",
      badgeLabel: "În afara acoperirii",
      helperText: getServiceAreaUnavailableMessage(),
      geocodedAddress,
      isEligible: false,
      needsManualReview: false,
    };
  }

  if (eligibility.needsManualReview) {
    return {
      state: "review",
      tone: "warning",
      badgeLabel: "Verificare la limită",
      helperText: eligibility.message,
      geocodedAddress,
      isEligible: true,
      needsManualReview: true,
    };
  }

  return {
    state: "inside",
    tone: "success",
    badgeLabel: "În zona activă",
    helperText: eligibility.message,
    geocodedAddress,
    isEligible: true,
    needsManualReview: false,
  };
}

export function createDeliveryAddressDraftFromSuggestion(
  currentValue: CreateDeliveryAddressDraft,
  suggestion: GeoapifyAddressSuggestion,
): CreateDeliveryAddressDraft {
  return {
    ...currentValue,
    address: suggestion.label,
    selectedAddress: suggestion.geocodedAddress,
  };
}

export function createDeliveryAddressDraftFromGeocodedAddress(
  currentValue: CreateDeliveryAddressDraft,
  geocodedAddress: GeocodedAddress,
): CreateDeliveryAddressDraft {
  return {
    ...currentValue,
    address: geocodedAddress.formattedAddress,
    selectedAddress: geocodedAddress,
  };
}

export function getCreateDeliveryCoverageSummary(
  pickup: CreateDeliveryAddressValidation,
  dropoff: CreateDeliveryAddressValidation,
): CreateDeliveryCoverageSummary {
  if (pickup.state === "outside" || dropoff.state === "outside") {
    return {
      state: "outside",
      tone: "destructive",
      title: "Traseu în afara acoperirii curente",
      description: getServiceAreaUnavailableMessage(),
    };
  }

  if (pickup.state === "review" || dropoff.state === "review") {
    return {
      state: "review",
      tone: "warning",
      title: "Traseu aproape de limita activă",
      description:
        "Un punct al traseului este aproape de limita serviciului din Pitești. Fezabilitatea finală confirmă traseul înainte de dispatch.",
    };
  }

  if (pickup.state === "inside" && dropoff.state === "inside") {
    return {
      state: "inside",
      tone: "success",
      title: "Traseu în acoperirea activă Pitești",
      description:
        "Ridicarea și livrarea sunt în zona curentă a orașului și sunt readye pentru pasul următor.",
    };
  }

  return {
    state: "ready",
    tone: "info",
    title: "Verificarea acoperirii apare pe măsură ce scrii",
    description:
      "Traseul este validat în zona activă Pitești imediat ce ambele adrese sunt suficient de specifice.",
  };
}
