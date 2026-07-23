"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  CircleAlert,
  GripHorizontal,
  LoaderCircle,
  MapPinOff,
  MapPinned,
  MoveRight,
  Package2,
  Zap,
} from "lucide-react";
import { CreateDeliveryAddressSection } from "@/components/delivery/create-delivery-address-section";
import { CreateDeliveryMapStep } from "@/components/delivery/mobile/create-delivery-map-step";
import { CreateDeliveryParcelSection } from "@/components/delivery/create-delivery-parcel-section";
import { CreateDeliveryCheckoutPanel } from "@/components/delivery/create-delivery-checkout-panel";
import { LazyMapContainer } from "@/components/maps/lazy-map-container";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/use-media-query";
import { COMPACT_LAYOUT_MEDIA_QUERY } from "@/lib/responsive-layout";
import { useServiceCity } from "@/hooks/use-service-city";
import {
  fetchHandoffCandidatePoints,
  generateCandidatePointsForAddress,
  getDefaultSelectedCandidatePoint,
} from "@/lib/candidate-points";
import {
  createDeliveryAddressDraftFromGeocodedAddress,
  createDeliveryAddressDraftFromSuggestion,
  defaultCreateDeliveryAddressDrafts,
  getCreateDeliveryCoverageSummary,
  validateCreateDeliveryAddress,
  type CreateDeliveryAddressField,
} from "@/lib/create-delivery-addresses";
import {
  defaultCreateDeliveryParcelDraft,
  fromParcelAssistantInput,
  getCreateDeliveryConfirmedParcelProfile,
  getCreateDeliveryParcelGuidance,
  isCreateDeliveryParcelConfirmed,
  isCreateDeliveryParcelReadyForConfiguration,
  validateCreateDeliveryParcel,
  parcelCategoryLabels,
  parcelPackagingLabels,
  parcelSizeLabels,
  type CreateDeliveryParcelDraft,
} from "@/lib/create-delivery-parcel";
import { deliveryPlatformLabels } from "@/constants/delivery-configurations";
import { activeHub } from "@/constants/hub";
import { droneFleet } from "@/constants/drone-fleet";
import { fetchGeoapifyReverseGeocodedSuggestion } from "@/lib/geoapify";
import {
  getUnavailableDeliveryConfigurationRecommendation,
  recommendDeliveryConfiguration,
} from "@/lib/drone-recommendation";
import { calculateDistanceKm } from "@/lib/mission-route";
import { calculateSkySendPricing } from "@/lib/pricing";
import {
  getMarkerDrivenViewport,
  getServiceAreaMapOverlay,
} from "@/lib/map";
import { getDistanceKm } from "@/lib/service-area";
import { createLocalOrderId } from "@/lib/create-delivery-submit";
import { getAdminOperationalSettings } from "@/lib/admin-settings";
import { readAndClearRepeatDeliveryPrefill } from "@/lib/repeat-delivery";
import { useSavedPlaces } from "@/hooks/use-saved-places";
import { cn } from "@/lib/utils";
import type { CandidatePoint } from "@/types/candidate-points";
import type {
  CreateDeliveryPayload,
} from "@/types/create-delivery";
import type { OperationalSettings } from "@/types/admin";
import type { GeoapifyAddressSuggestion } from "@/types/geoapify";
import type {
  MapLineDefinition,
  MapMarkerDefinition,
  MapSelectionMode,
} from "@/types/map";
import type { ParcelAssistantInput } from "@/types/parcel-assistant";
import type { ParcelAssistantResult } from "@/types/parcel-assistant";
import type { SavedPlace } from "@/types/saved-places";
import type { GeoPoint } from "@/types/service-area";
import {
  toCreateDeliveryAddressPayload,
  toCreateDeliverySelectedPointPayload,
} from "@/types/create-delivery";

const flowSteps = [
  {
    id: "route",
    label: "Traseu",
    description: "Ridicare, livrare și acoperire",
  },
  {
    id: "parcel",
    label: "Colet",
    description: "Profil colet și estimator",
  },
  {
    id: "options",
    label: "Configurație dronă",
    description: "Modul cargo, ETA și preț",
  },
  {
    id: "review",
    label: "Verificare și plată",
    description: "Confirmă și plătește",
  },
] as const;

const urgencyOptions = [
  {
    value: "standard",
    label: "Standard",
    note: "Dispatch echilibrat în aceeași oră în zona activă a orașului.",
  },
  {
    value: "priority",
    label: "Prioritară",
    note: "Intră mai devreme în coada de dispatch, cu timp mai scurt.",
  },
  {
    value: "scheduled",
    label: "Programată",
    note: "Rezervă un interval programat pentru un traseu cunoscut.",
  },
] as const;

const scheduledWindowDays = 7;

type MapSelectionFeedback = {
  tone: "info" | "success" | "warning" | "destructive";
  title: string;
  description: string;
};

type CandidatePointCollection = Record<
  CreateDeliveryAddressField,
  CandidatePoint[]
>;

type SelectedCandidatePointCollection = Record<
  CreateDeliveryAddressField,
  CandidatePoint | null
>;

type HandoffPlanningState = Record<CreateDeliveryAddressField, boolean>;

function toMapLineFeatureCollection(
  points: readonly GeoPoint[],
): GeoJSON.FeatureCollection<GeoJSON.LineString, GeoJSON.GeoJsonProperties> {
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

type CreateDeliveryFlowStep = "route" | "parcel" | "options" | "review";
type RouteSheetState = "collapsed" | "half" | "expanded";

type ReviewDeliverySnapshot = {
  pickupAddress: string;
  pickupPoint: CandidatePoint | null;
  dropoffAddress: string;
  dropoffPoint: CandidatePoint | null;
  parcelSummary: string;
  parcelContent: string;
  estimatedWeightRange: string;
  urgencyLabel: string;
  urgencyNote: string;
  scheduledLabel: string | null;
  deliveryPlatformLabel: string;
  deliveryModuleLabel: string;
  deliverySelectionReason: string;
  deliveryPriceImpactLabel: string;
  deliveryEligibilityLabel: string;
  estimatedPriceLabel: string;
  fallbackNote: string;
  estimatedWindowLabel: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyMinor(value: number) {
  return formatCurrency(value / 100);
}

const reviewMeetingPointTypeLabels: Record<CandidatePoint["type"], string> = {
  curbside: "Lângă stradă",
  entrance: "Lângă intrare",
  parking: "Lângă parcare",
  public_point: "Acces pietonal",
  building_side: "Acces pietonal",
  street_side: "Lângă stradă",
  storefront: "Lângă intrare",
  access: "Acces pietonal",
};

const temperatureProtectionLabels = {
  none: "Standard",
  passive_insulated: "Izolare pasivă",
  active_thermal: "Protecție termică activă",
} as const;

const securityLevelLabels = {
  standard: "Standard",
  secure: "Securizat",
  secure_plus: "Securizat Plus",
} as const;

const shockProtectionLabels = {
  standard: "Standard",
  stabilized: "Stabilizat",
  reinforced: "Ranfortat",
} as const;

function formatVolumeLiters(value: number | null | undefined) {
  return `${(value ?? 0).toFixed(1)} L`;
}

function formatDimensionsCm({
  lengthCm,
  widthCm,
  heightCm,
}: {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}) {
  return `${lengthCm} x ${widthCm} x ${heightCm} cm`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(value: Date) {
  return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
}

const scheduleWeekdayLabels = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sa", "Du"];
const scheduleHourOptions = Array.from({ length: 15 }, (_, index) =>
  String(index + 8).padStart(2, "0"),
);
const scheduleMinuteOptions = ["00", "15", "30", "45"];

function getScheduledBounds() {
  const min = new Date();
  min.setMinutes(min.getMinutes() + 20);
  min.setSeconds(0, 0);

  const max = new Date(min);
  max.setDate(max.getDate() + scheduledWindowDays);
  max.setHours(23, 59, 0, 0);

  return {
    min,
    max,
    minDate: toDateInputValue(min),
    maxDate: toDateInputValue(max),
  };
}

function parseScheduledLocalDate(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) {
    return null;
  }

  const parsed = new Date(`${dateValue}T${timeValue}:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getScheduleCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    day.setHours(12, 0, 0, 0);
    return day;
  });
}

function getScheduleMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDateInputValue(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDateInputInRange(value: Date, min: Date, max: Date) {
  const day = new Date(value);
  day.setHours(23, 59, 59, 999);
  const minDay = new Date(min);
  minDay.setHours(0, 0, 0, 0);
  const maxDay = new Date(max);
  maxDay.setHours(23, 59, 59, 999);

  return day >= minDay && day <= maxDay;
}

function formatScheduledDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function validateScheduledDispatch({
  urgency,
  date,
  time,
  min,
  max,
}: {
  urgency: (typeof urgencyOptions)[number]["value"];
  date: string;
  time: string;
  min: Date;
  max: Date;
}) {
  if (urgency !== "scheduled") {
    return {
      isValid: true,
      scheduledAt: null,
      message: "Dispatch-ul pornește după ce traseul și plata sunt gata.",
    };
  }

  const scheduledDate = parseScheduledLocalDate(date, time);

  if (!scheduledDate) {
    return {
      isValid: false,
      scheduledAt: null,
      message: "Alege data și ora livrării înainte de verificare.",
    };
  }

  if (scheduledDate < min) {
    return {
      isValid: false,
      scheduledAt: null,
      message: "Livrarea programată trebuie să fie la cel pușin 20 de minute de acum.",
    };
  }

  if (scheduledDate > max) {
    return {
      isValid: false,
      scheduledAt: null,
      message: `Livrarea programată trebuie să fie în următoarele ${scheduledWindowDays} zile.`,
    };
  }

  return {
    isValid: true,
    scheduledAt: scheduledDate.toISOString(),
    message: `Programată pentru ${formatScheduledDateTime(scheduledDate.toISOString())}.`,
  };
}

function getFallbackNote(
  pickupPoint: CandidatePoint | null,
  dropoffPoint: CandidatePoint | null,
) {
  if (!pickupPoint || !dropoffPoint) {
    return "Plan de rezervă: verificare operator înainte de dispatch dacă lipsește un punct de întâlnire conform.";
  }

  if (
    pickupPoint.recommendationState === "recommended" &&
    dropoffPoint.recommendationState === "recommended"
  ) {
    return "Plan de rezervă: păstrează punctele de întâlnire recomandate, apoi cere operațiunilor să reruteze către următorul punct eligibil dacă vremea sau accesul se schimbă.";
  }

  return "Plan de rezervă: respectă mai întâi punctele selectate manual, apoi folosește cel mai bun punct eligibil înainte de anulare.";
}

function getEstimatedWindowMinutes(
  urgency: (typeof urgencyOptions)[number]["value"],
  coverageState: "ready" | "inside" | "review" | "outside",
) {
  const baseMinutes =
    urgency === "priority" ? 18 : urgency === "scheduled" ? 34 : 24;

  if (coverageState === "review") {
    return {
      min: baseMinutes + 4,
      max: baseMinutes + 10,
    };
  }

  return {
    min: baseMinutes,
    max: baseMinutes + 6,
  };
}

function getMarkerToneForAddress(
  state: "empty" | "ready" | "inside" | "review" | "outside",
  defaultTone: "pickup" | "dropoff",
) {
  if (state === "outside") {
    return "destructive" as const;
  }

  if (state === "review") {
    return "warning" as const;
  }

  return defaultTone;
}

function isCandidatePointEligibleForContinue(candidatePoint: CandidatePoint | null) {
  return Boolean(
    candidatePoint && candidatePoint.eligibilityState !== "outside",
  );
}

function isValidCandidatePoint(candidatePoint: CandidatePoint) {
  return (
    Number.isFinite(candidatePoint.point.latitude) &&
    Number.isFinite(candidatePoint.point.longitude)
  );
}

type HandoffRequestSlot = {
  id: number;
  controller: AbortController | null;
};
type HandoffRequestState = Record<
  CreateDeliveryAddressField,
  HandoffRequestSlot
>;

const handoffRequestState: HandoffRequestState = {
  pickup: { id: 0, controller: null },
  dropoff: { id: 0, controller: null },
};

function startHandoffRequest(field: CreateDeliveryAddressField) {
  const slot = handoffRequestState[field];
  slot.id += 1;
  const controller = new AbortController();
  const previousController = slot.controller;
  slot.controller = controller;
  return { id: slot.id, controller, previousController };
}

function isStaleHandoffRequest(
  field: CreateDeliveryAddressField,
  id: number,
  controller: AbortController,
) {
  const slot = handoffRequestState[field];
  return slot.id !== id || slot.controller !== controller;
}

function ownsLatestHandoffRequest(field: CreateDeliveryAddressField, id: number) {
  return handoffRequestState[field].id === id;
}

function clearHandoffRequestController(field: CreateDeliveryAddressField) {
  handoffRequestState[field].controller = null;
}

function getNearestSelectableCandidatePoint(
  points: readonly CandidatePoint[],
  origin: GeoPoint | null | undefined,
) {
  if (!origin) {
    return getDefaultSelectedCandidatePoint(points);
  }

  return (
    points
      .filter(
        (candidatePoint) =>
          candidatePoint.eligibilityState !== "outside" &&
          isValidCandidatePoint(candidatePoint),
      )
      .reduce<CandidatePoint | null>((closestPoint, candidatePoint) => {
        if (!closestPoint) {
          return candidatePoint;
        }

        const closestDistance = getDistanceKm(origin, closestPoint.point);
        const candidateDistance = getDistanceKm(origin, candidatePoint.point);

        return candidateDistance < closestDistance ? candidatePoint : closestPoint;
      }, null) ?? getDefaultSelectedCandidatePoint(points)
  );
}

function buildCandidatePointState(
  drafts: Record<CreateDeliveryAddressField, typeof defaultCreateDeliveryAddressDrafts.pickup>,
): {
  points: CandidatePointCollection;
  selected: SelectedCandidatePointCollection;
} {
  const pickupValidation = validateCreateDeliveryAddress(drafts.pickup);
  const dropoffValidation = validateCreateDeliveryAddress(drafts.dropoff);
  const pickupPoints = pickupValidation.geocodedAddress
    ? generateCandidatePointsForAddress(
        "pickup",
        pickupValidation.geocodedAddress,
        pickupValidation.isEligible,
      )
    : [];
  const dropoffPoints = dropoffValidation.geocodedAddress
    ? generateCandidatePointsForAddress(
        "dropoff",
        dropoffValidation.geocodedAddress,
        dropoffValidation.isEligible,
      )
    : [];

  return {
    points: {
      pickup: pickupPoints,
      dropoff: dropoffPoints,
    },
    selected: {
      pickup: getNearestSelectableCandidatePoint(
        pickupPoints,
        pickupValidation.geocodedAddress?.location,
      ),
      dropoff: getNearestSelectableCandidatePoint(
        dropoffPoints,
        dropoffValidation.geocodedAddress?.location,
      ),
    },
  };
}

function candidatePointFromSavedPlace(place: SavedPlace): CandidatePoint {
  if (place.preferredMeetingPoint) {
    return {
      id: place.preferredMeetingPoint.id,
      label: place.preferredMeetingPoint.label,
      point: place.preferredMeetingPoint.coordinates,
      type: place.preferredMeetingPoint.type,
      description: place.preferredMeetingPoint.description,
      reason: "Preferred meeting point saved with this place.",
      source: "inferred",
      confidence: "medium",
      suitabilityScore: 86,
      eligibilityState: "eligible",
      smartScore: 86,
      distanceFromOriginMeters: 0,
      recommendationState: "recommended",
    };
  }

  return {
    id: `saved-${place.id}`,
    label: "Punct recomandat",
    point: place.coordinates,
    type: "access",
    description: "Saved place location",
    reason: "Saved place selected for this delivery.",
    source: "inferred",
    confidence: "medium",
    suitabilityScore: 82,
    eligibilityState: "eligible",
    smartScore: 82,
    distanceFromOriginMeters: 0,
    recommendationState: "recommended",
  };
}

function mergeCandidatePoints(
  primary: CandidatePoint | null,
  generatedPoints: CandidatePoint[],
) {
  if (!primary) {
    return generatedPoints;
  }

  return [
    primary,
    ...generatedPoints.filter((point) => point.id !== primary.id),
  ];
}

function getSupportedDispatchTiming(
  value: CreateDeliveryPayload["urgency"] | null | undefined,
): (typeof urgencyOptions)[number]["value"] {
  return value === "standard" || value === "priority" || value === "scheduled"
    ? value
    : "priority";
}

function getPlatformGateMessage(status: OperationalSettings["platformStatus"]) {
  if (status === "maintenance") {
    return "Platforma este in mentenanta. Crearea unei livrari este oprita temporar.";
  }

  return null;
}

export function CreateDeliveryShell() {
  const router = useRouter();
  const { user } = useUser();
  const { selectedCity } = useServiceCity();
  const isSelectedCityActive = selectedCity.hubStatus === "active";
  const repeatPrefill = useMemo(() => readAndClearRepeatDeliveryPrefill(), []);
  const initialRouteAddresses = useMemo(
    () =>
      repeatPrefill?.routeAddresses ?? {
        pickup: { ...defaultCreateDeliveryAddressDrafts.pickup },
        dropoff: { ...defaultCreateDeliveryAddressDrafts.dropoff },
      },
    [repeatPrefill],
  );
  const initialCandidatePointState = useMemo(() => {
    const generatedState = buildCandidatePointState(initialRouteAddresses);
    const pickupPrefill = repeatPrefill?.selectedCandidatePoints.pickup ?? null;
    const dropoffPrefill = repeatPrefill?.selectedCandidatePoints.dropoff ?? null;

    return {
      points: {
        pickup: mergeCandidatePoints(pickupPrefill, generatedState.points.pickup),
        dropoff: mergeCandidatePoints(dropoffPrefill, generatedState.points.dropoff),
      },
      selected: {
        pickup: pickupPrefill ?? generatedState.selected.pickup,
        dropoff: dropoffPrefill ?? generatedState.selected.dropoff,
      },
    };
  }, [initialRouteAddresses, repeatPrefill]);
  const [mapSelectionMode, setMapSelectionMode] =
    useState<Exclude<MapSelectionMode, "preview"> | null>(null);
  const [pendingMapPoint, setPendingMapPoint] = useState<GeoPoint | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapSelectionFeedback, setMapSelectionFeedback] =
    useState<MapSelectionFeedback | null>(null);
  const [urgency, setUrgency] = useState<(typeof urgencyOptions)[number]["value"]>(
    getSupportedDispatchTiming(repeatPrefill?.urgency),
  );
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduleCalendarMonth, setScheduleCalendarMonth] = useState(() => {
    const initial = getScheduledBounds().min;
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [routeAddresses, setRouteAddresses] = useState(() => initialRouteAddresses);
  const [candidatePoints, setCandidatePoints] = useState<CandidatePointCollection>(
    () => initialCandidatePointState.points,
  );
  const [pendingCandidateConfirmation, setPendingCandidateConfirmation] =
    useState<{
      field: CreateDeliveryAddressField;
      candidatePointId: string;
    } | null>(null);
  const [isPlanningHandoffPoints, setIsPlanningHandoffPoints] =
    useState<HandoffPlanningState>({
      pickup: false,
      dropoff: false,
    });
  const [selectedCandidatePoints, setSelectedCandidatePoints] =
    useState<SelectedCandidatePointCollection>(
      () => initialCandidatePointState.selected,
    );
  const [parcelDraft, setParcelDraft] = useState<CreateDeliveryParcelDraft>(() => ({
    ...(repeatPrefill?.parcel ?? defaultCreateDeliveryParcelDraft),
  }));
  const { savedPlaces } = useSavedPlaces();
  const [flowStep, setFlowStep] = useState<CreateDeliveryFlowStep>("route");
  const isMobile = useMediaQuery(COMPACT_LAYOUT_MEDIA_QUERY);
  const [routeSheetState, setRouteSheetState] =
    useState<RouteSheetState>("half");
  const routeSheetDragRef = useRef<{
    startY: number;
    lastY: number;
    didDrag: boolean;
  } | null>(null);
  const [pendingPaymentOrderId, setPendingPaymentOrderId] = useState(
    () => createLocalOrderId(new Date().toISOString()),
  );
  const [deliverySessionId, setDeliverySessionId] = useState("");
  const [deliveryDraftHydrated, setDeliveryDraftHydrated] = useState(false);
  const [operationalSettings, setOperationalSettings] =
    useState<OperationalSettings>(() => getAdminOperationalSettings());
  const [reviewGateMessage, setReviewGateMessage] = useState<string | null>(null);
  const activeRoutePlanningField = isPlanningHandoffPoints.pickup
    ? "pickup"
    : isPlanningHandoffPoints.dropoff
      ? "dropoff"
      : null;
  const isRouteSelectionLocked =
    Boolean(activeRoutePlanningField) || isReverseGeocoding;
  const routeSelectionLockMessage = activeRoutePlanningField
    ? activeRoutePlanningField === "pickup"
      ? "Se caută punctele de întâlnire pentru ridicare."
      : "Se caută punctele de întâlnire pentru livrare."
    : isReverseGeocoding
      ? "Pregătim adresa selectată pe hartă."
      : null;
  const platformGateMessage = getPlatformGateMessage(
    operationalSettings.platformStatus,
  );
  const unavailableCityMessage =
    !isSelectedCityActive && selectedCity.id === "bucuresti"
      ? "SkySend se pregătește pentru București. Extindem aria de acoperire și revenim curând cu livrări active în oraș."
      : null;
  const inactiveHubMessage =
    !isSelectedCityActive && selectedCity.id === "pitesti"
      ? "Aplicația este momentan în mentenanță pentru zona Pitești. Revenim cât mai curând. Îți mulțumim pentru răbdare."
      : null;
  const deliveryGateMessage =
    platformGateMessage ?? unavailableCityMessage ?? inactiveHubMessage;
  const isHubAvailable = !deliveryGateMessage;
  const serviceAreaSettingsKey = [
    operationalSettings.serviceRadiusKm,
    operationalSettings.platformStatus,
    operationalSettings.updatedAt ?? "",
  ].join(":");
  const pricingSettingsKey = [
    operationalSettings.basePrice.amountMinor,
    operationalSettings.pricePerKm.amountMinor,
    operationalSettings.updatedAt ?? "",
  ].join(":");
  const serviceAreaOverlays = useMemo(
    () => {
      void serviceAreaSettingsKey;
      return [getServiceAreaMapOverlay()] as const;
    },
    [serviceAreaSettingsKey],
  );

  useEffect(() => {
    function refreshOperationalSettings() {
      setOperationalSettings(getAdminOperationalSettings());
    }

    window.addEventListener(
      "skysend:admin-settings-updated",
      refreshOperationalSettings,
    );
    window.addEventListener("storage", refreshOperationalSettings);

    return () => {
      window.removeEventListener(
        "skysend:admin-settings-updated",
        refreshOperationalSettings,
      );
      window.removeEventListener("storage", refreshOperationalSettings);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function hydrateDeliveryDraft() {
      try {
        const response = await fetch("/api/client/delivery-draft", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !active) return;
        const draft = result.draft as { id: string; current_step: CreateDeliveryFlowStep; payload?: Record<string, unknown> };
        const payload = draft.payload ?? {};
        setDeliverySessionId(draft.id);
        if (payload.routeAddresses) setRouteAddresses(payload.routeAddresses as typeof routeAddresses);
        if (payload.candidatePoints) setCandidatePoints(payload.candidatePoints as CandidatePointCollection);
        if (payload.selectedCandidatePoints) setSelectedCandidatePoints(payload.selectedCandidatePoints as SelectedCandidatePointCollection);
        if (payload.parcelDraft) setParcelDraft(payload.parcelDraft as CreateDeliveryParcelDraft);
        if (payload.urgency === "standard" || payload.urgency === "priority" || payload.urgency === "scheduled") setUrgency(payload.urgency);
        if (typeof payload.scheduledDate === "string") setScheduledDate(payload.scheduledDate);
        if (typeof payload.scheduledTime === "string") setScheduledTime(payload.scheduledTime);
        const evaluationStatus = result.evaluation?.status as string | undefined;
        const evaluationRequiresParcelStep = Boolean(evaluationStatus && evaluationStatus !== "cancelled");
        setFlowStep(evaluationRequiresParcelStep ? "parcel" : draft.current_step);
      } catch (error) {
        console.error("[create-delivery] draft hydration failed", error);
      } finally {
        if (active) setDeliveryDraftHydrated(true);
      }
    }
    void hydrateDeliveryDraft();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!deliveryDraftHydrated || !deliverySessionId) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/client/delivery-draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deliverySessionId,
          currentStep: flowStep,
          payload: {
            routeAddresses,
            candidatePoints,
            selectedCandidatePoints,
            parcelDraft,
            urgency,
            scheduledDate,
            scheduledTime,
          },
        }),
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [candidatePoints, deliveryDraftHydrated, deliverySessionId, flowStep, parcelDraft, routeAddresses, scheduledDate, scheduledTime, selectedCandidatePoints, urgency]);

  useEffect(() => {

    document.body.dataset.createDeliveryStep = flowStep;

    return () => {
      document.body.removeAttribute("data-create-delivery-step");
    };
  }, [flowStep]);

  useEffect(() => {
    if (flowStep !== "parcel" || !deliverySessionId) return;

    const discardOnPageExit = () => {
      void fetch(
        `/api/parcel-ai/images?draftId=${encodeURIComponent(deliverySessionId)}`,
        { method: "DELETE", keepalive: true },
      );
    };

    window.addEventListener("pagehide", discardOnPageExit);
    return () => window.removeEventListener("pagehide", discardOnPageExit);
  }, [deliverySessionId, flowStep]);

  const selectedUrgency = urgencyOptions.find((option) => option.value === urgency);
  const scheduledBounds = useMemo(() => getScheduledBounds(), []);
  const selectedScheduledDate = useMemo(
    () => parseDateInputValue(scheduledDate),
    [scheduledDate],
  );
  const scheduleCalendarDays = useMemo(
    () => getScheduleCalendarDays(scheduleCalendarMonth),
    [scheduleCalendarMonth],
  );
  const scheduledValidation = useMemo(() => {
    return validateScheduledDispatch({
      urgency,
      date: scheduledDate,
      time: scheduledTime,
      min: scheduledBounds.min,
      max: scheduledBounds.max,
    });
  }, [scheduledBounds.max, scheduledBounds.min, scheduledDate, scheduledTime, urgency]);
  const scheduledAt = scheduledValidation.scheduledAt;
  const pickupValidation = useMemo(() => {
    void serviceAreaSettingsKey;
    return validateCreateDeliveryAddress(routeAddresses.pickup);
  }, [routeAddresses.pickup, serviceAreaSettingsKey]);
  const dropoffValidation = useMemo(() => {
    void serviceAreaSettingsKey;
    return validateCreateDeliveryAddress(routeAddresses.dropoff);
  }, [routeAddresses.dropoff, serviceAreaSettingsKey]);
  const coverageSummary = useMemo(() => {
    return getCreateDeliveryCoverageSummary(pickupValidation, dropoffValidation);
  }, [dropoffValidation, pickupValidation]);

  const parcelGuidance = useMemo(() => {
    return getCreateDeliveryParcelGuidance(parcelDraft);
  }, [parcelDraft]);
  const parcelValidation = useMemo(() => {
    return validateCreateDeliveryParcel(parcelDraft);
  }, [parcelDraft]);
  const isParcelProfileConfirmed = isCreateDeliveryParcelConfirmed(parcelDraft);
  const isParcelReadyForConfiguration =
    isCreateDeliveryParcelReadyForConfiguration(parcelDraft);
  const confirmedParcelProfile =
    getCreateDeliveryConfirmedParcelProfile(parcelDraft);
  const routeDistanceKm = useMemo(() => {
    if (!selectedCandidatePoints.pickup || !selectedCandidatePoints.dropoff) {
      return 8;
    }

    return (
      calculateDistanceKm(
        activeHub.address.location,
        selectedCandidatePoints.pickup.point,
      ) +
      calculateDistanceKm(
        selectedCandidatePoints.pickup.point,
        selectedCandidatePoints.dropoff.point,
      )
    );
  }, [selectedCandidatePoints.dropoff, selectedCandidatePoints.pickup]);
  const deliveryConfigurationRecommendation = useMemo(() => {
    if (!isParcelProfileConfirmed || !confirmedParcelProfile) {
      return getUnavailableDeliveryConfigurationRecommendation(
        "Confirmă profilul coletului înainte de recomandarea automată.",
      );
    }

    if (!isParcelReadyForConfiguration) {
      return getUnavailableDeliveryConfigurationRecommendation(
        "Răspunde la întrebările de clarificare înainte de recomandarea automată.",
      );
    }

    const riskFlags = confirmedParcelProfile.riskFlags;
    const handlingNotes = confirmedParcelProfile.handlingNotes;
    const weatherSensitivity = confirmedParcelProfile.weatherSensitivity;
    const advancedDetails = confirmedParcelProfile.advancedDetails;
    const riskText = riskFlags
      .map((riskFlag) =>
        [riskFlag.code, riskFlag.label, riskFlag.reason].filter(Boolean).join(" "),
      )
      .join(" ")
      .toLowerCase();
    const temperatureSensitive = Boolean(
      confirmedParcelProfile.packaging === "insulated" ||
        advancedDetails?.temperatureControlled ||
        advancedDetails?.perishable ||
        weatherSensitivity.heat ||
        weatherSensitivity.cold ||
        handlingNotes.some((note) => note.code === "temperature_sensitive") ||
        riskText.includes("temperature") ||
        riskText.includes("weather_sensitive"),
    );
    const securitySensitive = Boolean(
      advancedDetails?.sealed ||
        (advancedDetails?.declaredValueMinor &&
          advancedDetails.declaredValueMinor >= 50000) ||
        riskText.includes("valuable") ||
        riskText.includes("high-value") ||
        riskText.includes("secure"),
    );

    return recommendDeliveryConfiguration({
      confirmedWeightKg:
        confirmedParcelProfile.estimatedWeightRange.midpointKg ??
        parcelDraft.weightKg ??
        0,
      parcelDimensionsCm: confirmedParcelProfile.estimatedDimensions.dimensionsCm,
      volumeLiters: confirmedParcelProfile.volumeLiters,
      category: confirmedParcelProfile.category,
      packaging: confirmedParcelProfile.packaging,
      fragilityLevel: confirmedParcelProfile.fragility,
      temperatureSensitive,
      securitySensitive,
      routeDistanceKm,
      urgency: urgency === "scheduled" ? "standard" : urgency,
      riskFlags,
      contentSignals: [
        confirmedParcelProfile.naturalDescription.text,
        ...confirmedParcelProfile.detectedItems.map((item) => item.label),
      ],
    });
  }, [
    confirmedParcelProfile,
    isParcelProfileConfirmed,
    isParcelReadyForConfiguration,
    parcelDraft.weightKg,
    routeDistanceKm,
    urgency,
  ]);
  const estimatedWindow = useMemo(() => {
    return getEstimatedWindowMinutes(urgency, coverageSummary.state);
  }, [coverageSummary.state, urgency]);
  const selectedDeliveryConfiguration =
    deliveryConfigurationRecommendation.selectedConfiguration;
  const compatibilityDroneClass =
    selectedDeliveryConfiguration?.mappedDroneClass ??
    deliveryConfigurationRecommendation.fallbackDroneClass;
  const compatibilityDrone =
    droneFleet.find((drone) => drone.id === compatibilityDroneClass) ??
    droneFleet.find((drone) => drone.id === "medium_standard") ??
    droneFleet[0];
  const selectedConfigurationReady =
    isParcelReadyForConfiguration &&
    deliveryConfigurationRecommendation.eligible &&
    Boolean(selectedDeliveryConfiguration);
  const pricingSnapshot = useMemo(() => {
    void pricingSettingsKey;
    return calculateSkySendPricing({
      pickupCoordinates: selectedCandidatePoints.pickup?.point ?? null,
      dropoffCoordinates: selectedCandidatePoints.dropoff?.point ?? null,
      distanceKm: routeDistanceKm,
      selectedDroneId: compatibilityDrone.id,
      deliveryConfiguration: selectedDeliveryConfiguration
        ? {
            id: selectedDeliveryConfiguration.id,
            platform: selectedDeliveryConfiguration.platform,
            moduleName: selectedDeliveryConfiguration.moduleName,
            mappedDroneClass: selectedDeliveryConfiguration.mappedDroneClass,
            pricingMultipliers:
              selectedDeliveryConfiguration.pricingMultipliers,
            temperatureProtection:
              selectedDeliveryConfiguration.temperatureProtection,
            securityLevel: selectedDeliveryConfiguration.securityLevel,
            shockProtection: selectedDeliveryConfiguration.shockProtection,
          }
        : null,
      dispatchTiming: urgency,
      scheduledAt,
      weightKg: isParcelReadyForConfiguration
        ? (confirmedParcelProfile?.estimatedWeightRange.midpointKg ??
          parcelDraft.weightKg)
        : null,
      dimensionsCm: {
        lengthCm: isParcelReadyForConfiguration
          ? (confirmedParcelProfile?.estimatedDimensions.dimensionsCm.lengthCm ??
            parcelDraft.lengthCm)
          : null,
        widthCm: isParcelReadyForConfiguration
          ? (confirmedParcelProfile?.estimatedDimensions.dimensionsCm.widthCm ??
            parcelDraft.widthCm)
          : null,
        heightCm: isParcelReadyForConfiguration
          ? (confirmedParcelProfile?.estimatedDimensions.dimensionsCm.heightCm ??
            parcelDraft.heightCm)
          : null,
      },
      fragilityLevel: isParcelReadyForConfiguration
        ? (confirmedParcelProfile?.fragility ?? parcelDraft.fragilityLevel)
        : "low",
      routeComplexity: coverageSummary.state === "review" ? "review" : "standard",
    });
  }, [
    confirmedParcelProfile,
    coverageSummary.state,
    isParcelReadyForConfiguration,
    parcelDraft.fragilityLevel,
    parcelDraft.heightCm,
    parcelDraft.lengthCm,
    parcelDraft.weightKg,
    parcelDraft.widthCm,
    pricingSettingsKey,
    routeDistanceKm,
    scheduledAt,
    selectedCandidatePoints.dropoff?.point,
    selectedCandidatePoints.pickup?.point,
    selectedDeliveryConfiguration,
    compatibilityDrone,
    urgency,
  ]);
  const estimatedPrice = pricingSnapshot.total.amountMinor / 100;
  const deliveryConfigurationPriceImpactMinor =
    (pricingSnapshot.deliveryConfigurationAdjustment?.amountMinor ?? 0) +
    (pricingSnapshot.fragileHandlingSurcharge.amountMinor ?? 0) +
    (pricingSnapshot.thermalHandlingSurcharge?.amountMinor ?? 0) +
    (pricingSnapshot.secureHandlingSurcharge?.amountMinor ?? 0);
  const confirmedPayloadKg =
    confirmedParcelProfile?.estimatedWeightRange.midpointKg ??
    parcelDraft.weightKg ??
    0;
  const confirmedVolumeLiters = confirmedParcelProfile?.volumeLiters ?? 0;
  const confirmedDimensions =
    confirmedParcelProfile?.estimatedDimensions.dimensionsCm ?? null;
  const configurationSelectionReason =
    selectedDeliveryConfiguration && confirmedParcelProfile
      ? `${selectedDeliveryConfiguration.moduleName} se potrivește profilului confirmat: ${parcelCategoryLabels[confirmedParcelProfile.category].toLowerCase()}, ${confirmedPayloadKg.toFixed(1)} kg, ${formatVolumeLiters(confirmedVolumeLiters)} și fragilitate ${confirmedParcelProfile.fragility}.`
      : (deliveryConfigurationRecommendation.ineligibleReason ??
        "Recomandarea apare după confirmarea profilului coletului.");
  const deliveryEligibilityLabel = deliveryConfigurationRecommendation.eligible
    ? "Eligibilă"
    : "Neeligibilă";
  const parcelReady =
    isParcelReadyForConfiguration &&
    Boolean(parcelDraft.category) &&
    Boolean(parcelDraft.packaging) &&
    Boolean(parcelDraft.approximateSize) &&
    parcelValidation.isValid;
  const urgencyReady = Boolean(selectedUrgency);
  const scheduleReady = scheduledValidation.isValid;
  const optionsReady = urgencyReady && selectedConfigurationReady && scheduleReady;
  const configurationGateMessage =
    !isParcelReadyForConfiguration
      ? "Confirmă profilul coletului înainte de recomandarea automată."
      : !deliveryConfigurationRecommendation.eligible
        ? deliveryConfigurationRecommendation.ineligibleReason
        : null;
  const routeReady = useMemo(() => {
    return (
      pickupValidation.isEligible &&
      dropoffValidation.isEligible &&
      isCandidatePointEligibleForContinue(selectedCandidatePoints.pickup) &&
      isCandidatePointEligibleForContinue(selectedCandidatePoints.dropoff) &&
      routeAddresses.pickup.address.trim().length >= 8 &&
      routeAddresses.dropoff.address.trim().length >= 8
    );
  }, [
    dropoffValidation.isEligible,
    pickupValidation.isEligible,
    routeAddresses.dropoff.address,
    routeAddresses.pickup.address,
    selectedCandidatePoints.dropoff,
    selectedCandidatePoints.pickup,
  ]);
  const routeDisabledReason = useMemo(() => {
    if (!pickupValidation.isEligible || routeAddresses.pickup.address.trim().length < 8) {
      return "Alege adresa de ridicare.";
    }

    if (!dropoffValidation.isEligible || routeAddresses.dropoff.address.trim().length < 8) {
      return "Alege adresa de livrare.";
    }

    if (!isCandidatePointEligibleForContinue(selectedCandidatePoints.pickup)) {
      return "Selectează un punct sigur de handoff pentru ridicare.";
    }

    if (!isCandidatePointEligibleForContinue(selectedCandidatePoints.dropoff)) {
      return "Selectează un punct sigur de handoff pentru livrare.";
    }

    return "Traseul este gata.";
  }, [
    dropoffValidation.isEligible,
    pickupValidation.isEligible,
    routeAddresses.dropoff.address,
    routeAddresses.pickup.address,
    selectedCandidatePoints.dropoff,
    selectedCandidatePoints.pickup,
  ]);
  const canContinue = useMemo(() => {
    return routeReady && parcelReady && optionsReady && !deliveryGateMessage;
  }, [deliveryGateMessage, optionsReady, parcelReady, routeReady]);

  const pickupSummary = pickupValidation.geocodedAddress?.formattedAddress
    ? pickupValidation.geocodedAddress.formattedAddress
    : routeAddresses.pickup.address.trim() || "Adresă de pickup În așteptare";
  const dropoffSummary = dropoffValidation.geocodedAddress?.formattedAddress
    ? dropoffValidation.geocodedAddress.formattedAddress
    : routeAddresses.dropoff.address.trim() || "Adresă de livrare În așteptare";
  const reviewSnapshot = useMemo<ReviewDeliverySnapshot>(() => {
    return {
      pickupAddress: pickupSummary,
      pickupPoint: selectedCandidatePoints.pickup,
      dropoffAddress: dropoffSummary,
      dropoffPoint: selectedCandidatePoints.dropoff,
      parcelSummary: isParcelProfileConfirmed
        ? `${parcelCategoryLabels[parcelDraft.category]} / ${parcelSizeLabels[
            parcelDraft.approximateSize
          ].toLocaleLowerCase("en-US")} / ${parcelPackagingLabels[
            parcelDraft.packaging
          ].toLocaleLowerCase("en-US")}`
        : "Profil colet neconfirmat",
      parcelContent: isParcelProfileConfirmed
        ? parcelDraft.contentDescription.trim() ||
          "Nu există observații despre conținut."
        : "Confirmă profilul coletului înainte de verificare.",
      estimatedWeightRange: isParcelProfileConfirmed && parcelDraft.weightKg
        ? `${parcelDraft.weightKg.toFixed(1)} kg`
        : parcelGuidance.estimatedWeightRange,
      urgencyLabel:
        urgency === "scheduled"
          ? "Dispatch programat"
          : `${selectedUrgency?.label ?? "Dispatch"} dispatch`,
      urgencyNote:
        urgency === "scheduled"
          ? scheduledValidation.message
          : selectedUrgency?.note ?? "Alege timpul de dispatch înainte de confirmare.",
      scheduledLabel: formatScheduledDateTime(scheduledAt),
      deliveryPlatformLabel: selectedDeliveryConfiguration
        ? deliveryPlatformLabels[selectedDeliveryConfiguration.platform]
        : "În așteptare",
      deliveryModuleLabel:
        selectedDeliveryConfiguration?.moduleName ?? "În așteptare",
      deliverySelectionReason: configurationSelectionReason,
      deliveryPriceImpactLabel: formatCurrencyMinor(
        deliveryConfigurationPriceImpactMinor,
      ),
      deliveryEligibilityLabel,
      estimatedPriceLabel: formatCurrency(estimatedPrice),
      fallbackNote: getFallbackNote(
        selectedCandidatePoints.pickup,
        selectedCandidatePoints.dropoff,
      ),
      estimatedWindowLabel: `${estimatedWindow.min} - ${estimatedWindow.max} min`,
    };
  }, [
    dropoffSummary,
    estimatedPrice,
    estimatedWindow.max,
    estimatedWindow.min,
    isParcelProfileConfirmed,
    parcelDraft.approximateSize,
    parcelDraft.category,
    parcelDraft.contentDescription,
    parcelDraft.weightKg,
    parcelDraft.packaging,
    parcelGuidance.estimatedWeightRange,
    pickupSummary,
    selectedCandidatePoints.dropoff,
    selectedCandidatePoints.pickup,
    selectedDeliveryConfiguration,
    configurationSelectionReason,
    deliveryConfigurationPriceImpactMinor,
    deliveryEligibilityLabel,
    selectedUrgency?.label,
    selectedUrgency?.note,
    scheduledAt,
    scheduledValidation.message,
    urgency,
  ]);

  const loadMapAssistedHandoffPoints = useCallback(async (
    field: CreateDeliveryAddressField,
    nextValidation: ReturnType<typeof validateCreateDeliveryAddress>,
    suggestion?: GeoapifyAddressSuggestion | null,
    expectedSelectionId?: string | null,
  ) => {
    if (!nextValidation.geocodedAddress) {
      return;
    }

    const origin = nextValidation.geocodedAddress.location;
    const localFallbackCandidatePoints = generateCandidatePointsForAddress(
      field,
      nextValidation.geocodedAddress,
      nextValidation.isEligible,
    );

    const myRequest = startHandoffRequest(field);
    myRequest.previousController?.abort();
    const { id: myRequestId, controller } = myRequest;

    setIsPlanningHandoffPoints((currentValue) => ({
      ...currentValue,
      [field]: true,
    }));

    const isStale = () => isStaleHandoffRequest(field, myRequestId, controller);

    const applyHandoffPoints = (
      pointsToApply: readonly CandidatePoint[],
    ) => {
      setCandidatePoints((currentValue) => ({
        ...currentValue,
        [field]:
          pointsToApply.length > 0 ? pointsToApply : currentValue[field],
      }));
      setSelectedCandidatePoints((currentValue) => ({
        ...currentValue,
        [field]:
          (currentValue[field]?.id ?? null) === (expectedSelectionId ?? null)
            ? pointsToApply.length > 0
              ? getNearestSelectableCandidatePoint(pointsToApply, origin)
              : currentValue[field]
            : currentValue[field],
      }));
    };

    try {
      const nextCandidatePoints = await fetchHandoffCandidatePoints(
        {
          field,
          address: nextValidation.geocodedAddress,
          isAddressEligible: nextValidation.isEligible,
          suggestion,
        },
        { signal: controller.signal },
      );
      if (isStale()) {
        return;
      }
      applyHandoffPoints(
        nextCandidatePoints.length > 0
          ? nextCandidatePoints
          : localFallbackCandidatePoints,
      );
    } catch {
      if (isStale()) {
        return;
      }

      applyHandoffPoints(localFallbackCandidatePoints);
      setMapSelectionFeedback({
        tone: "warning",
        title: "Punctele de întâlnire sunt limitate",
        description:
          "Ruta rămâne utilizabilă cu puncte apropiate. Poți continua sau poți alege un alt punct din zonă.",
      });
    } finally {

      if (ownsLatestHandoffRequest(field, myRequestId)) {
        clearHandoffRequestController(field);
        setIsPlanningHandoffPoints((currentValue) => ({
          ...currentValue,
          [field]: false,
        }));
      }
    }
  }, []);

  const syncResolvedAddress = useCallback((
    field: CreateDeliveryAddressField,
    nextDraft: (typeof routeAddresses)[CreateDeliveryAddressField],
    feedback: MapSelectionFeedback,
    suggestion?: GeoapifyAddressSuggestion | null,
  ) => {
    const nextValidation = validateCreateDeliveryAddress(nextDraft);
    const nextCandidatePoints: CandidatePoint[] = [];
    const nextSelectedCandidatePoint = null;

    setRouteAddresses((currentValue) => ({
      ...currentValue,
      [field]: nextDraft,
    }));
    setCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: nextCandidatePoints,
    }));
    setSelectedCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: nextSelectedCandidatePoint,
    }));
    setPendingCandidateConfirmation(null);
    setPendingMapPoint(null);
    setMapSelectionFeedback(feedback);
    void loadMapAssistedHandoffPoints(
      field,
      nextValidation,
      suggestion,
      null,
    );
  }, [loadMapAssistedHandoffPoints]);

  const handleAddressChange = useCallback((field: CreateDeliveryAddressField, value: string) => {
    if (isRouteSelectionLocked) {
      return;
    }

    setIsPlanningHandoffPoints((currentValue) => ({
      ...currentValue,
      [field]: false,
    }));
    setRouteAddresses((currentValue) => ({
      ...currentValue,
      [field]: {
        ...currentValue[field],
        address: value,
        selectedAddress: null,
      },
    }));
    setCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: [],
    }));
    setSelectedCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: null,
    }));
    setPendingCandidateConfirmation(null);
  }, [isRouteSelectionLocked]);

  const handleAddressSelect = useCallback((
    field: CreateDeliveryAddressField,
    suggestion: GeoapifyAddressSuggestion,
  ) => {
    if (isRouteSelectionLocked) {
      return;
    }

    const nextDraft = createDeliveryAddressDraftFromSuggestion(
      routeAddresses[field],
      suggestion,
    );

    syncResolvedAddress(
      field,
      nextDraft,
      {
        tone: "success",
        title:
          field === "pickup"
            ? "Adresă de ridicare selectată"
            : "Adresă de livrare selectată",
        description:
          "Markerul adresei selectate rămâne exact acolo. Punctele de întâlnire cu drona sunt sugerate separat.",
      },
      suggestion,
    );
  }, [isRouteSelectionLocked, routeAddresses, syncResolvedAddress]);

  const handleSavedPlaceSelect = useCallback((
    field: CreateDeliveryAddressField,
    place: SavedPlace,
  ) => {
    if (isRouteSelectionLocked) {
      return;
    }

    const nextDraft = {
      address: place.address,
      notes: place.notes,
      selectedAddress: {
        formattedAddress: place.address,
        location: place.coordinates,
        city: "Pitesti",
        county: "Arges",
        country: "Romania",
      },
    };
    const nextValidation = validateCreateDeliveryAddress(nextDraft);
    const savedCandidatePoint = candidatePointFromSavedPlace(place);
    const generatedCandidatePoints = nextValidation.geocodedAddress
      ? generateCandidatePointsForAddress(
          field,
          nextValidation.geocodedAddress,
          nextValidation.isEligible,
        )
      : [];
    const nextCandidatePoints = mergeCandidatePoints(
      savedCandidatePoint,
      generatedCandidatePoints,
    );

    setRouteAddresses((currentValue) => ({
      ...currentValue,
      [field]: nextDraft,
    }));
    setCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: nextCandidatePoints,
    }));
    setSelectedCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: savedCandidatePoint,
    }));
    setMapSelectionFeedback({
      tone: "success",
      title:
        field === "pickup"
          ? "Ridicare completată din locații salvate"
          : "Livrare completată din locații salvate",
      description: "Adresa, observațiile și punctul de întâlnire sunt gata pentru acest traseu.",
    });
  }, [isRouteSelectionLocked]);

  const handleNotesChange = useCallback((field: CreateDeliveryAddressField, value: string) => {
    setRouteAddresses((currentValue) => ({
      ...currentValue,
      [field]: {
        ...currentValue[field],
        notes: value,
      },
    }));
  }, []);

  const handleCandidatePointSelect = useCallback((
    field: CreateDeliveryAddressField,
    candidatePointId: string,
  ) => {
    if (isRouteSelectionLocked) {
      return;
    }

    setIsPlanningHandoffPoints((currentValue) => ({
      ...currentValue,
      [field]: false,
    }));
    const nextSelectedPoint =
      candidatePoints[field].find(
        (candidatePoint) => candidatePoint.id === candidatePointId,
      ) ?? null;
    setSelectedCandidatePoints((currentValue) => ({
      ...currentValue,
      [field]: nextSelectedPoint,
    }));
    setPendingCandidateConfirmation(null);
    setRouteSheetState("half");
  }, [candidatePoints, isRouteSelectionLocked]);

  const snapRouteSheet = useCallback((direction: "up" | "down") => {
    setRouteSheetState((currentValue) => {
      if (direction === "up") {
        return currentValue === "collapsed"
          ? "half"
          : currentValue === "half"
            ? "expanded"
            : "expanded";
      }

      return currentValue === "expanded"
        ? "half"
        : currentValue === "half"
          ? "collapsed"
          : "collapsed";
    });
  }, []);

  const handleRouteSheetHandleClick = useCallback(() => {
    if (routeSheetDragRef.current?.didDrag) {
      routeSheetDragRef.current = null;
      return;
    }

    setRouteSheetState((currentValue) =>
      currentValue === "expanded" ? "half" : "expanded",
    );
  }, []);

  const handleRouteSheetPointerDown = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    routeSheetDragRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      didDrag: false,
    };
  }, []);

  const handleRouteSheetPointerMove = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!routeSheetDragRef.current) {
      return;
    }

    const distance = event.clientY - routeSheetDragRef.current.startY;

    routeSheetDragRef.current = {
      ...routeSheetDragRef.current,
      lastY: event.clientY,
      didDrag: Math.abs(distance) > 10,
    };
  }, []);

  const handleRouteSheetPointerUp = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const dragState = routeSheetDragRef.current;

    if (!dragState) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    const distance = dragState.lastY - dragState.startY;

    if (Math.abs(distance) > 28) {
      snapRouteSheet(distance < 0 ? "up" : "down");
    }
  }, [snapRouteSheet]);

  const handleParcelChange = useCallback(<K extends keyof CreateDeliveryParcelDraft>(
    field: K,
    value: CreateDeliveryParcelDraft[K],
  ) => {
    setParcelDraft((currentValue) => ({
      ...currentValue,
      [field]: value,
      assistantResult: null,
      intelligence: null,
      confirmedProfile: null,
      valueSource: "manual",
    }));
  }, []);

  const handlePickupMapSelectionMode = useCallback(() => {
    if (isRouteSelectionLocked) {
      return;
    }

    setPendingMapPoint(null);
    setRouteSheetState("collapsed");
    setMapSelectionMode((currentValue) =>
      currentValue === "pickup" ? null : "pickup",
    );
    setMapSelectionFeedback({
      tone: "info",
      title: "Selectează adresa de ridicare pe hartă",
      description:
        "Apasă pe locația exactă a expeditorului. SkySend va sugera separat punctele de întâlnire cu drona.",
    });
  }, [isRouteSelectionLocked]);

  const handleDropoffMapSelectionMode = useCallback(() => {
    if (isRouteSelectionLocked) {
      return;
    }

    setPendingMapPoint(null);
    setRouteSheetState("collapsed");
    setMapSelectionMode((currentValue) =>
      currentValue === "dropoff" ? null : "dropoff",
    );
    setMapSelectionFeedback({
      tone: "info",
      title: "Selectează adresa de livrare pe hartă",
      description:
        "Apasă pe locația exactă a destinatarului. SkySend va sugera separat punctele de întâlnire cu drona.",
    });
  }, [isRouteSelectionLocked]);

  const handleAddressMapSelect = useCallback((field: CreateDeliveryAddressField) => {
    if (isRouteSelectionLocked) {
      return;
    }

    if (field === "pickup") {
      handlePickupMapSelectionMode();
      return;
    }

    handleDropoffMapSelectionMode();
  }, [handleDropoffMapSelectionMode, handlePickupMapSelectionMode, isRouteSelectionLocked]);

  const handleMapPointSelection = useCallback(async (point: GeoPoint) => {
    if (!mapSelectionMode || isRouteSelectionLocked) {
      return;
    }

    setPendingMapPoint(point);
    setIsReverseGeocoding(true);
    setMapSelectionFeedback({
      tone: "info",
      title:
        mapSelectionMode === "pickup"
          ? "Pregătim adresa de ridicare"
          : "Pregătim adresa de livrare",
      description: "SkySend transformă coordonata selectată într-o adresă exactă.",
    });

    try {
      const suggestion = await fetchGeoapifyReverseGeocodedSuggestion(point);

      if (!suggestion) {
        setMapSelectionFeedback({
          tone: "warning",
          title: "Adresa nu este suficient de precisă",
          description:
            "Nu am putut construi o adresă sigură din acel punct. Încearcă un punct apropiat de stradă sau folosește căutarea.",
        });
        return;
      }

      const activeField = mapSelectionMode;
      const reverseGeocodedDraft = createDeliveryAddressDraftFromGeocodedAddress(
        routeAddresses[activeField],
        suggestion.geocodedAddress,
      );
      const nextDraft = reverseGeocodedDraft.selectedAddress
        ? {
            ...reverseGeocodedDraft,
            selectedAddress: {
              ...reverseGeocodedDraft.selectedAddress,
              location: point,
            },
          }
        : reverseGeocodedDraft;

      syncResolvedAddress(activeField, nextDraft, {
        tone: "success",
        title:
          activeField === "pickup"
            ? "Ridicare selectată pe hartă"
            : "Livrare selectată pe hartă",
        description:
          "Markerul adresei selectate rămâne pe punctul exact de pe hartă. Punctele de întâlnire sunt afișate separat.",
      }, suggestion);
      setMapSelectionMode(null);
      setPendingMapPoint(null);
    } catch {
      setMapSelectionFeedback({
        tone: "destructive",
        title: "Selectarea pe hartă nu este disponibilă momentan",
        description:
          "Geocodarea inversă nu a putut fi finalizată acum. Încearcă din nou sau folosește câmpul de căutare.",
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [
    isRouteSelectionLocked,
    mapSelectionMode,
    routeAddresses,
    syncResolvedAddress,
  ]);

  const handleResolveAddressFromMapPoint = useCallback(
    async (
      field: CreateDeliveryAddressField,
      point: GeoPoint,
      signal: AbortSignal,
    ): Promise<boolean> => {
      try {
        const suggestion = await fetchGeoapifyReverseGeocodedSuggestion(point, {
          signal,
        });

        if (signal.aborted) {
          return false;
        }

        if (!suggestion) {
          setMapSelectionFeedback({
            tone: "warning",
            title: "Adresa nu este suficient de precisă",
            description:
              "Nu am putut construi o adresă sigură din acel punct. Încearcă un punct apropiat de stradă sau folosește căutarea.",
          });
          return false;
        }

        const reverseGeocodedDraft = createDeliveryAddressDraftFromGeocodedAddress(
          routeAddresses[field],
          suggestion.geocodedAddress,
        );
        const nextDraft = reverseGeocodedDraft.selectedAddress
          ? {
              ...reverseGeocodedDraft,
              selectedAddress: {
                ...reverseGeocodedDraft.selectedAddress,
                location: point,
              },
            }
          : reverseGeocodedDraft;

        if (signal.aborted) {
          return false;
        }

        syncResolvedAddress(
          field,
          nextDraft,
          {
            tone: "success",
            title:
              field === "pickup"
                ? "Ridicare selectată pe hartă"
                : "Livrare selectată pe hartă",
            description: "",
          },
          suggestion,
        );

        return true;
      } catch {
        if (signal.aborted) {
          return false;
        }

        setMapSelectionFeedback({
          tone: "destructive",
          title: "Selectarea pe hartă nu este disponibilă momentan",
          description:
            "Geocodarea inversă nu a putut fi finalizată acum. Încearcă din nou sau folosește câmpul de căutare.",
        });
        return false;
      }
    },
    [routeAddresses, syncResolvedAddress],
  );

  const handleMapPointPreview = useCallback((point: GeoPoint) => {
    if (!mapSelectionMode || isRouteSelectionLocked) {
      return;
    }

    setPendingMapPoint(point);
      setMapSelectionFeedback({
        tone: "success",
        title:
          mapSelectionMode === "pickup"
          ? "Adresă de ridicare selectată"
          : "Adresă de livrare selectată",
        description: "",
      });
  }, [isRouteSelectionLocked, mapSelectionMode]);

  const handleConfirmMapSelection = useCallback(() => {
    if (!pendingMapPoint || isRouteSelectionLocked) {
      return;
    }

    void handleMapPointSelection(pendingMapPoint);
  }, [handleMapPointSelection, isRouteSelectionLocked, pendingMapPoint]);

  function handleReviewDelivery() {
    if (!canContinue) {
      setFlowStep(!routeReady ? "route" : !parcelReady ? "parcel" : "options");
      setReviewGateMessage(
        !routeReady
          ? "Confirmă ridicarea, livrarea și punctele de întâlnire selectate înainte de verificare."
          : !parcelReady
            ? "Confirmă profilul coletului înainte de recomandarea automată."
            : configurationGateMessage ??
              (scheduleReady
                ? "Verificarea se deschide după completarea traseului, coletului și configurației automate."
                : scheduledValidation.message),
      );
      return;
    }

    setReviewGateMessage(null);
    setPendingPaymentOrderId(createLocalOrderId(new Date().toISOString()));
    setFlowStep("review");
  }

  function handleEditDetails() {
    setPendingPaymentOrderId(createLocalOrderId(new Date().toISOString()));
    setFlowStep("options");
  }

  function handleStepBack() {
    setReviewGateMessage(null);

    if (flowStep === "parcel") {
      void discardParcelAiImages();
      setFlowStep("route");
      return;
    }

    if (flowStep === "options") {
      setFlowStep("parcel");
      return;
    }

    if (flowStep === "review") {
      setFlowStep("options");
    }
  }

  function handleStepContinue() {
    setReviewGateMessage(null);

    if (flowStep === "route") {
      if (deliveryGateMessage) {
        setReviewGateMessage(deliveryGateMessage);
        return;
      }

      if (!routeReady) {
        setReviewGateMessage(
          "Confirmă ridicarea, livrarea și punctele de întâlnire selectate înainte de detaliile coletului.",
        );
        return;
      }

      setFlowStep("parcel");
      return;
    }

    if (flowStep === "parcel") {
      if (!parcelReady) {
        setReviewGateMessage(
          "Confirmă profilul coletului înainte de recomandarea automată.",
        );
        return;
      }

      setFlowStep("options");
      return;
    }

    if (flowStep === "options") {
      if (deliveryGateMessage) {
        setReviewGateMessage(deliveryGateMessage);
        return;
      }

      if (!optionsReady) {
        setReviewGateMessage(
          configurationGateMessage ??
            (!scheduleReady
              ? scheduledValidation.message
              : "Configurația automată trebuie să fie eligibilă înainte de verificare."),
        );
        return;
      }

      handleReviewDelivery();
    }
  }

  function buildCreateDeliveryPayload(): CreateDeliveryPayload | null {
    const pickupAddressPayload = toCreateDeliveryAddressPayload(
      routeAddresses.pickup,
    );
    const dropoffAddressPayload = toCreateDeliveryAddressPayload(
      routeAddresses.dropoff,
    );
    const selectedPickupPointPayload = toCreateDeliverySelectedPointPayload(
      selectedCandidatePoints.pickup,
    );
    const selectedDropoffPointPayload = toCreateDeliverySelectedPointPayload(
      selectedCandidatePoints.dropoff,
    );

    if (
      !pickupAddressPayload ||
      !dropoffAddressPayload ||
      !selectedPickupPointPayload ||
      !selectedDropoffPointPayload
    ) {
      return null;
    }

    if (
      !isParcelReadyForConfiguration ||
      !parcelValidation.isValid ||
      !selectedDeliveryConfiguration
    ) {
      return null;
    }

    const toMeetingPointPayloads = (
      points: readonly CandidatePoint[],
      selectedPoint: CandidatePoint | null,
    ) => {
      const payloads = points
        .map((point) => toCreateDeliverySelectedPointPayload(point))
        .filter((point): point is NonNullable<typeof point> => Boolean(point));
      const selectedPayload = selectedPoint
        ? toCreateDeliverySelectedPointPayload(selectedPoint)
        : null;

      if (!selectedPayload) {
        return payloads;
      }

      return [
        selectedPayload,
        ...payloads.filter((point) => point.id !== selectedPayload.id),
      ];
    };

    return {
      userId: user?.id ?? null,
      pickupAddress: pickupAddressPayload,
      dropoffAddress: dropoffAddressPayload,
      selectedPickupPoint: selectedPickupPointPayload,
      selectedDropoffPoint: selectedDropoffPointPayload,
      pickupMeetingPoints: toMeetingPointPayloads(
        candidatePoints.pickup,
        selectedCandidatePoints.pickup,
      ),
      dropoffMeetingPoints: toMeetingPointPayloads(
        candidatePoints.dropoff,
        selectedCandidatePoints.dropoff,
      ),
      parcel: {
        ...parcelDraft,
        estimatedWeightRange: parcelDraft.weightKg
          ? `${parcelDraft.weightKg.toFixed(1)} kg`
          : parcelGuidance.estimatedWeightRange,
        recommendedDroneClass: compatibilityDrone.id,
      },
      urgency,
      scheduledAt,
      recommendedDroneClass: compatibilityDrone.id,
      selectedDeliveryConfiguration: {
        id: selectedDeliveryConfiguration.id,
        platform: selectedDeliveryConfiguration.platform,
        moduleName: selectedDeliveryConfiguration.moduleName,
        shortDescription: selectedDeliveryConfiguration.shortDescription,
        mappedDroneClass: selectedDeliveryConfiguration.mappedDroneClass,
        selectionReason: configurationSelectionReason,
        eligibility: {
          isEligible: deliveryConfigurationRecommendation.eligible,
          ineligibleReason: deliveryConfigurationRecommendation.ineligibleReason,
          score: deliveryConfigurationRecommendation.score,
        },
        capacity: {
          maxPayloadKg: selectedDeliveryConfiguration.maxPayloadKg,
          maxVolumeLiters: selectedDeliveryConfiguration.maxVolumeLiters,
          maxDimensionsCm: selectedDeliveryConfiguration.maxDimensionsCm,
        },
        protection: {
          temperatureProtection:
            selectedDeliveryConfiguration.temperatureProtection,
          securityLevel: selectedDeliveryConfiguration.securityLevel,
          shockProtection: selectedDeliveryConfiguration.shockProtection,
        },
        pricingImpact: {
          amountMinor: deliveryConfigurationPriceImpactMinor,
          currency: "RON",
        },
      },
      estimatedPrice: {
        amountMinor: pricingSnapshot.total.amountMinor,
        currency: "RON",
      },
      pricingSnapshot,
      estimatedEcoMetrics: {
        estimatedCo2SavedGrams: 0,
        estimatedRoadDistanceSavedKm: 0,
        estimatedEnergyUseKwh: 0,
      },
      estimatedEta: {
        minMinutes: estimatedWindow.min,
        maxMinutes: estimatedWindow.max,
      },
      coverageStatus: coverageSummary.state,
      coverageSummary,
      createdAt: new Date().toISOString(),
    };
  }

  async function discardParcelAiImages() {
    if (!deliverySessionId) return;

    try {
      await fetch(
        `/api/parcel-ai/images?draftId=${encodeURIComponent(deliverySessionId)}`,
        { method: "DELETE", keepalive: true },
      );
    } catch {
      // R2's lifecycle policy remains the final cleanup fallback.
    }
  }

  const mapMarkers = useMemo<readonly MapMarkerDefinition[]>(
    () => {
      const nextMarkers: MapMarkerDefinition[] = [];
      const addMeetingPointMarkers = (
        field: CreateDeliveryAddressField,
        points: readonly CandidatePoint[],
      ) => {
        const selectedPointId = selectedCandidatePoints[field]?.id ?? null;
        const fieldLabel = field === "pickup" ? "ridicare" : "livrare";

        points
          .filter((candidatePoint) => candidatePoint.eligibilityState !== "outside")
          .forEach((candidatePoint, index) => {
            const isSelected = selectedPointId === candidatePoint.id;
            const isPending =
              pendingCandidateConfirmation?.field === field &&
              pendingCandidateConfirmation.candidatePointId === candidatePoint.id;

            nextMarkers.push({
              id: `${field}-meeting-${candidatePoint.id}`,
              point: candidatePoint.point,
              label: isSelected
                ? candidatePoint.label
                : candidatePoint.label || `Punct ${fieldLabel} ${index + 1}`,
              description:
                candidatePoint.description ??
                `La ${candidatePoint.distanceFromOriginMeters} m față de adresa selectată`,
              kind: isSelected ? "meeting" : "alternative",
              tone: isSelected ? "meeting" : "alternative",
              selected: isSelected,
              active: isPending,
              emphasized: isSelected,
              variant: isSelected ? "recommended" : "candidate",
              confirmationOpen: isPending,
              confirmationTitle: candidatePoint.label || `Confirmă punctul de ${fieldLabel}`,
              confirmationDescription:
                candidatePoint.description ??
                `La ${candidatePoint.distanceFromOriginMeters} m față de adresa selectată.`,
              confirmationActionLabel: isSelected ? "Păstrează punctul" : "Confirmă aici",
              onClick: () =>
                setPendingCandidateConfirmation({
                  field,
                  candidatePointId: candidatePoint.id,
                }),
              onConfirm: () => handleCandidatePointSelect(field, candidatePoint.id),
            });
          });
      };

      if (pickupValidation.geocodedAddress) {
        nextMarkers.push({
          id: "selected-pickup-address",
          point: pickupValidation.geocodedAddress.location,
          label: "Ridicare",
          description:
            routeAddresses.pickup.address.trim() || "Ridicare",
          kind: "pickup",
          tone: getMarkerToneForAddress(pickupValidation.state, "pickup"),
          variant: "pickup",
          emphasized: true,
        });
      }

      addMeetingPointMarkers("pickup", candidatePoints.pickup);

      if (dropoffValidation.geocodedAddress) {
        nextMarkers.push({
          id: "selected-dropoff-address",
          point: dropoffValidation.geocodedAddress.location,
          label: "Livrare",
          description:
            routeAddresses.dropoff.address.trim() || "Livrare",
          kind: "dropoff",
          tone: getMarkerToneForAddress(dropoffValidation.state, "dropoff"),
          variant: "dropoff",
          emphasized: true,
        });
      }

      addMeetingPointMarkers("dropoff", candidatePoints.dropoff);

      if (pendingMapPoint && mapSelectionMode) {
        const isPickupSelection = mapSelectionMode === "pickup";

        nextMarkers.push({
          id: `pending-${mapSelectionMode}-address`,
          point: pendingMapPoint,
          label: isPickupSelection ? "Pin ridicare" : "Pin livrare",
          description: isPickupSelection
            ? "Locația exactă selectată pentru expeditor."
            : "Locația exactă selectată pentru destinatar.",
          kind: isPickupSelection ? "pickup" : "dropoff",
          tone: isPickupSelection ? "pickup" : "dropoff",
          variant: isPickupSelection ? "pickup" : "dropoff",
          active: true,
          confirmationOpen: true,
          confirmationTitle:
            mapSelectionFeedback?.title ??
            (isPickupSelection
              ? "Confirmă ridicarea pe hartă"
              : "Confirmă livrarea pe hartă"),
          confirmationDescription:
            mapSelectionFeedback?.description ??
            "Confirmă punctul exact selectat pe hartă.",
          confirmationActionLabel: isReverseGeocoding
            ? "Se verifică adresa"
            : isPickupSelection
              ? "Folosește această adresă de ridicare"
              : "Folosește această adresă de livrare",
          confirmationActionDisabled: isReverseGeocoding,
          onConfirm: handleConfirmMapSelection,
        });
      }

      return nextMarkers;
    },
    [
      candidatePoints.dropoff,
      candidatePoints.pickup,
      dropoffValidation.geocodedAddress,
      dropoffValidation.state,
      handleCandidatePointSelect,
      handleConfirmMapSelection,
      isReverseGeocoding,
      mapSelectionFeedback?.description,
      mapSelectionFeedback?.title,
      mapSelectionMode,
      pendingCandidateConfirmation,
      pendingMapPoint,
      pickupValidation.geocodedAddress,
      pickupValidation.state,
      routeAddresses.dropoff.address,
      routeAddresses.pickup.address,
      selectedCandidatePoints,
    ],
  );
  const mapViewport = useMemo(() => {
    if (pendingMapPoint) {
      return {
        center: pendingMapPoint,
        zoom: 17.2,
      };
    }

    return getMarkerDrivenViewport(mapMarkers);
  }, [mapMarkers, pendingMapPoint]);
  const routeMapLines = useMemo<readonly MapLineDefinition[]>(() => {
    const pickupPoint = pickupValidation.geocodedAddress?.location;
    const dropoffPoint = dropoffValidation.geocodedAddress?.location;
    const nextLines: MapLineDefinition[] = [];

    if (pickupPoint && dropoffPoint) {
      nextLines.push({
        id: "pickup-to-dropoff-route",
        data: toMapLineFeatureCollection([pickupPoint, dropoffPoint]),
        lineColor: "#20E7D5",
        lineOpacity: 0.82,
        lineWidth: 3.5,
      });
    }

    if (pickupPoint && selectedCandidatePoints.pickup) {
      nextLines.push({
        id: "pickup-address-to-meeting-point",
        data: toMapLineFeatureCollection([
          pickupPoint,
          selectedCandidatePoints.pickup.point,
        ]),
        lineColor: "#FFB340",
        lineOpacity: 0.5,
        lineWidth: 2,
        lineDasharray: [0.8, 1.4],
      });
    }

    if (dropoffPoint && selectedCandidatePoints.dropoff) {
      nextLines.push({
        id: "dropoff-address-to-meeting-point",
        data: toMapLineFeatureCollection([
          dropoffPoint,
          selectedCandidatePoints.dropoff.point,
        ]),
        lineColor: "#FFB340",
        lineOpacity: 0.5,
        lineWidth: 2,
        lineDasharray: [0.8, 1.4],
      });
    }

    return nextLines;
  }, [
    dropoffValidation.geocodedAddress?.location,
    pickupValidation.geocodedAddress?.location,
    selectedCandidatePoints.dropoff,
    selectedCandidatePoints.pickup,
  ]);
  const handleApplyAssistant = useCallback((
    input: ParcelAssistantInput,
    result: ParcelAssistantResult,
  ) => {
    setParcelDraft((currentValue) =>
      fromParcelAssistantInput(input, result, currentValue),
    );
  }, []);

  const visibleStepId = flowStep;
  const visibleStepIndex = flowSteps.findIndex((step) => step.id === visibleStepId);
  const stepper = (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {flowSteps.map((step, index) => {
        const isCurrent = step.id === visibleStepId;
        const isCompleted = index < visibleStepIndex;

        return (
          <div
            key={step.id}
            className={cn(
              "rounded-[calc(var(--radius)+0.25rem)] border p-3 transition-colors",
              isCurrent
                ? "border-primary/45 bg-primary/10 ring-4 ring-ring"
                : isCompleted
                  ? "border-primary/25 bg-secondary/65"
                  : "border-border/80 bg-secondary/35",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold",
                  isCurrent || isCompleted
                    ? "border-primary/40 bg-primary text-primary-foreground"
                    : "border-border/80 bg-card text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <p className="text-sm font-medium text-foreground">{step.label}</p>
            </div>
            <p className="mt-2 hidden text-xs leading-5 text-muted-foreground xl:block">
              {step.description}
            </p>
          </div>
        );
      })}
    </div>
  );
  const compactRouteStepper = (
    <div className="max-w-full rounded-full border border-transparent bg-transparent p-0 shadow-none backdrop-blur-none sm:border-border/70 sm:bg-background/82 sm:p-1.5 sm:shadow-[var(--elevation-soft)] sm:backdrop-blur-md">
      <div className="flex min-h-10 items-center gap-2.5 rounded-full bg-primary px-3.5 text-sm font-semibold leading-tight text-primary-foreground sm:hidden">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary-foreground/35 text-xs">
          {visibleStepIndex + 1}
        </span>
        <span className="truncate">
          Pas {visibleStepIndex + 1} din {flowSteps.length} · {flowSteps[visibleStepIndex]?.label ?? "Traseu"}
        </span>
      </div>
      <div className="hidden max-w-full gap-1.5 overflow-x-auto sm:flex sm:rounded-full">
        {flowSteps.map((step, index) => {
          const isCurrent = step.id === visibleStepId;
          const isCompleted = index < visibleStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "flex min-w-max items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-medium leading-tight transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isCompleted
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs",
                  isCurrent
                    ? "border-primary-foreground/35"
                    : isCompleted
                      ? "border-primary/35 text-primary"
                      : "border-border/80",
                )}
              >
                {index + 1}
              </span>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const routeActions = (
    <div className="sticky bottom-0 z-10 mt-3 grid gap-2 border-t border-border/70 bg-background px-3.5 pt-3 pb-[calc(0.85rem_+_env(safe-area-inset-bottom))] shadow-[0_-18px_34px_-26px_rgba(0,0,0,0.85)] sm:static sm:flex sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:bg-background sm:px-0 sm:pb-0 lg:mt-5 lg:px-6 lg:pb-6">
      <p className="order-1 text-center text-xs leading-5 text-muted-foreground compact-ui:block expanded-ui:hidden">
        {deliveryGateMessage ?? routeDisabledReason}
      </p>
      <AppButton
        type="button"
        size="lg"
        className="w-full sm:ml-auto sm:w-fit lg:min-w-36"
        disabled={!routeReady || Boolean(deliveryGateMessage)}
        onClick={handleStepContinue}
      >
        <span className="compact-ui:inline expanded-ui:hidden">
          {routeReady && !deliveryGateMessage ? "Analizează coletul" : "Alege punctele"}
        </span>
        <span className="compact-ui:hidden expanded-ui:inline">Continuă</span>
        <ArrowRight className="size-4" />
      </AppButton>
    </div>
  );

  const parcelActions = (
    <div className="fixed inset-x-0 bottom-[var(--bottom-nav-safe)] z-40 flex flex-row items-center gap-3 border-t border-white/10 bg-black/95 px-4 py-2 shadow-[0_-12px_24px_-22px_rgba(0,0,0,0.95)] sm:sticky sm:bottom-0 sm:z-20 sm:flex-row sm:items-center sm:justify-between sm:rounded-[calc(var(--radius)+0.5rem)] sm:border sm:border-border/80 sm:bg-background sm:px-5 sm:pb-4 sm:pt-4 sm:shadow-[0_-18px_34px_-26px_rgba(0,0,0,0.9)]">
      <AppButton
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 rounded-2xl bg-card px-5 sm:h-11 sm:w-fit"
        onClick={handleStepBack}
      >
        Înapoi
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        className="h-10 flex-[1.35] rounded-2xl px-6 shadow-[var(--elevation-soft)] sm:h-11 sm:w-fit sm:flex-none"
        disabled={!parcelReady}
        onClick={handleStepContinue}
      >
        Continuă
        <ArrowRight className="size-4" />
      </AppButton>
    </div>
  );

  const optionsActions = (
    <div className="fixed inset-x-0 bottom-[var(--bottom-nav-safe)] z-40 flex flex-row items-center gap-3 border-t border-white/10 bg-black/95 px-4 py-2 shadow-[0_-12px_24px_-22px_rgba(0,0,0,0.95)] sm:sticky sm:bottom-0 sm:z-20 sm:flex-row sm:items-center sm:justify-between sm:rounded-[calc(var(--radius)+0.5rem)] sm:border sm:border-border/80 sm:bg-background sm:px-5 sm:pb-4 sm:pt-4 sm:shadow-[0_-18px_34px_-26px_rgba(0,0,0,0.9)]">
      <AppButton
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0 rounded-2xl bg-card px-5 sm:h-11 sm:w-fit"
        onClick={handleStepBack}
      >
        Înapoi
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        className="h-10 flex-[1.35] rounded-2xl px-6 shadow-[var(--elevation-soft)] sm:h-11 sm:w-fit sm:flex-none"
        disabled={!canContinue}
        onClick={handleStepContinue}
      >
        Continuă
        <ArrowRight className="size-4" />
      </AppButton>
    </div>
  );

  if (flowStep === "review" && canContinue) {
    const checkoutPayload = buildCreateDeliveryPayload();
    if (!checkoutPayload) return null;

    const handleCheckoutPaid = (orderId: string) => {
      router.replace(`/client/orders/${orderId}?brief=1`);
      router.refresh();
      if (deliverySessionId) {
        void (async () => {
          try {
            await discardParcelAiImages();
            await fetch("/api/client/delivery-draft", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: deliverySessionId, action: "submit" }),
            });
          } catch (error) {
            console.error("[create-delivery] post-payment draft cleanup", error);
          }
        })();
      }
    };

    return (
      <section className="app-container flex h-dvh min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pb-[calc(var(--bottom-nav-safe)_+_1.5rem)] pt-0 sm:gap-6 sm:pb-10 sm:pt-[8.5rem] lg:pt-[9rem]">
        {isMobile ? (
          <div className="sticky top-0 z-30 pb-3 pl-[env(safe-area-inset-left)] pr-[calc(4rem_+_env(safe-area-inset-right))] pt-[calc(env(safe-area-inset-top)_+_0.5rem)]">
            {compactRouteStepper}
          </div>
        ) : null}

        {isMobile ? null : stepper}

        <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.22fr)_minmax(26rem,1fr)] xl:items-start">
          <div className="order-2 grid overflow-hidden rounded-[var(--ui-radius-panel)] border border-border/70 bg-card lg:grid-cols-2 xl:order-1">
            <Card className="rounded-none border-0 bg-transparent shadow-none lg:border-r lg:border-border/70">
              <CardContent className="grid gap-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid gap-2">
                    <p className="type-caption">Traseu</p>
                    <h2 className="font-heading text-2xl leading-tight tracking-tight text-foreground">
                      De la ridicare la livrare
                    </h2>
                  </div>
                </div>

                <div className="relative grid gap-0 before:absolute before:bottom-8 before:left-[0.45rem] before:top-8 before:w-px before:bg-primary/35">
                  {[
                    {
                      label: "Ridicare",
                      address: reviewSnapshot.pickupAddress,
                      point: reviewSnapshot.pickupPoint,
                      icon: MapPinned,
                    },
                    {
                      label: "Livrare",
                      address: reviewSnapshot.dropoffAddress,
                      point: reviewSnapshot.dropoffPoint,
                      icon: MoveRight,
                    },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="relative border-l-2 border-transparent py-5 pl-8 first:pt-2 last:pb-2"
                      >
                        <span className="absolute left-0 top-7 z-10 size-4 rounded-full border-4 border-card bg-primary first:top-4" />
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Icon className="size-4 text-foreground" />
                            <p className="font-medium text-foreground">{item.label}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 text-sm leading-6">
                          <div>
                            <p className="text-muted-foreground">Adresă</p>
                            <p className="font-medium text-foreground">{item.address}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Punct de întâlnire cu drona</p>
                            <p className="font-medium text-foreground">
                              {item.point
                                ? item.point.recommendationState === "recommended"
                                  ? "Punct recomandat"
                                  : reviewMeetingPointTypeLabels[item.point.type]
                                : "Niciun punct selectat"}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {item.point
                                ? `${reviewMeetingPointTypeLabels[item.point.type]} / ${item.point.description}`
                                : "Selectează un punct de întâlnire înainte de confirmare."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="grid divide-y divide-border/70">
              <Card className="rounded-none border-0 bg-transparent shadow-none">
                <CardContent className="grid gap-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Package2 className="size-4 text-foreground" />
                      <p className="font-medium text-foreground">Colet</p>
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm leading-6">
                    <div>
                      <p className="text-muted-foreground">Detalii</p>
                      <p className="font-medium text-foreground">
                        {reviewSnapshot.parcelSummary}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conținut</p>
                      <p className="text-foreground">{reviewSnapshot.parcelContent}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interval greutate estimat</p>
                      <p className="font-medium text-foreground">
                        {reviewSnapshot.estimatedWeightRange}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
                      <div><p className="text-muted-foreground">Dimensiuni</p><p className="font-medium text-foreground">{parcelDraft.lengthCm && parcelDraft.widthCm && parcelDraft.heightCm ? `${parcelDraft.lengthCm} × ${parcelDraft.widthCm} × ${parcelDraft.heightCm} cm` : parcelSizeLabels[parcelDraft.approximateSize]}</p></div>
                      <div><p className="text-muted-foreground">Ambalare</p><p className="font-medium text-foreground">{parcelPackagingLabels[parcelDraft.packaging]}</p></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-none border-0 bg-transparent shadow-none">
                <CardContent className="grid gap-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Zap className="size-4 text-foreground" />
                      <p className="font-medium text-foreground">Expediere</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Urgență</p>
                      <p className="mt-1 font-medium text-foreground">
                        {reviewSnapshot.urgencyLabel}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {reviewSnapshot.urgencyNote}
                      </p>
                    </div>
                    {reviewSnapshot.scheduledLabel ? (
                      <div>
                        <p className="text-sm text-muted-foreground">Programată pentru</p>
                        <p className="mt-1 font-medium text-foreground">
                          {reviewSnapshot.scheduledLabel}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Plata păstrează livrarea rezervată pentru intervalul selectat.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4 text-sm leading-6">
                    <div><p className="text-muted-foreground">Modul cargo</p><p className="font-medium text-foreground">{reviewSnapshot.deliveryModuleLabel}</p></div>
                    <div><p className="text-muted-foreground">ETA</p><p className="font-medium text-foreground">{reviewSnapshot.estimatedWindowLabel}</p></div>
                    <div><p className="text-muted-foreground">Fragilitate</p><p className="font-medium capitalize text-foreground">{parcelDraft.fragilityLevel}</p></div>
                    <div><p className="text-muted-foreground">Platformă</p><p className="font-medium text-foreground">{reviewSnapshot.deliveryPlatformLabel}</p></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <aside className="order-1 min-h-0 xl:order-2 xl:sticky xl:top-8 xl:h-[calc(100dvh_-_4rem)]">
            <Card className="h-full min-h-[34rem] overflow-hidden rounded-[calc(var(--radius)+0.75rem)]">
              <CreateDeliveryCheckoutPanel
                payload={checkoutPayload}
                pricing={pricingSnapshot}
                localOrderId={pendingPaymentOrderId}
                deliveryDraftId={deliverySessionId || null}
                onPaid={handleCheckoutPaid}
                onBackToEdit={handleEditDetails}
              />
            </Card>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={
          flowStep === "route"
            ? "h-dvh min-h-svh"
            : "app-container flex h-dvh min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pb-[calc(var(--bottom-nav-safe)_+_5.25rem)] pt-0 sm:gap-6 sm:pb-10 sm:pt-[8.5rem] lg:pt-[9rem]"
        }
      >
        {flowStep !== "route" ? (
          isMobile ? (
            <div className="sticky top-0 z-30 pb-3 pl-[env(safe-area-inset-left)] pr-[calc(4rem_+_env(safe-area-inset-right))] pt-[calc(env(safe-area-inset-top)_+_0.5rem)]">
              {compactRouteStepper}
            </div>
          ) : (
            stepper
          )
        ) : null}

        {flowStep !== "route" && deliveryGateMessage ? (
          <div className="rounded-[calc(var(--radius)+0.5rem)] border border-warning/35 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-4 text-warning" />
              <div className="grid gap-1">
                <p className="font-medium text-foreground">
                  Platforma nu accepta livrari noi
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {deliveryGateMessage}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {flowStep !== "route" && reviewGateMessage ? (
          <div className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/45 p-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-4 text-foreground" />
              <div className="grid gap-1">
                <p className="font-medium text-foreground">Verificarea nu este gata încă</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {reviewGateMessage}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {flowStep !== "route" && repeatPrefill ? (
          <div className="rounded-[calc(var(--radius)+0.5rem)] border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-4 text-foreground" />
              <div className="grid gap-1">
                <p className="font-medium text-foreground">Repetă livrarea</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Folosește traseul și detaliile coletului anterior. Prețul actualizat va fi
                  calculat înainte de plată.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className={flowStep === "route" ? "grid" : "grid gap-6"}>
          <div className={flowStep === "route" ? "grid" : "grid gap-6"}>
            {flowStep === "route" && isMobile ? (
              isHubAvailable ? (
                <CreateDeliveryMapStep
                  mapViewport={mapViewport}
                  mapMarkers={mapMarkers}
                  routeMapLines={routeMapLines}
                  serviceAreaOverlays={serviceAreaOverlays}
                  pickup={routeAddresses.pickup}
                  dropoff={routeAddresses.dropoff}
                  pickupValidation={pickupValidation}
                  dropoffValidation={dropoffValidation}
                  savedPlaces={savedPlaces}
                  isLocked={isRouteSelectionLocked}
                  routeReady={routeReady}
                  platformGateMessage={deliveryGateMessage}
                  onAddressChange={handleAddressChange}
                  onAddressSelect={handleAddressSelect}
                  onSavedPlaceSelect={handleSavedPlaceSelect}
                  onResolveAddressFromMapPoint={handleResolveAddressFromMapPoint}
                  onContinue={handleStepContinue}
                />
              ) : (
                <div className="relative h-dvh min-h-svh overflow-hidden bg-background">
                  <UnavailableCityMapState
                    cityLabel={selectedCity.label}
                    reason={deliveryGateMessage}
                    variant={selectedCity.id === "bucuresti" ? "coming-soon" : "maintenance"}
                  />
                </div>
              )
            ) : flowStep === "route" ? (
              <div className="relative isolate h-dvh min-h-svh overflow-hidden bg-[#081416]">
                {isHubAvailable ? (
                  <LazyMapContainer
                    className="map-surface--premium absolute inset-0 h-full min-h-full rounded-none border-0 shadow-none"
                    ariaLabel="Hartă traseu creare livrare"
                    center={mapViewport.center}
                    zoom={mapViewport.zoom}
                    interactive
                    showNavigation={false}
                    selectionMode={mapSelectionMode ?? "preview"}
                    markers={mapMarkers}
                    lines={routeMapLines}
                    onPointSelect={
                      mapSelectionMode && !isRouteSelectionLocked
                        ? handleMapPointPreview
                        : undefined
                    }
                    overlays={serviceAreaOverlays}
                  />
                ) : (
                  <UnavailableCityMapState
                    cityLabel={selectedCity.label}
                    reason={deliveryGateMessage}
                    variant={selectedCity.id === "bucuresti" ? "coming-soon" : "maintenance"}
                  />
                )}

                {isHubAvailable ? (
                  <>
                    <div className="pointer-events-none absolute left-3 right-3 top-[5.9rem] z-20 flex justify-start sm:left-4 sm:right-auto sm:top-[7.25rem] lg:left-8 lg:top-[6.75rem] xl:left-10">
                      <div className="pointer-events-auto max-w-full">
                        {compactRouteStepper}
                      </div>
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 pt-3 pb-[calc(0.85rem_+_env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 lg:left-8 lg:right-auto lg:bottom-auto lg:top-[10.75rem] lg:w-[min(31.5rem,calc(100%_-_4rem))] lg:p-0 xl:left-10 xl:w-[33.5rem] 2xl:w-[35rem]">
                      <div
                        className={cn(
                          "pointer-events-auto flex min-h-0 flex-col overflow-hidden rounded-t-[1.35rem] border border-border/80 bg-background/92 shadow-[var(--elevation-panel)] backdrop-blur-xl transition-[max-height,transform] duration-300 ease-out sm:rounded-[1.5rem] lg:max-h-[calc(100dvh_-_12.25rem)] lg:rounded-[1.5rem] lg:bg-background/88",
                          routeSheetState === "collapsed" &&
                            "max-h-[40svh] min-[390px]:max-h-[36svh]",
                          routeSheetState === "half" &&
                            "max-h-[68svh] sm:max-h-[62svh]",
                          routeSheetState === "expanded" &&
                            "max-h-[calc(100svh_-_6.75rem_-_env(safe-area-inset-bottom))] sm:max-h-[calc(100svh_-_8rem_-_env(safe-area-inset-bottom))]",
                        )}
                        data-route-sheet-state={routeSheetState}
                      >
                        <div className="grid shrink-0 gap-2 px-3.5 pt-2.5 pb-3 min-[360px]:px-4 sm:pt-3 lg:gap-3 lg:px-6 lg:pt-6 lg:pb-4">
                          <div className="flex justify-center sm:hidden">
                            <button
                              type="button"
                              aria-label="Extinde sau restrânge panoul traseului"
                              onClick={handleRouteSheetHandleClick}
                              onPointerDown={handleRouteSheetPointerDown}
                              onPointerMove={handleRouteSheetPointerMove}
                              onPointerUp={handleRouteSheetPointerUp}
                              className="touch-none rounded-full px-7 py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
                            >
                              <GripHorizontal className="size-5" />
                            </button>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="font-heading text-lg tracking-tight text-foreground sm:text-2xl lg:text-3xl">
                                Traseu livrare
                              </h2>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6 lg:text-base">
                                Caută sau fixează ambele puncte în zona activă a orașului.
                              </p>
                            </div>
                            <div className="hidden items-center gap-1 compact-ui:flex expanded-ui:hidden">
                              <button
                                type="button"
                                aria-label="Restrânge panoul traseului"
                                onClick={() => snapRouteSheet("down")}
                                className="grid size-9 place-items-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <ChevronDown className="size-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Extinde panoul traseului"
                                onClick={() => snapRouteSheet("up")}
                                className="grid size-9 place-items-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <ChevronUp className="size-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 compact-ui:flex expanded-ui:hidden">
                            <StatusBadge
                              label={
                                routeSheetState === "collapsed"
                                  ? "Pliat"
                                  : routeSheetState === "half"
                                    ? "Jumătate"
                                    : "Extins"
                              }
                              tone="neutral"
                              className="sm:hidden"
                            />
                            <StatusBadge
                              label={routeReady ? "Puncte selectate" : "Selectează punctele"}
                              tone={routeReady ? "success" : "warning"}
                            />
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-2 [scrollbar-gutter:stable] min-[360px]:px-4 lg:px-6 lg:pb-6">
                          <CreateDeliveryAddressSection
                            pickup={routeAddresses.pickup}
                            dropoff={routeAddresses.dropoff}
                            pickupValidation={pickupValidation}
                            dropoffValidation={dropoffValidation}
                            pickupCandidatePoints={candidatePoints.pickup}
                            dropoffCandidatePoints={candidatePoints.dropoff}
                            isPlanningPickupHandoffPoints={isPlanningHandoffPoints.pickup}
                            isPlanningDropoffHandoffPoints={isPlanningHandoffPoints.dropoff}
                            isPickupLocked={isRouteSelectionLocked}
                            isDropoffLocked={isRouteSelectionLocked}
                            pickupLockMessage={routeSelectionLockMessage}
                            dropoffLockMessage={routeSelectionLockMessage}
                            selectedPickupCandidatePointId={selectedCandidatePoints.pickup?.id ?? null}
                            selectedDropoffCandidatePointId={
                              selectedCandidatePoints.dropoff?.id ?? null
                            }
                            activeMapSelectionMode={mapSelectionMode}
                            savedPlaces={savedPlaces}
                            onAddressChange={handleAddressChange}
                            onAddressSelect={handleAddressSelect}
                            onSavedPlaceSelect={handleSavedPlaceSelect}
                            onNotesChange={handleNotesChange}
                            onMapSelect={handleAddressMapSelect}
                            onCandidatePointSelect={handleCandidatePointSelect}
                          />
                        </div>

                        {routeActions}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {flowStep === "parcel" ? (
              <>
                {deliverySessionId ? (
                  <CreateDeliveryParcelSection
                    sessionId={deliverySessionId}
                    parcel={parcelDraft}
                    guidance={parcelGuidance}
                    onChange={handleParcelChange}
                    onAssistantUpdate={handleApplyAssistant}
                  />
                ) : (
                  <div className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Se încarcă schița livrării…
                  </div>
                )}
                {parcelActions}
              </>
            ) : null}

            {flowStep === "options" ? (
              <div className="grid gap-5">
                <SectionCard
                  size="sm"
                  eyebrow="Dispatch"
                  title="Când ar trebui să plece drona?"
                  description="Alege mai întâi intervalul. Prețul și verificarea se actualizează din această selecție."
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    {urgencyOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setUrgency(option.value)}
                        aria-pressed={urgency === option.value}
                        className={cn(
                          "min-h-20 rounded-[calc(var(--radius)+0.5rem)] border px-4 py-3 text-left transition-[border-color,background-color,box-shadow] focus-visible:ring-4 focus-visible:ring-ring",
                          urgency === option.value
                            ? "border-primary/55 bg-primary/10 shadow-[var(--elevation-card)] ring-4 ring-ring"
                            : "border-border/80 bg-secondary/35 hover:border-primary/30 hover:bg-secondary/55",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-foreground">{option.label}</p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {option.note}
                        </p>
                      </button>
                    ))}
                  </div>

                  {urgency === "scheduled" ? (
                    <div className="mt-4 grid gap-3 rounded-[calc(var(--radius)+0.5rem)] border border-primary/20 bg-background/95 p-3 shadow-[var(--elevation-card)] md:grid-cols-[minmax(0,0.95fr)_minmax(220px,0.65fr)]">
                      <div className="grid gap-2 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Data livrarii
                            </p>
                            <p className="mt-1 text-sm font-semibold capitalize text-foreground">
                              {getScheduleMonthLabel(scheduleCalendarMonth)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setScheduleCalendarMonth((current) =>
                                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
                                )
                              }
                              className="grid size-9 place-items-center rounded-full border border-border/80 bg-secondary/45 text-muted-foreground transition hover:border-primary/35 hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
                              aria-label="Luna anterioara"
                            >
                              <ArrowLeft className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setScheduleCalendarMonth((current) =>
                                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
                                )
                              }
                              className="grid size-9 place-items-center rounded-full border border-border/80 bg-secondary/45 text-muted-foreground transition hover:border-primary/35 hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
                              aria-label="Luna urmatoare"
                            >
                              <ArrowRight className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {scheduleWeekdayLabels.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {scheduleCalendarDays.map((day) => {
                            const dayValue = toDateInputValue(day);
                            const isCurrentMonth =
                              day.getMonth() === scheduleCalendarMonth.getMonth();
                            const isSelected =
                              selectedScheduledDate !== null &&
                              isSameCalendarDay(day, selectedScheduledDate);
                            const isDisabled = !isDateInputInRange(
                              day,
                              scheduledBounds.min,
                              scheduledBounds.max,
                            );

                            return (
                              <button
                                key={dayValue}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setScheduledDate(dayValue)}
                                aria-pressed={isSelected}
                                className={cn(
                                  "h-9 rounded-xl border text-sm font-semibold transition focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30 sm:h-10",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]"
                                    : "border-transparent bg-secondary/35 text-foreground hover:border-primary/35 hover:bg-primary/10",
                                  !isCurrentMonth && "text-muted-foreground/60",
                                )}
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid content-start gap-3 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card/70 p-3">
                        <div className="flex items-start gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <Clock3 className="size-4" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Ora livrarii
                            </p>
                            <p className="mt-1 text-2xl font-semibold text-foreground">
                              {scheduledTime || "--:--"}
                            </p>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/80 bg-background/60 p-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-2">
                              <span className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Ora
                              </span>
                              <div className="max-h-44 snap-y overflow-y-auto pr-1">
                                <div className="grid gap-1.5 py-1">
                                  {scheduleHourOptions.map((hour) => {
                                    const selectedMinute =
                                      scheduledTime.split(":")[1] ?? "00";
                                    const isSelected =
                                      scheduledTime.startsWith(`${hour}:`);

                                    return (
                                      <button
                                        key={hour}
                                        type="button"
                                        onClick={() =>
                                          setScheduledTime(`${hour}:${selectedMinute}`)
                                        }
                                        aria-pressed={isSelected}
                                        className={cn(
                                          "h-10 snap-center rounded-xl border text-base font-semibold transition focus-visible:ring-4 focus-visible:ring-ring",
                                          isSelected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-foreground",
                                        )}
                                      >
                                        {hour}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <span className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Min
                              </span>
                              <div className="max-h-44 snap-y overflow-y-auto pr-1">
                                <div className="grid gap-1.5 py-1">
                                  {scheduleMinuteOptions.map((minute) => {
                                    const selectedHour =
                                      scheduledTime.split(":")[0] ?? "10";
                                    const isSelected =
                                      scheduledTime.endsWith(`:${minute}`);

                                    return (
                                      <button
                                        key={minute}
                                        type="button"
                                        onClick={() =>
                                          setScheduledTime(`${selectedHour}:${minute}`)
                                        }
                                        aria-pressed={isSelected}
                                        className={cn(
                                          "h-10 snap-center rounded-xl border text-base font-semibold transition focus-visible:ring-4 focus-visible:ring-ring",
                                          isSelected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-foreground",
                                        )}
                                      >
                                        {minute}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground md:col-span-2">
                        {scheduledValidation.message}
                      </div>
                    </div>
                  ) : null}
                </SectionCard>

                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {selectedDeliveryConfiguration && confirmedParcelProfile ? (
                      <div>
                        <div className="px-4 py-4 sm:px-5 sm:py-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                            Modul selectat
                          </p>
                          <h3 className="mt-1.5 font-heading text-2xl tracking-tight text-foreground sm:text-3xl">
                            {selectedDeliveryConfiguration.moduleName}
                          </h3>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {configurationSelectionReason}
                          </p>
                        </div>

                        <div className="grid border-t border-border/70 lg:grid-cols-3">
                          <div className="px-4 py-4 sm:px-5 lg:border-r lg:border-border/70">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Capacitate
                            </p>
                            <dl className="mt-3 grid gap-2 text-sm">
                              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Sarcină</dt><dd className="text-right font-medium text-foreground">{confirmedPayloadKg.toFixed(1)} / {selectedDeliveryConfiguration.maxPayloadKg} kg</dd></div>
                              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Volum</dt><dd className="text-right font-medium text-foreground">{formatVolumeLiters(confirmedVolumeLiters)} / {selectedDeliveryConfiguration.maxVolumeLiters} L</dd></div>
                              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Dimensiuni</dt><dd className="max-w-[65%] text-right font-medium text-foreground">{confirmedDimensions ? `${formatDimensionsCm(confirmedDimensions)} / ${formatDimensionsCm(selectedDeliveryConfiguration.maxDimensionsCm)}` : formatDimensionsCm(selectedDeliveryConfiguration.maxDimensionsCm)}</dd></div>
                            </dl>
                          </div>

                          <div className="border-t border-border/70 px-4 py-4 sm:px-5 lg:border-r lg:border-t-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Protecție
                            </p>
                            <dl className="mt-3 grid gap-2 text-sm">
                              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Temperatură</dt><dd className="text-right font-medium text-foreground">{temperatureProtectionLabels[selectedDeliveryConfiguration.temperatureProtection]}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Securitate</dt><dd className="text-right font-medium text-foreground">{securityLevelLabels[selectedDeliveryConfiguration.securityLevel]}</dd></div>
                              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Șoc</dt><dd className="text-right font-medium text-foreground">{shockProtectionLabels[selectedDeliveryConfiguration.shockProtection]} / {confirmedParcelProfile.fragility}</dd></div>
                            </dl>
                          </div>

                          <div className="border-t border-border/70 px-4 py-4 sm:px-5 lg:border-t-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Livrare
                            </p>
                            <dl className="mt-3 grid gap-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Impact preț</dt>
                                <dd className="font-medium text-foreground">
                                  {formatCurrencyMinor(deliveryConfigurationPriceImpactMinor)}
                                </dd>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">ETA</dt>
                                <dd className="font-medium text-foreground">
                                  {estimatedWindow.min} - {estimatedWindow.max} min
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-4 text-sm leading-6 text-muted-foreground sm:px-5">
                        {configurationSelectionReason}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {optionsActions}
              </div>
            ) : null}
          </div>
        </div>
      </section>

    </>
  );
}

function UnavailableCityMapState({
  cityLabel,
  reason,
  variant,
}: {
  cityLabel: string;
  reason?: string | null;
  variant: "coming-soon" | "maintenance";
}) {
  const isMaintenance = variant === "maintenance";

  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.16),transparent_34%),linear-gradient(135deg,rgba(4,10,15,0.97),rgba(8,14,20,0.99))] px-4">
      <div className="pointer-events-auto w-full max-w-xl rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-background/92 p-6 text-center shadow-[var(--elevation-panel)] sm:p-8">
        <span
          className={cn(
            "mx-auto flex size-16 items-center justify-center rounded-full border text-primary",
            isMaintenance
              ? "border-warning/30 bg-warning/10 text-warning"
              : "border-primary/30 bg-primary/10",
          )}
        >
          {isMaintenance ? (
            <CircleAlert className="size-7" />
          ) : (
            <MapPinOff className="size-7" />
          )}
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {isMaintenance ? "Mentenanță" : "Coming soon"}
        </p>
        <h2 className="mt-2 font-heading text-3xl tracking-tight text-foreground">
          {isMaintenance
            ? "Lucrăm la revenirea aplicației"
            : `${cityLabel} este aproape gata`}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {reason ??
            "Ne extindem aria de acoperire și vom activa livrările în acest oraș în curând."}
        </p>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Comenzile sunt oprite temporar
        </p>
      </div>
    </div>
  );
}
