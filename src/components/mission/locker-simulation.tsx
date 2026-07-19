"use client";

import { m, useReducedMotion } from "motion/react";
import { Box, Cable, LockKeyhole, Plane } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  lockerStateLabels,
  missionStatusLabels,
} from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { motionTransitions } from "@/lib/motion";
import type { LockerState } from "@/types/mission";

type LockerVisualState = {
  y: number;
  cableHeight: number;
  boxScale: number;
  tone: "neutral" | "info" | "success" | "warning";
  note: string;
};

const lockerVisualStates: Record<LockerState, LockerVisualState> = {
  attached: {
    y: 0,
    cableHeight: 26,
    boxScale: 0.96,
    tone: "neutral",
    note: "Locker attached under the drone.",
  },
  preparing_descent: {
    y: 10,
    cableHeight: 38,
    boxScale: 0.98,
    tone: "info",
    note: "Locker descent is being prepared.",
  },
  descending: {
    y: 72,
    cableHeight: 104,
    boxScale: 1,
    tone: "info",
    note: "Locker is descending for handoff.",
  },
  ready_for_load: {
    y: 112,
    cableHeight: 144,
    boxScale: 1.02,
    tone: "warning",
    note: "Locker is ready for parcel loading.",
  },
  loaded: {
    y: 112,
    cableHeight: 144,
    boxScale: 1.03,
    tone: "success",
    note: "Coletul este încărcat în locker.",
  },
  ascending: {
    y: 52,
    cableHeight: 84,
    boxScale: 1,
    tone: "info",
    note: "Locker is ascending to flight position.",
  },
  secured: {
    y: 0,
    cableHeight: 26,
    boxScale: 0.96,
    tone: "success",
    note: "Locker is secured for flight.",
  },
  ready_for_unload: {
    y: 112,
    cableHeight: 144,
    boxScale: 1.02,
    tone: "warning",
    note: "Locker is ready for parcel collection.",
  },
  emptied: {
    y: 78,
    cableHeight: 110,
    boxScale: 0.98,
    tone: "success",
    note: "Coletul a fost ridicat.",
  },
  locked: {
    y: 0,
    cableHeight: 26,
    boxScale: 0.96,
    tone: "neutral",
    note: "Locker is locked.",
  },
};

function getFallbackVisualState(): LockerVisualState {
  return {
    y: 0,
    cableHeight: 26,
    boxScale: 0.96,
    tone: "neutral",
    note: "Locker state pending.",
  };
}

export function LockerSimulation() {
  const { currentStatus, lockerState, droneTelemetry } = useMissionRuntime();
  const shouldReduceMotion = useReducedMotion();
  const stateLabel = lockerState ? lockerStateLabels[lockerState] : "Pending";
  const visualState = lockerState
    ? lockerVisualStates[lockerState]
    : getFallbackVisualState();
  const transition = shouldReduceMotion
    ? { duration: 0.01 }
    : { ...motionTransitions.base, duration: 0.34 };
  const isPayloadAttached =
    Boolean(droneTelemetry?.payloadWeightKg && droneTelemetry.payloadWeightKg > 0);

  return (
    <SectionCard
      eyebrow="Locker"
      title="Locker movement"
      description="Cable and locker state for the active handoff sequence."
    >
      <div className="grid gap-4">
        <div className="relative min-h-[15rem] overflow-hidden rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-[linear-gradient(180deg,var(--color-secondary),var(--color-background))] p-5">
          <div className="absolute inset-x-5 top-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Plane className="size-4" />
              Drone hold
            </div>
            <StatusBadge label={stateLabel} tone={visualState.tone} />
          </div>

          <div className="absolute left-1/2 top-16 flex -translate-x-1/2 flex-col items-center">
            <div className="flex h-9 w-28 items-center justify-center rounded-full border border-border bg-card shadow-[var(--elevation-soft)]">
              <div className="h-1.5 w-16 rounded-full bg-foreground/75" />
            </div>

            <m.div
              aria-hidden="true"
              className="w-px origin-top bg-border"
              animate={{ height: visualState.cableHeight }}
              transition={transition}
            />

            <m.div
              className="relative grid size-16 place-items-center rounded-[calc(var(--radius)+0.375rem)] border border-border bg-card shadow-[var(--elevation-panel)]"
              animate={{
                y: visualState.y,
                scale: visualState.boxScale,
              }}
              transition={transition}
            >
              <Box className="size-6 text-foreground" />
              {isPayloadAttached ? (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border bg-success text-[0.6rem] font-semibold text-success-foreground">
                  kg
                </span>
              ) : null}
            </m.div>
          </div>

          <div className="absolute bottom-4 left-5 right-5 grid gap-2 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card/88 p-3 shadow-[var(--elevation-soft)] backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {lockerState === "locked" || lockerState === "secured" ? (
                <LockKeyhole className="size-4" />
              ) : (
                <Cable className="size-4" />
              )}
              {stateLabel}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {visualState.note}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
            <p className="text-sm text-muted-foreground">Mission status</p>
            <p className="mt-1 font-medium text-foreground">
              {currentStatus ? missionStatusLabels[currentStatus] : "Se pregătește misiunea"}
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
            <p className="text-sm text-muted-foreground">Payload</p>
            <p className="mt-1 font-medium text-foreground">
              {isPayloadAttached
                ? `${droneTelemetry?.payloadWeightKg?.toFixed(1)} kg secured`
                : "No payload secured"}
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
