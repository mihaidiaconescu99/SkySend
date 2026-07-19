"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock3,
  Crosshair,
  Gauge,
  Loader2,
  PackageCheck,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { droneClassLabels } from "@/constants/domain";
import {
  lockerStateLabels,
  missionActionLabels,
  missionStatusDescriptions,
  missionStatusLabels,
} from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { getNextMissionStatus } from "@/lib/mission-state-machine";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { DroneClass } from "@/types/domain";
import type { MissionAction, MissionStatus } from "@/types/mission";

type MissionActionPanelProps = {
  orderId: string;
  parcel: CreatedDeliveryOrder["payload"]["parcel"];
  droneClass: CreatedDeliveryOrder["payload"]["recommendedDroneClass"];
};

type WeightRange = {
  min: number;
  max: number;
  label: string;
};

const safetyCheckStatuses: MissionStatus[] = [
  "pickup_safety_check",
  "dropoff_safety_check",
];

const safetyChecklistItems = [
  "Poziție hover stabilă",
  "Blocaj cablu verificat",
  "Zona de coborâre este liberă",
  "Vânt în limite acceptate",
  "Coborâre locker autorizată",
] as const;

const dronePayloadLimitsKg: Record<DroneClass, number> = {
  light_swift: 1.2,
  light_secure: 1.6,
  medium_standard: 3,
  medium_stabilized: 2.8,
  medium_long_range: 2.5,
  heavy_cargo: 8,
  heavy_max: 12,
  light_express: 1.2,
  standard_courier: 3,
  fragile_care: 2.8,
  long_range: 2.5,
};

function getActionDescription(action: MissionAction | null) {
  switch (action) {
    case "confirm_sender_position":
      return "Confirmă doar când vezi drona deasupra punctului de ridicare.";
    case "verify_pickup_pin":
      return "Lockerul este pregătit. Folosește PIN-ul pe tastatura lockerului.";
    case "confirm_parcel_loaded":
      return "Confirmă după ce coletul este încărcat în locker.";
    case "confirm_recipient_position":
      return "Confirmă doar când vezi drona deasupra punctului de livrare.";
    case "verify_recipient_pin":
      return "Lockerul este pregătit. Folosește PIN-ul pe tastatura lockerului.";
    case "confirm_parcel_collected":
      return "Confirmă după ce coletul este ridicat din locker.";
    case "trigger_fallback":
      return "Suportul SkySend este necesar înainte ca livrarea să continue.";
    default:
      return "Livrarea avansează prin etapa curentă.";
  }
}

function getButtonLabel(action: MissionAction | null) {
  switch (action) {
    case "confirm_sender_position":
    case "confirm_recipient_position":
      return "Confirmă că vezi drona";
    case "verify_pickup_pin":
      return "Colet încărcat";
    case "verify_recipient_pin":
      return "Colet ridicat";
    case "confirm_parcel_loaded":
      return "Colet încărcat";
    case "confirm_parcel_collected":
      return "Colet ridicat";
    default:
      return "Nu este necesară nicio acțiune";
  }
}

function getActionIcon(action: MissionAction | null) {
  switch (action) {
    case "verify_pickup_pin":
    case "verify_recipient_pin":
    case "confirm_parcel_loaded":
    case "confirm_parcel_collected":
      return <PackageCheck className="size-4" />;
    case "confirm_sender_position":
    case "confirm_recipient_position":
      return <Crosshair className="size-4" />;
    default:
      return <ShieldCheck className="size-4" />;
  }
}

function getRuntimeButtonLabel(
  action: MissionAction | null,
  status: MissionStatus | null,
) {
  if (status === "awaiting_pickup_pin") {
    return "Confirma PIN ridicare";
  }

  if (status === "awaiting_recipient_pin") {
    return "Confirma PIN livrare";
  }

  if (status === "awaiting_parcel_load") {
    return "Colet incarcat";
  }

  if (status === "awaiting_parcel_collection") {
    return "Colet ridicat";
  }

  return getButtonLabel(action);
}

function formatOperationalTimerSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function getOperationalTimerCopy(kind: string, timeoutMs: number) {
  const timeoutMinutes = Math.max(1, Math.round(timeoutMs / 60_000));
  const timeoutLabel =
    timeoutMinutes === 1 ? "1 minut" : `${timeoutMinutes} minute`;

  if (kind === "parcel_load") {
    return {
      title: "Timer incarcare colet",
      description:
        `Ai ${timeoutLabel} sa incarci coletul. Timpul consumat se adauga la ETA livrare dupa confirmare.`,
    };
  }

  if (kind === "parcel_collection") {
    return {
      title: "Timer ridicare colet",
      description:
        `Ai ${timeoutLabel} sa ridici coletul. Acest timer nu modifica ETA livrare.`,
    };
  }

  return null;
}

function parseWeightRange(range: string | null | undefined): WeightRange {
  if (!range) {
    return { min: 0.8, max: 2.2, label: "0.8 - 2.2 kg" };
  }

  const values = range
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((value) => Number.isFinite(value));

  if (!values?.length) {
    return { min: 0.8, max: 2.2, label: range };
  }

  const min = values[0];
  const max = values[1] ?? values[0];

  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
    label: range,
  };
}

function getStableMeasuredWeightKg(range: WeightRange, seed: string) {
  const midpoint = (range.min + range.max) / 2;
  const spread = Math.max(0.2, range.max - range.min);
  const hash = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const offset = ((hash % 9) - 4) / 100;

  return Math.round((midpoint + spread * offset) * 10) / 10;
}

function getSafetyContext(status: MissionStatus | null) {
  if (status === "pickup_safety_check") {
    return {
      title: "Verificare coborâre la ridicare",
      description:
        "Drona verifică zona de ridicare înainte să coboare lockerul.",
    };
  }

  return {
    title: "Verificare coborâre la livrare",
    description:
      "Drona verifică zona de livrare înainte să coboare lockerul.",
  };
}

export function MissionActionPanel({
  orderId,
  parcel,
  droneClass,
}: MissionActionPanelProps) {
  const {
    currentMission,
    currentStatus,
    lockerState,
    droneTelemetry,
    pendingAction,
    isWaitingForUser,
    userActionTimer,
    confirmPickupMeetingPoint,
    rejectPickupMeetingPointAndTryNext,
    verifyPickupPin,
    confirmParcelLoaded,
    confirmDropoffMeetingPoint,
    rejectDropoffMeetingPointAndTryNext,
    verifyRecipientPin,
    confirmParcelCollected,
  } = useMissionRuntime();
  const nextStatus = currentStatus ? getNextMissionStatus(currentStatus) : null;
  const isPickupLockerOpen = currentStatus === "awaiting_parcel_load";
  const isRecipientLockerOpen =
    currentStatus === "awaiting_parcel_collection";
  const activePin = useMemo(() => {
    const purpose = isPickupLockerOpen
      ? "pickup_verification"
      : isRecipientLockerOpen
        ? "dropoff_verification"
        : null;

    if (!purpose) {
      return null;
    }

    return currentMission?.pins.find((pin) => pin.purpose === purpose) ?? null;
  }, [currentMission?.pins, isPickupLockerOpen, isRecipientLockerOpen]);
  const requiresPin = Boolean(activePin);
  const isInternalPinStep =
    currentStatus === "awaiting_pickup_pin" ||
    currentStatus === "awaiting_recipient_pin";
  const visiblePendingAction = isInternalPinStep ? null : pendingAction;
  const canSubmit = Boolean(pendingAction);
  const isPickupMeetingPointDecision =
    currentStatus === "awaiting_sender_position_confirmation";
  const isDropoffMeetingPointDecision =
    currentStatus === "awaiting_recipient_position_confirmation";
  const meetingPointAttempts = currentMission?.meetingPointAttempts;
  const currentMeetingPoint = isPickupMeetingPointDecision
    ? meetingPointAttempts?.pickupMeetingPoints[
        meetingPointAttempts.currentPickupMeetingPointIndex
      ]
    : isDropoffMeetingPointDecision
      ? meetingPointAttempts?.dropoffMeetingPoints[
          meetingPointAttempts.currentDropoffMeetingPointIndex
        ]
      : null;
  const rejectedCount = isPickupMeetingPointDecision
    ? meetingPointAttempts?.rejectedPickupMeetingPointIds.length ?? 0
    : isDropoffMeetingPointDecision
      ? meetingPointAttempts?.rejectedDropoffMeetingPointIds.length ?? 0
      : 0;
  const totalPoints = isPickupMeetingPointDecision
    ? meetingPointAttempts?.pickupMeetingPoints.length ?? 0
    : isDropoffMeetingPointDecision
      ? meetingPointAttempts?.dropoffMeetingPoints.length ?? 0
      : 0;
  const isSafetyCheck = Boolean(
    currentStatus && safetyCheckStatuses.includes(currentStatus),
  );
  const isPayloadVerification = currentStatus === "payload_verification";
  const safetyContext = getSafetyContext(currentStatus);
  const safetyClearedCount = isSafetyCheck ? safetyChecklistItems.length - 1 : 0;
  const missionDroneClass = currentMission?.droneClass ?? droneClass;
  const weightRange = parseWeightRange(parcel.estimatedWeightRange);
  const measuredWeightKg = getStableMeasuredWeightKg(
    weightRange,
    `${orderId}:${parcel.category}`,
  );
  const droneLimitKg = dronePayloadLimitsKg[missionDroneClass];
  const payloadFitsDrone = measuredWeightKg <= droneLimitKg;
  const [timerNowMs, setTimerNowMs] = useState(() => Date.now());
  const operationalTimerCopy = userActionTimer
    ? getOperationalTimerCopy(userActionTimer.kind, userActionTimer.timeoutMs)
    : null;
  const userActionExpiresMs = userActionTimer
    ? Date.parse(userActionTimer.expiresAt)
    : null;
  const operationalTimerRemainingSeconds =
    userActionExpiresMs !== null && !Number.isNaN(userActionExpiresMs)
      ? Math.max(0, Math.ceil((userActionExpiresMs - timerNowMs) / 1000))
      : 0;

  useEffect(() => {
    if (!userActionTimer) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimerNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [userActionTimer]);

  useEffect(() => {
    if (currentStatus === "awaiting_pickup_pin") {
      verifyPickupPin();
      return;
    }

    if (currentStatus === "awaiting_recipient_pin") {
      verifyRecipientPin();
    }
  }, [currentStatus, verifyPickupPin, verifyRecipientPin]);

  const handleAction = () => {
    switch (pendingAction) {
      case "confirm_sender_position":
        confirmPickupMeetingPoint();
        break;
      case "verify_pickup_pin":
        verifyPickupPin();
        break;
      case "confirm_parcel_loaded":
        confirmParcelLoaded();
        break;
      case "confirm_recipient_position":
        confirmDropoffMeetingPoint();
        break;
      case "verify_recipient_pin":
        verifyRecipientPin();
        break;
      case "confirm_parcel_collected":
        confirmParcelCollected();
        break;
      default:
        break;
    }
  };

  return (
    <SectionCard
      eyebrow="Control"
      title="Pasul curent"
      description={
        visiblePendingAction
          ? getActionDescription(visiblePendingAction)
          : nextStatus
            ? `Următoarea operațiune: ${missionStatusLabels[nextStatus]}.`
            : "Nu este necesară nicio acțiune acum."
      }
    >
      <div className="grid gap-4">
        {isPickupMeetingPointDecision || isDropoffMeetingPointDecision ? (
          <div className="grid gap-4 rounded-[calc(var(--radius)+0.375rem)] border border-primary/25 bg-primary/10 p-5">
            <div className="space-y-2">
              <p className="font-heading text-xl tracking-tight text-foreground">
                {isPickupMeetingPointDecision
                  ? "Drona a ajuns la punctul de ridicare"
                  : "Drona a ajuns la punctul de livrare"}
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                Confirmă că vezi drona și că punctul de întâlnire este potrivit
                pentru coborârea lockerului.
              </p>
            </div>

            {currentMeetingPoint ? (
              <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
                <p className="text-sm text-muted-foreground">
                  Punct de întâlnire curent
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {currentMeetingPoint.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentMeetingPoint.distanceFromSelectedAddressMeters} m față de
                  adresa selectată · {currentMeetingPoint.reason}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={`${Math.max(0, totalPoints - rejectedCount)} puncte disponibile`}
                tone="info"
              />
              {rejectedCount > 0 ? (
                <StatusBadge
                  label={`${rejectedCount} respinse`}
                  tone="warning"
                />
              ) : null}
            </div>

            <div className="grid gap-3">
              <AppButton
                type="button"
                onClick={
                  isPickupMeetingPointDecision
                    ? confirmPickupMeetingPoint
                    : confirmDropoffMeetingPoint
                }
                className="min-h-[3.25rem] w-full px-4 py-3"
              >
                <CheckCircle2 className="size-4" />
                Confirm că văd drona și locul este potrivit
              </AppButton>
              <AppButton
                type="button"
                variant="outline"
                onClick={
                  isPickupMeetingPointDecision
                    ? rejectPickupMeetingPointAndTryNext
                    : rejectDropoffMeetingPointAndTryNext
                }
                className="min-h-[3.25rem] w-full px-4 py-3"
              >
                <Crosshair className="size-4" />
                Locul nu este potrivit. Încearcă următorul punct
              </AppButton>
            </div>
          </div>
        ) : null}

        <div className="hidden rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background">
                {isWaitingForUser ? (
                  getActionIcon(visiblePendingAction)
                ) : (
                  <Loader2 className="size-4" />
                )}
              </span>
              <div>
                <p className="font-medium text-foreground">
                  {visiblePendingAction
                    ? missionActionLabels[visiblePendingAction]
                    : currentStatus
                      ? missionStatusLabels[currentStatus]
                      : "Livrarea se pregătește"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {visiblePendingAction
                    ? getActionDescription(visiblePendingAction)
                    : nextStatus
                      ? missionStatusDescriptions[nextStatus]
                      : "Finalizarea operațională este completă."}
                </p>
              </div>
            </div>
            <StatusBadge
              label={isWaitingForUser ? "Acțiune utilizator" : "Pas automat"}
              tone={isWaitingForUser ? "warning" : "info"}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
              <p className="text-sm text-muted-foreground">Locker</p>
              <p className="mt-1 font-medium text-foreground">
                {lockerState ? lockerStateLabels[lockerState] : "În așteptare"}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
              <p className="text-sm text-muted-foreground">Telemetrie</p>
              <p className="mt-1 font-medium text-foreground">
                {droneTelemetry
                  ? `${droneTelemetry.batteryPercent}% baterie / ${droneTelemetry.signalPercent}% semnal`
                  : "În așteptare"}
              </p>
            </div>
          </div>
        </div>

        {isSafetyCheck ? (
          <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{safetyContext.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {safetyContext.description}
                </p>
              </div>
              <StatusBadge
                label={`${safetyClearedCount}/${safetyChecklistItems.length} verificate`}
                tone="info"
              />
            </div>
            <div className="grid gap-2">
              {safetyChecklistItems.map((item, index) => {
                const isChecked = index < safetyClearedCount;

                return (
                  <div
                    key={item}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border/80 bg-secondary/35 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {isChecked ? (
                        <CheckCircle2 className="size-4 text-foreground" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium text-foreground">{item}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {isChecked ? "OK" : "În verificare"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {isPayloadVerification ? (
          <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">Verificare colet</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Lockerul compară greutatea încărcată cu estimarea din comandă.
                </p>
              </div>
              <StatusBadge
                label={payloadFitsDrone ? "Compatibil" : "Peste limită"}
                tone={payloadFitsDrone ? "success" : "destructive"}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/35 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Scale className="size-4" />
                  Estimat
                </div>
                <p className="mt-2 font-medium text-foreground">{weightRange.label}</p>
              </div>
              <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/35 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Gauge className="size-4" />
                  Măsurat
                </div>
                <p className="mt-2 font-medium text-foreground">
                  {measuredWeightKg.toFixed(1)} kg
                </p>
              </div>
              <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/35 p-3">
                <p className="text-sm text-muted-foreground">Dronă</p>
                <p className="mt-2 font-medium text-foreground">
                  {droneClassLabels[missionDroneClass]} · max {droneLimitKg.toFixed(1)} kg
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {requiresPin ? (
          <div className="grid gap-3 rounded-[calc(var(--radius)+0.625rem)] border border-primary/45 bg-primary/12 p-5 shadow-[0_18px_55px_rgba(32,231,213,0.12)]">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase text-primary">
                  Pin pentru deblocare locker
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Folosește codul pe tastatura lockerului, apoi confirmă direct
                  {isPickupLockerOpen ? " încărcarea coletului." : " ridicarea coletului."}
                </p>
              </div>
              {activePin ? (
                <span className="inline-flex min-h-16 w-full min-w-0 items-center justify-center rounded-[calc(var(--radius)+0.25rem)] border border-primary/35 bg-background px-4 font-mono text-[2rem] font-semibold tracking-[0.16em] text-foreground shadow-[var(--elevation-soft)] sm:w-auto sm:min-w-36 sm:px-5 sm:text-3xl">
                  {activePin.code}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {operationalTimerCopy ? (
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-primary/30 bg-primary/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Clock3 className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {operationalTimerCopy.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {operationalTimerCopy.description}
                  </p>
                </div>
              </div>
              <p className="font-heading text-3xl tracking-tight text-foreground">
                {formatOperationalTimerSeconds(
                  operationalTimerRemainingSeconds,
                )}
              </p>
            </div>
          </div>
        ) : null}

        {!isPickupMeetingPointDecision &&
        !isDropoffMeetingPointDecision &&
        !isInternalPinStep ? (
          <AppButton
            type="button"
            onClick={handleAction}
            disabled={!canSubmit}
            className="min-h-[3.25rem] w-full px-4 py-3 sm:w-fit"
          >
            {visiblePendingAction ? (
              getActionIcon(visiblePendingAction)
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {getRuntimeButtonLabel(visiblePendingAction, currentStatus)}
          </AppButton>
        ) : null}
      </div>
    </SectionCard>
  );
}
