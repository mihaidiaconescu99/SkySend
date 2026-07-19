import type {
  MissionId,
  MissionParticipantId,
  MissionPin,
  MissionPinId,
  MissionPinPurpose,
} from "@/types/mission";

const missionPinLength = 4;
const defaultPinExpiryMinutes = 20;
const maxPinAttempts = 3;

export type GenerateMissionPinInput = {
  missionId: MissionId;
  participantId: MissionParticipantId;
  purpose: MissionPinPurpose;
  issuedAt?: string;
  expiresAt?: string | null;
  code?: string;
};

export type GenerateMissionPinsInput = {
  missionId: MissionId;
  senderParticipantId: MissionParticipantId;
  recipientParticipantId: MissionParticipantId;
  issuedAt?: string;
};

export type ValidateMissionPinResult = {
  valid: boolean;
  message: string;
  pin: MissionPin;
};

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function addMinutes(timestamp: string, minutes: number) {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString();
}

function createMissionPinId(
  missionId: MissionId,
  purpose: MissionPinPurpose,
): MissionPinId {
  const entropy =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `pin_${missionId}_${purpose}_${entropy}`;
}

function normalizePin(value: string) {
  return value.replace(/\D/g, "").slice(0, missionPinLength);
}

function createPinCode() {
  const value = Math.floor(Math.random() * 10_000);

  return value.toString().padStart(missionPinLength, "0");
}

function isExpired(pin: MissionPin, now: string) {
  return Boolean(pin.expiresAt && Date.parse(pin.expiresAt) <= Date.parse(now));
}

export function generateMissionPin({
  missionId,
  participantId,
  purpose,
  issuedAt = getCurrentTimestamp(),
  expiresAt = addMinutes(issuedAt, defaultPinExpiryMinutes),
  code,
}: GenerateMissionPinInput): MissionPin {
  return {
    id: createMissionPinId(missionId, purpose),
    missionId,
    purpose,
    participantId,
    code: normalizePin(code ?? createPinCode()).padStart(missionPinLength, "0"),
    status: "issued",
    issuedAt,
    expiresAt,
    verifiedAt: null,
    attempts: 0,
  };
}

export function generateMissionPins({
  missionId,
  senderParticipantId,
  recipientParticipantId,
  issuedAt = getCurrentTimestamp(),
}: GenerateMissionPinsInput): MissionPin[] {
  return [
    generateMissionPin({
      missionId,
      participantId: senderParticipantId,
      purpose: "pickup_verification",
      issuedAt,
    }),
    generateMissionPin({
      missionId,
      participantId: recipientParticipantId,
      purpose: "dropoff_verification",
      issuedAt,
    }),
  ];
}

export function validateMissionPin(
  pin: MissionPin,
  submittedCode: string,
  timestamp = getCurrentTimestamp(),
): ValidateMissionPinResult {
  if (pin.status === "verified") {
    return {
      valid: true,
      message: "PIN already verified.",
      pin,
    };
  }

  if (pin.status === "expired" || isExpired(pin, timestamp)) {
    return {
      valid: false,
      message: "PIN has expired.",
      pin: {
        ...pin,
        status: "expired",
      },
    };
  }

  if (pin.status === "failed" || pin.attempts >= maxPinAttempts) {
    return {
      valid: false,
      message: "PIN verification is locked after too many attempts.",
      pin: {
        ...pin,
        status: "failed",
      },
    };
  }

  const nextAttempts = pin.attempts + 1;
  const isMatch = normalizePin(submittedCode) === pin.code;

  if (!isMatch) {
    const nextStatus = nextAttempts >= maxPinAttempts ? "failed" : pin.status;

    return {
      valid: false,
      message:
        nextStatus === "failed"
          ? "PIN verification failed after too many attempts."
          : "PIN is incorrect.",
      pin: {
        ...pin,
        status: nextStatus,
        attempts: nextAttempts,
      },
    };
  }

  return {
    valid: true,
    message: "PIN verified.",
    pin: {
      ...pin,
      status: "verified",
      verifiedAt: timestamp,
      attempts: nextAttempts,
    },
  };
}

export function maskMissionPin(pin: string) {
  const normalizedPin = normalizePin(pin).padStart(missionPinLength, "0");

  return `${normalizedPin.slice(0, 1)}${"*".repeat(
    missionPinLength - 2,
  )}${normalizedPin.slice(-1)}`;
}

