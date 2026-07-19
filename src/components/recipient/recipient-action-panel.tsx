"use client";

import {
  CheckCircle2,
  Clock3,
  Crosshair,
  KeyRound,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  missionStatusDescriptions,
  missionStatusLabels,
} from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import type { MissionStatus } from "@/types/mission";

type RecipientPanelMode =
  | "before_dropoff"
  | "confirm_position"
  | "verify_pin"
  | "confirm_collection"
  | "at_dropoff"
  | "completed"
  | "proof"
  | "closed"
  | "unavailable";

const dropoffArrivalStatuses: MissionStatus[] = [
  "arrived_at_dropoff",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "locker_ascending_dropoff",
];

function getPanelMode(status: MissionStatus | null): RecipientPanelMode {
  switch (status) {
    case "awaiting_recipient_position_confirmation":
      return "confirm_position";
    case "awaiting_recipient_pin":
      return "verify_pin";
    case "awaiting_parcel_collection":
      return "confirm_collection";
    case "delivery_completed":
      return "completed";
    case "proof_generated":
      return "proof";
    case "mission_closed":
      return "closed";
    default:
      if (status && dropoffArrivalStatuses.includes(status)) {
        return "at_dropoff";
      }

      return status ? "before_dropoff" : "unavailable";
  }
}

function getPanelCopy(mode: RecipientPanelMode, status: MissionStatus | null) {
  switch (mode) {
    case "confirm_position":
      return {
        title: "Confirmă că vezi drona",
        description:
          "Confirmă că drona este la punctul de livrare aprobat.",
        detail: "Confirmă doar dacă drona este la punctul corect.",
        badge: "Acțiune recipient",
      };
    case "verify_pin":
      return {
        title: "Folosește PIN-ul compartimentului",
        description:
          "Folosește acest PIN pe tastatura compartimentului dronei pentru a-l deschide.",
        detail: "Compartimentul se deschide doar după introducerea PIN-ului pe tastatură.",
        badge: "PIN necesar",
      };
    case "confirm_collection":
      return {
        title: "Colet pregătit pentru ridicare",
        description:
          "Ridică coletul din compartiment, apoi confirmă că predarea este completă.",
        detail: "Confirmă doar după ce coletul este scos complet din compartiment.",
        badge: "Acțiune recipient",
      };
    case "completed":
      return {
        title: "Colet ridicat",
        description: "Predarea către recipient a fost înregistrată.",
        detail: "Misiunea finalizează dovada și evidențele livrării.",
        badge: "Ridicat",
      };
    case "proof":
      return {
        title: "Dovadă generată",
        description: "Dovada de livrare a fost generată din înregistrarea predării.",
        detail: "PIN-ul, compartimentul și telemetria sunt atașate dovezii de livrare.",
        badge: "Dovadă gata",
      };
    case "closed":
      return {
        title: "Livrare închisă",
        description: "Misiunea SkySend este completă.",
        detail: "Nu mai este necesară nicio acțiune din partea recipientului.",
        badge: "Închisă",
      };
    case "at_dropoff":
      return {
        title: status ? missionStatusLabels[status] : "Drona la livrare",
        description:
          "Drona este în secvența de livrare. Urmează următoarea instrucțiune când apare.",
        detail: status
          ? missionStatusDescriptions[status]
          : "Secvența de predare se pregătește.",
        badge: "La livrare",
      };
    case "before_dropoff":
      return {
        title: "Drona vine spre tine",
        description:
          "Drona se deplasează spre punctul tău de livrare. Pregătește-te să fii la punctul de întâlnire aprobat.",
        detail: "Mergi la punctul de livrare selectat când drona este aproape.",
        badge: "Pe traseu",
      };
    default:
      return {
        title: "Predare recipient în așteptare",
        description: "Misiunea live nu este încă disponibilă pentru acest ecran.",
        detail: "Panoul de predare se actualizează când există o misiune live atașată.",
        badge: "În așteptare",
      };
  }
}

function getTone(mode: RecipientPanelMode) {
  if (mode === "completed" || mode === "proof" || mode === "closed") {
    return "success" as const;
  }

  if (
    mode === "confirm_position" ||
    mode === "verify_pin" ||
    mode === "confirm_collection"
  ) {
    return "warning" as const;
  }

  return "info" as const;
}

function getPanelIcon(mode: RecipientPanelMode) {
  switch (mode) {
    case "confirm_position":
      return <Crosshair className="size-4" />;
    case "verify_pin":
      return <KeyRound className="size-4" />;
    case "confirm_collection":
      return <PackageCheck className="size-4" />;
    case "completed":
    case "proof":
    case "closed":
      return <CheckCircle2 className="size-4" />;
    case "at_dropoff":
      return <ShieldCheck className="size-4" />;
    default:
      return <Clock3 className="size-4" />;
  }
}

export function RecipientActionPanel() {
  const {
    currentMission,
    currentStatus,
    confirmDropoffMeetingPoint,
    rejectDropoffMeetingPointAndTryNext,
    verifyRecipientPin,
    confirmParcelCollected,
  } = useMissionRuntime();
  const mode = getPanelMode(currentStatus);
  const copy = getPanelCopy(mode, currentStatus);
  const recipientPin =
    currentMission?.pins.find((pin) => pin.purpose === "dropoff_verification") ??
    null;
  const requiresPin = mode === "verify_pin";
  const canSubmit =
    mode === "confirm_position" ||
    mode === "confirm_collection" ||
    requiresPin;

  const handleAction = () => {
    if (mode === "confirm_position") {
      confirmDropoffMeetingPoint();
      return;
    }

    if (mode === "verify_pin") {
      verifyRecipientPin();
      return;
    }

    if (mode === "confirm_collection") {
      confirmParcelCollected();
    }
  };

  return (
    <SectionCard
      eyebrow="Handoff"
      title={copy.title}
      description={copy.description}
    >
      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
            {getPanelIcon(mode)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{copy.title}</p>
              <StatusBadge label={copy.badge} tone={getTone(mode)} />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {copy.detail}
            </p>
          </div>
        </div>

        {requiresPin ? (
          <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">PIN destinatar</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Folosește acest PIN pe tastatura compartimentului dronei.
                </p>
              </div>
              {recipientPin ? (
                <span className="inline-flex min-h-12 min-w-32 items-center justify-center rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/60 px-4 font-mono text-2xl font-semibold tracking-normal text-foreground">
                  {recipientPin.code}
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Introdu PIN-ul pe tastatura compartimentului, apoi confirmă aici după
              ce acesta se deschide.
            </p>
          </div>
        ) : null}

        {mode === "confirm_position" ? (
          <div className="grid gap-3">
            <AppButton
              type="button"
              onClick={handleAction}
              disabled={!canSubmit}
              className="min-h-[3.25rem] w-full px-4 py-3"
            >
              <CheckCircle2 className="size-4" />
              Confirm că văd drona și locul este potrivit
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={rejectDropoffMeetingPointAndTryNext}
              disabled={!currentMission}
              className="min-h-[3.25rem] w-full px-4 py-3"
            >
              <Crosshair className="size-4" />
              Locul nu este potrivit. Încearcă următorul punct
            </AppButton>
          </div>
        ) : mode === "verify_pin" || mode === "confirm_collection" ? (
          <AppButton
            type="button"
            onClick={handleAction}
            disabled={!canSubmit}
            className="min-h-[3.25rem] w-full px-4 py-3 sm:w-fit"
          >
            {getPanelIcon(mode)}
            {mode === "verify_pin" ? "PIN folosit pe compartiment" : "Colet ridicat"}
          </AppButton>
        ) : null}
      </div>
    </SectionCard>
  );
}
