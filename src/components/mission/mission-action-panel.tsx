"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, LocateFixed, PackageCheck, RotateCw } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { missionStatusLabels } from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

type MissionActionPanelProps = {
  orderId: string;
  parcel: CreatedDeliveryOrder["payload"]["parcel"];
  droneClass: CreatedDeliveryOrder["payload"]["recommendedDroneClass"];
  accessScope?: CreatedDeliveryOrder["trackingAccessScope"];
  trackingIdentifier?: string | null;
};

function formatTimer(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

export function MissionActionPanel({
  orderId,
  accessScope = "owner",
  trackingIdentifier,
}: MissionActionPanelProps) {
  const {
    currentMission,
    currentStatus,
    userActionTimer,
    confirmPickupMeetingPoint,
    rejectPickupMeetingPointAndTryNext,
    confirmParcelLoaded,
    confirmDropoffMeetingPoint,
    rejectDropoffMeetingPointAndTryNext,
    confirmParcelCollected,
  } = useMissionRuntime();
  const [now, setNow] = useState(() => Date.now());
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!userActionTimer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [userActionTimer]);

  const remainingSeconds = userActionTimer
    ? Math.max(0, (Date.parse(userActionTimer.expiresAt) - now) / 1000)
    : null;
  const isPickupDecision = currentStatus === "awaiting_sender_position_confirmation";
  const isDropoffDecision = currentStatus === "awaiting_recipient_position_confirmation";
  const isPickupLoad = currentStatus === "awaiting_parcel_load";
  const isDropoffCollection = currentStatus === "awaiting_parcel_collection";
  const canPickup = accessScope === "owner" || accessScope === "full" || accessScope === "pickup";
  const canDropoff = accessScope === "owner" || accessScope === "full" || accessScope === "dropoff";
  const canAct = (isPickupDecision || isPickupLoad) ? canPickup : canDropoff;
  const attempts = currentMission?.meetingPointAttempts;
  const currentPoint = useMemo(() => {
    if (isPickupDecision) {
      return attempts?.pickupMeetingPoints[attempts.currentPickupMeetingPointIndex] ?? null;
    }
    if (isDropoffDecision) {
      return attempts?.dropoffMeetingPoints[attempts.currentDropoffMeetingPointIndex] ?? null;
    }
    return null;
  }, [attempts, isDropoffDecision, isPickupDecision]);
  const pointIndex = isPickupDecision
    ? (attempts?.currentPickupMeetingPointIndex ?? 0) + 1
    : (attempts?.currentDropoffMeetingPointIndex ?? 0) + 1;
  const activePin = currentMission?.pins.find((pin) =>
    isPickupLoad
      ? pin.purpose === "pickup_verification"
      : isDropoffCollection
        ? pin.purpose === "dropoff_verification"
        : false,
  );

  async function syncAction(action: "confirm_position" | "next_point" | "parcel_loaded" | "parcel_delivered") {
    const identifier = trackingIdentifier ?? orderId;
    setIsSyncing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/tracking/${encodeURIComponent(identifier)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Acțiunea nu a putut fi sincronizată.");
      }
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Acțiunea nu a putut fi sincronizată.",
      );
      return false;
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="mission-action-panel">
      <div className="border-b border-border/70 px-5 py-5 sm:px-7 sm:py-6">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Pasul curent</p>
        <h2 className="mt-2 font-heading text-2xl leading-tight text-foreground sm:text-3xl">
          {currentStatus ? missionStatusLabels[currentStatus] : "Pregătim livrarea"}
        </h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        {remainingSeconds !== null ? (
          <div className="flex items-center justify-between gap-5 border-b border-border/70 pb-5">
            <div className="flex min-w-0 items-center gap-3">
              <Clock3 className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{userActionTimer?.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Acțiunea expiră automat</p>
              </div>
            </div>
            <p className="font-mono text-2xl font-semibold text-foreground tabular-nums sm:text-3xl">
              {formatTimer(remainingSeconds)}
            </p>
          </div>
        ) : null}

        {(isPickupDecision || isDropoffDecision) && currentPoint ? (
          <div className="grid gap-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Punct de întâlnire</p>
                <span className="text-xs font-medium text-muted-foreground">{pointIndex}/4</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">{currentPoint.label}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {currentPoint.distanceFromSelectedAddressMeters} m de adresa selectată
              </p>
            </div>

            {canAct ? (
              <div className="mt-auto grid gap-3 sm:grid-cols-2">
                <AppButton
                  type="button"
                  size="lg"
                  className="min-h-12 w-full"
                  disabled={isSyncing}
                  onClick={async () => {
                    if (await syncAction("confirm_position")) {
                      (isPickupDecision ? confirmPickupMeetingPoint : confirmDropoffMeetingPoint)();
                    }
                  }}
                >
                  <LocateFixed className="size-4" />
                  Confirm poziția dronei
                </AppButton>
                <AppButton
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-h-12 w-full"
                  disabled={isSyncing}
                  onClick={async () => {
                    if (await syncAction("next_point")) {
                      (isPickupDecision
                        ? rejectPickupMeetingPointAndTryNext
                        : rejectDropoffMeetingPointAndTryNext)();
                    }
                  }}
                >
                  <RotateCw className="size-4" />
                  Următorul punct
                </AppButton>
              </div>
            ) : (
              <p className="border-t border-border/70 pt-4 text-sm text-muted-foreground">
                Acest link permite urmărirea fazei, fără acțiuni pentru participantul curent.
              </p>
            )}
          </div>
        ) : null}

        {(isPickupLoad || isDropoffCollection) ? (
          <div className="flex flex-1 flex-col gap-6">
            <div>
              <p className="text-sm text-muted-foreground">PIN compartiment</p>
              <p className="mt-3 font-mono text-5xl font-semibold text-foreground tracking-normal sm:text-6xl">
                {activePin?.code ?? "••••"}
              </p>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                Folosește codul pe tastatura compartimentului, apoi confirmă operațiunea.
              </p>
            </div>
            {canAct ? (
              <AppButton
                type="button"
                size="lg"
                className="mt-auto min-h-12 w-full"
                disabled={isSyncing}
                onClick={async () => {
                  if (await syncAction(isPickupLoad ? "parcel_loaded" : "parcel_delivered")) {
                    (isPickupLoad ? confirmParcelLoaded : confirmParcelCollected)();
                  }
                }}
              >
                {isPickupLoad ? <PackageCheck className="size-4" /> : <Check className="size-4" />}
                {isPickupLoad ? "Colet încărcat" : "Colet livrat"}
              </AppButton>
            ) : null}
          </div>
        ) : null}

        {actionError ? (
          <p className="border-l-2 border-destructive pl-3 text-sm text-destructive">
            {actionError}
          </p>
        ) : null}

        {!isPickupDecision && !isDropoffDecision && !isPickupLoad && !isDropoffCollection ? (
          <div className="flex flex-1 items-center">
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Drona se deplasează automat. Poziția și progresul se actualizează pe hartă.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
