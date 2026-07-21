import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { Mission, MissionStatus } from "@/types/mission";

const recipientTokenPrefix = "rpt_";
const defaultTokenLifetimeDays = 14;
const publicTrackingCodePrefix = "SKY";
const publicTrackingCityCode = "PIT";
const publicTrackingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createExpiry(days = defaultTokenLifetimeDays) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  return expiresAt.toISOString();
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createRandomBytes(length: number) {
  const bytes = new Uint8Array(length);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

export function generateRecipientTrackingToken() {
  return `${recipientTokenPrefix}${toBase64Url(createRandomBytes(24))}`;
}

export function generatePublicTrackingCode() {
  const digits = Array.from(createRandomBytes(5), (byte) => byte % 10).join("");
  const suffix = Array.from(
    createRandomBytes(3),
    (byte) => publicTrackingAlphabet[byte % publicTrackingAlphabet.length],
  ).join("");

  return `${publicTrackingCodePrefix}-${publicTrackingCityCode}-${digits}-${suffix}`;
}

export function normalizePublicTrackingCode(code: string) {
  const normalized = safeDecodeURIComponent(code)
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, "")
    .replaceAll(/[^A-Z0-9-]/g, "");

  if (normalized.startsWith(`${publicTrackingCodePrefix}-`)) {
    return normalized;
  }

  const compact = normalized.replaceAll("-", "");

  if (!compact) {
    return "";
  }

  const withoutPrefix = compact.startsWith(publicTrackingCodePrefix)
    ? compact.slice(publicTrackingCodePrefix.length)
    : compact;

  if (withoutPrefix.startsWith(publicTrackingCityCode)) {
    const withoutCity = withoutPrefix.slice(publicTrackingCityCode.length);
    const primary = withoutCity.slice(0, 5);
    const suffix = withoutCity.slice(5);

    return [
      publicTrackingCodePrefix,
      publicTrackingCityCode,
      primary,
      suffix,
    ]
      .filter(Boolean)
      .join("-");
  }

  const groups = withoutPrefix.match(/.{1,4}/g) ?? [withoutPrefix];

  return `${publicTrackingCodePrefix}-${groups.join("-")}`;
}

export function normalizeTrackingIdentifier(value: string) {
  const normalized = safeDecodeURIComponent(value)
    .trim()
    .toUpperCase()
    .replaceAll(/\s+/g, "")
    .replaceAll(/[^A-Z0-9_-]/g, "");

  if (normalized.startsWith("SKY-PT-")) {
    return normalized;
  }

  return normalizePublicTrackingCode(normalized);
}

export function isRecipientTrackingTokenExpired(
  expiresAt?: string | null,
  now = new Date(),
) {
  if (!expiresAt) {
    return false;
  }

  const expiry = new Date(expiresAt);

  if (Number.isNaN(expiry.getTime())) {
    return true;
  }

  return expiry <= now;
}

export function ensureRecipientTrackingToken(
  order: CreatedDeliveryOrder,
): CreatedDeliveryOrder {
  const hasValidRecipientToken =
    order.recipientTrackingToken &&
    !isRecipientTrackingTokenExpired(order.recipientTrackingTokenExpiresAt);
  const hasPublicTrackingCode = Boolean(order.publicTrackingCode);

  if (hasValidRecipientToken && hasPublicTrackingCode) {
    return order;
  }

  return {
    ...order,
    publicTrackingCode: order.publicTrackingCode ?? generatePublicTrackingCode(),
    recipientTrackingToken: hasValidRecipientToken
      ? order.recipientTrackingToken
      : generateRecipientTrackingToken(),
    recipientTrackingTokenExpiresAt: hasValidRecipientToken
      ? order.recipientTrackingTokenExpiresAt
      : createExpiry(),
  };
}

export function getRecipientTrackingPath({
  code,
  token,
}: {
  code?: string | null;
  token?: string | null;
}) {
  if (code) {
    return `/tracking/${encodeURIComponent(normalizePublicTrackingCode(code))}`;
  }

  if (!token) {
    return "/tracking";
  }

  return `/track/${encodeURIComponent(token)}`;
}

export function doesPublicTrackingCodeMatchOrder({
  code,
  order,
}: {
  code: string;
  order: CreatedDeliveryOrder;
}) {
  return (
    Boolean(order.publicTrackingCode) &&
    normalizePublicTrackingCode(code) ===
      normalizePublicTrackingCode(order.publicTrackingCode ?? "")
  );
}

export function doesRecipientTokenMatchOrder({
  token,
  order,
}: {
  token: string;
  order: CreatedDeliveryOrder;
}) {
  const decodedToken = safeDecodeURIComponent(token);

  return (
    Boolean(order.recipientTrackingToken) &&
    decodedToken === order.recipientTrackingToken &&
    !isRecipientTrackingTokenExpired(order.recipientTrackingTokenExpiresAt)
  );
}

export function doesRecipientTokenMatchMission({
  token,
  mission,
  order,
}: {
  token: string;
  mission: Mission;
  order?: CreatedDeliveryOrder | null;
}) {
  if (order) {
    return (
      mission.sourceOrderId === order.id &&
      doesRecipientTokenMatchOrder({ token, order })
    );
  }

  return false;
}

export function doesPublicTrackingCodeMatchMission({
  code,
  mission,
  order,
}: {
  code: string;
  mission: Mission;
  order?: CreatedDeliveryOrder | null;
}) {
  if (order) {
    return (
      mission.sourceOrderId === order.id &&
      doesPublicTrackingCodeMatchOrder({ code, order })
    );
  }

  return false;
}

export function getPublicRecipientStatusLabel(status: MissionStatus | null) {
  switch (status) {
    case "mission_created":
    case "preflight_checks":
    case "drone_dispatched":
      return "Drona se pregătește";
    case "en_route_to_pickup":
    case "arrived_at_pickup":
    case "awaiting_sender_position_confirmation":
    case "pickup_safety_check":
    case "locker_descending_pickup":
    case "awaiting_pickup_pin":
    case "awaiting_parcel_load":
    case "locker_ascending_pickup":
    case "payload_verification":
      return "Drona merge la ridicare";
    case "parcel_secured":
      return "Colet securizat";
    case "en_route_to_dropoff":
      return "Drona zboară spre destinatar";
    case "arrived_at_dropoff":
    case "dropoff_safety_check":
    case "locker_descending_dropoff":
    case "awaiting_recipient_pin":
    case "locker_ascending_dropoff":
      return "Ajunge la punctul de predare";
    case "awaiting_recipient_position_confirmation":
    case "awaiting_parcel_collection":
      return "Așteaptă destinatarul";
    case "delivery_completed":
    case "proof_generated":
    case "mission_closed":
      return "Livrat";
    case "mission_failed":
    case "fallback_required":
    case "returning_to_hub":
    case "returned_to_hub":
      return "Livrarea are nevoie de atenție";
    default:
      return "Drona se pregătește";
  }
}
