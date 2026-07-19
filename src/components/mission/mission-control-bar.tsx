"use client";

import {
  Box,
  LockKeyhole,
  Navigation,
  Radio,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  lockerStateLabels,
  missionStatusLabels,
} from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { getNextMissionStatus } from "@/lib/mission-state-machine";

type MissionControlBarProps = {
  orderId: string;
  pickupLabel: string;
  dropoffLabel: string;
  statusLabel: string;
  urgencyLabel: string;
  etaLabel: string;
  priceLabel: string;
  droneClassLabel: string;
};

function formatSegmentLabel(value: string) {
  switch (value) {
    case "warehouse_to_pickup":
      return "spre pickup";
    case "pickup_to_dropoff":
      return "în zbor spre destinatar";
    case "dropoff_to_warehouse":
      return "întoarcere la hub";
    default:
      return "pe traseu";
  }
}

export function MissionControlBar({
  orderId,
  pickupLabel,
  dropoffLabel,
  statusLabel,
  urgencyLabel,
  etaLabel,
  priceLabel,
  droneClassLabel,
}: MissionControlBarProps) {
  const {
    currentStatus,
    activeSegment,
    segmentProgress,
    lockerState,
    isMissionRunning,
    isWaitingForUser,
  } = useMissionRuntime();
  const nextStatus = currentStatus ? getNextMissionStatus(currentStatus) : null;
  const statusText = currentStatus
    ? missionStatusLabels[currentStatus]
    : "Se pregătește misiunea";
  const progressPercent = Math.round(segmentProgress * 100);
  const progressText = activeSegment
    ? `${progressPercent}% ${formatSegmentLabel(activeSegment.type)}`
    : nextStatus
      ? `Urmează: ${missionStatusLabels[nextStatus]}`
      : etaLabel;
  const lockerText = lockerState ? lockerStateLabels[lockerState] : "În așteptare";

  return (
    <Card className="rounded-[var(--ui-radius-panel)] border-border/80 bg-card/90 shadow-[var(--elevation-panel)]">
      <CardContent className="grid gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge
            label={isMissionRunning ? "Livrare live" : "Comandă plasată"}
            tone={isMissionRunning ? "success" : "neutral"}
            className={isMissionRunning ? "motion-safe:animate-pulse" : undefined}
          />
          <StatusBadge
            label={statusText}
            tone={isWaitingForUser ? "warning" : "info"}
          />
          <StatusBadge label="Operațiuni Pitești" tone="neutral" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(34rem,1fr)] lg:items-end">
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">Comanda {orderId}</p>
            <h1 className="break-words font-heading text-2xl tracking-tight sm:text-3xl">
              Urmărire live de la {pickupLabel} la {dropoffLabel}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
              Operațiune curentă: {progressText.toLocaleLowerCase("ro-RO")}.
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="min-w-0 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Radio className="size-4" />
                <p className="text-sm">Comandă</p>
              </div>
              <p className="mt-2 font-medium text-foreground">{statusLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{urgencyLabel}</p>
            </div>

            <div className="min-w-0 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Navigation className="size-4" />
                <p className="text-sm">Progres</p>
              </div>
              <p className="mt-2 font-medium text-foreground">{progressText}</p>
              <p className="mt-1 text-xs text-muted-foreground">ETA este evidențiat mai jos</p>
            </div>

            <div className="min-w-0 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Box className="size-4" />
                <p className="text-sm">Dronă</p>
              </div>
              <p className="mt-2 font-medium text-foreground">{droneClassLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{priceLabel}</p>
            </div>

            <div className="min-w-0 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <LockKeyhole className="size-4" />
                <p className="text-sm">Locker</p>
              </div>
              <p className="mt-2 font-medium text-foreground">{lockerText}</p>
              <p className="mt-1 text-xs text-muted-foreground">Status predare</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

