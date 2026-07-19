"use client";

import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { missionStatusLabels } from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { cn } from "@/lib/utils";
import type { MissionStatus } from "@/types/mission";

type TimelineStepState = "completed" | "current" | "upcoming";

type TimelineStep = {
  key: string;
  label: string;
  description: string;
  statuses: MissionStatus[];
};

const timelineSteps: TimelineStep[] = [
  {
    key: "dispatch_preflight",
    label: "Dispatch si preflight",
    description: "Comanda este confirmata, iar drona si lockerul sunt verificate.",
    statuses: ["mission_created", "preflight_checks", "drone_dispatched"],
  },
  {
    key: "flight_to_pickup",
    label: "Zbor spre ridicare",
    description: "Drona zboara de la hub catre punctul de ridicare.",
    statuses: ["en_route_to_pickup"],
  },
  {
    key: "arrived_pickup",
    label: "Sosire la punctul de ridicare",
    description: "Drona a ajuns la primul punct de ridicare.",
    statuses: ["arrived_at_pickup"],
  },
  {
    key: "confirm_pickup_point",
    label: "Confirmare punct de ridicare",
    description: "Expeditorul confirma ca vede drona si ca locul este potrivit.",
    statuses: ["awaiting_sender_position_confirmation"],
  },
  {
    key: "pickup_safety",
    label: "Verificare siguranta pickup",
    description: "Drona verifica zona inainte de coborarea lockerului.",
    statuses: ["pickup_safety_check"],
  },
  {
    key: "pickup_locker_descent",
    label: "Coborare locker pickup",
    description: "Lockerul coboara pentru incarcarea coletului.",
    statuses: ["locker_descending_pickup"],
  },
  {
    key: "parcel_load",
    label: "Incarcare colet",
    description:
      "PIN-ul este afisat pentru tastatura lockerului, iar expeditorul incarca coletul si confirma actiunea.",
    statuses: ["awaiting_pickup_pin", "awaiting_parcel_load"],
  },
  {
    key: "pickup_locker_ascent",
    label: "Securizare locker pickup",
    description: "Lockerul urca si se securizeaza pentru zbor.",
    statuses: ["locker_ascending_pickup"],
  },
  {
    key: "payload_verification",
    label: "Verificare colet",
    description: "SkySend verifica greutatea si starea coletului.",
    statuses: ["payload_verification"],
  },
  {
    key: "parcel_secured",
    label: "Colet securizat",
    description: "Coletul este securizat in locker.",
    statuses: ["parcel_secured"],
  },
  {
    key: "flight_to_dropoff",
    label: "Zbor spre livrare",
    description: "Drona zboara catre punctul de livrare.",
    statuses: ["en_route_to_dropoff"],
  },
  {
    key: "arrived_dropoff",
    label: "Sosire la punctul de livrare",
    description: "Drona a ajuns la primul punct de livrare.",
    statuses: ["arrived_at_dropoff"],
  },
  {
    key: "confirm_dropoff_point",
    label: "Confirmare punct de livrare",
    description: "Destinatarul confirma ca vede drona si ca locul este potrivit.",
    statuses: ["awaiting_recipient_position_confirmation"],
  },
  {
    key: "dropoff_safety",
    label: "Verificare siguranta dropoff",
    description: "Drona verifica zona inainte de coborarea lockerului.",
    statuses: ["dropoff_safety_check"],
  },
  {
    key: "dropoff_locker_descent",
    label: "Coborare locker dropoff",
    description: "Lockerul coboara pentru ridicarea coletului.",
    statuses: ["locker_descending_dropoff"],
  },
  {
    key: "parcel_collection",
    label: "Ridicare colet",
    description:
      "PIN-ul este afisat pentru tastatura lockerului, iar destinatarul ridica coletul si confirma actiunea.",
    statuses: ["awaiting_recipient_pin", "awaiting_parcel_collection"],
  },
  {
    key: "dropoff_locker_ascent",
    label: "Securizare locker dropoff",
    description: "Lockerul urca dupa ridicarea coletului.",
    statuses: ["locker_ascending_dropoff"],
  },
  {
    key: "delivery_completed",
    label: "Finalizare livrare",
    description: "Livrarea este finalizata si dovada este salvata.",
    statuses: ["delivery_completed", "proof_generated", "mission_closed"],
  },
  {
    key: "fallback",
    label: "Fallback sau retur la hub",
    description: "Drona revine la hub si comanda este oprita prin flow-ul existent.",
    statuses: ["returning_to_hub", "returned_to_hub", "mission_failed"],
  },
  {
    key: "support_required",
    label: "Suport necesar",
    description: "Echipa SkySend gestioneaza etapa de suport existenta.",
    statuses: ["fallback_required"],
  },
];

function getCurrentStepIndex(status: MissionStatus | null) {
  if (!status) {
    return -1;
  }

  const index = timelineSteps.findIndex((step) =>
    step.statuses.includes(status),
  );

  if (index >= 0) {
    return index;
  }

  return timelineSteps.length - 1;
}

function getStepState(index: number, currentIndex: number): TimelineStepState {
  if (currentIndex < 0) {
    return "upcoming";
  }

  if (index < currentIndex) {
    return "completed";
  }

  if (index === currentIndex) {
    return "current";
  }

  return "upcoming";
}

function getStepIcon(state: TimelineStepState) {
  if (state === "completed") {
    return <CheckCircle2 className="size-4" />;
  }

  if (state === "current") {
    return <Clock3 className="size-4" />;
  }

  return <Circle className="size-4" />;
}

function getStepTone(state: TimelineStepState) {
  if (state === "completed") {
    return "success" as const;
  }

  if (state === "current") {
    return "info" as const;
  }

  return "neutral" as const;
}

export function MissionTimeline() {
  const { currentStatus } = useMissionRuntime();
  const currentIndex = getCurrentStepIndex(currentStatus);

  return (
    <SectionCard
      eyebrow="Timeline"
      title="Cronologie livrare"
      description="Urmareste pasii principali de la dispatch pana la livrare."
    >
      <div className="grid gap-3">
        {timelineSteps.map((step, index) => {
          const state = getStepState(index, currentIndex);
          const isCurrent = state === "current";

          return (
            <div
              key={step.key}
              className={cn(
                "grid min-w-0 gap-3 rounded-[calc(var(--radius)+0.375rem)] border bg-secondary/45 p-4 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto]",
                isCurrent
                  ? "border-accent/60 bg-accent/10"
                  : "border-border/80",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border bg-background text-foreground",
                  isCurrent
                    ? "border-accent/70 text-accent motion-safe:animate-pulse"
                    : "border-border",
                )}
              >
                {getStepIcon(state)}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {index + 1}. {step.label}
                  </p>
                  <StatusBadge
                    label={
                      state === "completed"
                        ? "Finalizat"
                        : state === "current"
                          ? "Acum"
                          : "Urmeaza"
                    }
                    tone={getStepTone(state)}
                  />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {isCurrent && currentStatus
                    ? missionStatusLabels[currentStatus]
                    : step.description}
                </p>
              </div>
              <div className="min-w-0 text-sm text-muted-foreground sm:justify-self-end">
                {isCurrent ? "Live acum" : state === "completed" ? "Gata" : "In coada"}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
