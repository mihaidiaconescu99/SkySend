import type { CreatedDeliveryOrder, CreateDeliveryAddressPayload, CreateDeliverySelectedPointPayload } from "@/types/create-delivery";
import type { SavedPlace, SavedPlaceCategory, SavedPlaceInput, SavedPlaceMeetingPoint } from "@/types/saved-places";

const savedPlacesStorageKey = "skysend:saved-places";
const recentPlacesStorageKey = "skysend:recent-places";
const savedPlacesChangedEvent = "skysend:saved-places-changed";
const recentPlaceLimit = 8;

function createPlaceId(prefix: string) {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${prefix}_${Date.now().toString(36)}_${entropy}`;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function readPlaces(key: string): SavedPlace[] {
  if (!canUseStorage()) {
    return [];
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return [];
  }

  try {
    const places = JSON.parse(rawValue) as SavedPlace[];

    return Array.isArray(places) ? places : [];
  } catch {
    return [];
  }
}

function writePlaces(key: string, places: SavedPlace[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(places));
  window.dispatchEvent(new Event(savedPlacesChangedEvent));
}

export function subscribeSavedPlaces(onStoreChange: () => void) {
  if (!canUseStorage()) {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(savedPlacesChangedEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(savedPlacesChangedEvent, onStoreChange);
  };
}

export function readSavedPlaces() {
  return readPlaces(savedPlacesStorageKey).sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function readRecentPlaces() {
  return readPlaces(recentPlacesStorageKey).sort(
    (left, right) =>
      Date.parse(right.lastUsedAt ?? right.updatedAt) -
      Date.parse(left.lastUsedAt ?? left.updatedAt),
  );
}

export function savePlace(input: SavedPlaceInput, existingId?: string) {
  const now = new Date().toISOString();
  const currentPlaces = readSavedPlaces();
  const normalizedInput = {
    label: input.label.trim(),
    address: input.address.trim(),
    notes: input.notes?.trim() ?? "",
    category: input.category ?? "custom",
  } satisfies {
    label: string;
    address: string;
    notes: string;
    category: SavedPlaceCategory;
  };

  if (!normalizedInput.label || !normalizedInput.address) {
    return null;
  }

  const nextPlace: SavedPlace = {
    id: existingId ?? createPlaceId("place"),
    label: normalizedInput.label,
    address: normalizedInput.address,
    coordinates: input.coordinates,
    notes: normalizedInput.notes,
    category: normalizedInput.category,
    preferredMeetingPoint: input.preferredMeetingPoint ?? null,
    createdAt:
      currentPlaces.find((place) => place.id === existingId)?.createdAt ?? now,
    updatedAt: now,
    lastUsedAt: now,
  };
  const nextPlaces = [
    nextPlace,
    ...currentPlaces.filter((place) => place.id !== nextPlace.id),
  ];

  writePlaces(savedPlacesStorageKey, nextPlaces);

  return nextPlace;
}

export function deleteSavedPlace(placeId: string) {
  writePlaces(
    savedPlacesStorageKey,
    readSavedPlaces().filter((place) => place.id !== placeId),
  );
}

function meetingPointFromOrderPoint(
  point: CreateDeliverySelectedPointPayload,
): SavedPlaceMeetingPoint {
  return {
    id: point.id,
    label: point.label,
    type: point.type,
    description: point.description,
    coordinates: point.location,
  };
}

function recentPlaceFromOrderAddress({
  address,
  point,
  category,
}: {
  address: CreateDeliveryAddressPayload;
  point: CreateDeliverySelectedPointPayload;
  category: SavedPlaceCategory;
}): SavedPlace {
  const now = new Date().toISOString();

  return {
    id: createPlaceId("recent"),
    label: point.label || address.formattedAddress,
    address: address.formattedAddress,
    coordinates: address.location,
    notes: address.notes ?? "",
    category,
    preferredMeetingPoint: meetingPointFromOrderPoint(point),
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  };
}

function dedupePlaces(places: SavedPlace[]) {
  const seen = new Set<string>();
  const result: SavedPlace[] = [];

  places.forEach((place) => {
    const key = `${place.address.toLowerCase()}::${place.coordinates.latitude.toFixed(5)}::${place.coordinates.longitude.toFixed(5)}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(place);
  });

  return result;
}

export function storeRecentPlacesFromOrder(order: CreatedDeliveryOrder) {
  const pickup = recentPlaceFromOrderAddress({
    address: order.payload.pickupAddress,
    point: order.payload.selectedPickupPoint,
    category: "recent",
  });
  const dropoff = recentPlaceFromOrderAddress({
    address: order.payload.dropoffAddress,
    point: order.payload.selectedDropoffPoint,
    category: "recent",
  });
  const nextPlaces = dedupePlaces([
    pickup,
    dropoff,
    ...readRecentPlaces(),
  ]).slice(0, recentPlaceLimit);

  writePlaces(recentPlacesStorageKey, nextPlaces);
}

export function clearRecentPlaces() {
  writePlaces(recentPlacesStorageKey, []);
}
