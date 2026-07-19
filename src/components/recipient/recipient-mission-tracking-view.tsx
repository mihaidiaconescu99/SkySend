"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Crosshair,
  PackageCheck,
  Plane,
  Route,
  ShieldCheck,
} from "lucide-react";
import {
  HubLockerRecoveryMap,
  LiveMissionMap,
} from "@/components/mission/live-mission-map";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { droneClassLabels } from "@/constants/domain";
import { deliveryPlatformLabels } from "@/constants/delivery-configurations";
import { missionStatusDescriptions } from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { useRecipientTrackingOrder } from "@/hooks/use-recipient-tracking-order";
import { updateCreatedDeliveryOrderFulfillment } from "@/lib/create-delivery-submit";
import {
  doesPublicTrackingCodeMatchMission,
  doesRecipientTokenMatchMission,
  getPublicRecipientStatusLabel,
  normalizePublicTrackingCode,
} from "@/lib/recipient-tracking";
import {
  formatScheduledDeliveryCountdown,
  formatScheduledDeliveryDate,
  getScheduledDeliveryStartMs,
  isScheduledDeliveryWaiting,
} from "@/lib/scheduled-delivery";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { Mission, MissionSegment, MissionStatus } from "@/types/mission";

type RecipientMissionTrackingViewProps = {
  token: string;
};

function getDeliveryConfigurationSummary(
  payload: CreatedDeliveryOrder["payload"],
) {
  const configuration = payload.selectedDeliveryConfiguration;

  if (!configuration) {
    return droneClassLabels[payload.recommendedDroneClass];
  }

  return `${deliveryPlatformLabels[configuration.platform]} / ${configuration.moduleName}`;
}

const pickupReachedStatuses: MissionStatus[] = [
  "arrived_at_pickup",
  "awaiting_sender_position_confirmation",
  "pickup_safety_check",
  "locker_descending_pickup",
  "awaiting_pickup_pin",
  "awaiting_parcel_load",
  "locker_ascending_pickup",
  "payload_verification",
  "parcel_secured",
  "en_route_to_dropoff",
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];

const deliveredStatuses: MissionStatus[] = [
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];

const dropoffReachedStatuses: MissionStatus[] = [
  "arrived_at_dropoff",
  "awaiting_recipient_position_confirmation",
  "dropoff_safety_check",
  "locker_descending_dropoff",
  "awaiting_recipient_pin",
  "awaiting_parcel_collection",
  "locker_ascending_dropoff",
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];

const progressSteps = [
  {
    label: "Dronă alocată",
    statuses: ["preflight_checks", "drone_dispatched"] satisfies MissionStatus[],
  },
  {
    label: "Ridicare",
    statuses: ["en_route_to_pickup", "arrived_at_pickup"] satisfies MissionStatus[],
  },
  {
    label: "Colet securizat",
    statuses: ["parcel_secured"] satisfies MissionStatus[],
  },
  {
    label: "În zbor spre destinatar",
    statuses: ["en_route_to_dropoff"] satisfies MissionStatus[],
  },
  {
    label: "Ajunge în curând",
    statuses: [
      "arrived_at_dropoff",
      "awaiting_recipient_position_confirmation",
      "dropoff_safety_check",
      "locker_descending_dropoff",
      "awaiting_recipient_pin",
      "awaiting_parcel_collection",
      "locker_ascending_dropoff",
    ] satisfies MissionStatus[],
  },
  {
    label: "Livrat",
    statuses: deliveredStatuses,
  },
];

function getRemainingSeconds({
  durationSeconds,
  progress,
}: {
  durationSeconds?: number | null;
  progress: number;
}) {
  if (!durationSeconds) {
    return 0;
  }

  return Math.max(0, Math.round(durationSeconds * (1 - progress)));
}

function getRemainingDropoffSeconds({
  currentStatus,
  activeSegment,
  segmentProgress,
  missionSegments,
  finalizedDeliveryDelaySeconds,
}: {
  currentStatus: MissionStatus | null;
  activeSegment: MissionSegment | null;
  segmentProgress: number;
  missionSegments: MissionSegment[];
  finalizedDeliveryDelaySeconds: number;
}) {
  if (!currentStatus) {
    return null;
  }

  if (dropoffReachedStatuses.includes(currentStatus)) {
    return 0;
  }

  const pickupSegment = missionSegments.find(
    (segment) => segment.type === "warehouse_to_pickup",
  );
  const dropoffSegment = missionSegments.find(
    (segment) => segment.type === "pickup_to_dropoff",
  );

  if (activeSegment?.type === "pickup_to_dropoff") {
    return getRemainingSeconds({
      durationSeconds: activeSegment.plannedDurationSeconds,
      progress: segmentProgress,
    });
  }

  if (pickupReachedStatuses.includes(currentStatus)) {
    return (
      (dropoffSegment?.plannedDurationSeconds ?? 0) +
      finalizedDeliveryDelaySeconds
    );
  }

  const pickupRemainder =
    activeSegment?.type === "warehouse_to_pickup"
      ? getRemainingSeconds({
          durationSeconds: activeSegment.plannedDurationSeconds,
          progress: segmentProgress,
        })
      : pickupSegment?.plannedDurationSeconds ?? 0;

  return (
    pickupRemainder +
    (dropoffSegment?.plannedDurationSeconds ?? 0) +
    finalizedDeliveryDelaySeconds
  );
}

function formatEta(seconds: number | null) {
  if (seconds === null) {
    return "Pregătește ETA";
  }

  if (seconds <= 0) {
    return "Ajunsă";
  }

  if (seconds < 60) {
    return "Sub 1 min";
  }

  return `${Math.ceil(seconds / 60)} min`;
}

function getProgressIndex(status: MissionStatus | null) {
  if (!status) {
    return -1;
  }

  return progressSteps.findIndex((step) => step.statuses.includes(status));
}

function InvalidRecipientLink() {
  return (
    <section className="app-container py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <SectionCard
          eyebrow="Urmărire live"
          title="Comanda nu este disponibilă"
          description="Codul introdus nu corespunde unei livrări active sau accesibile public."
        >
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                <AlertCircle className="size-4 text-foreground" />
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Nu am găsit o comandă cu acest cod
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Verifică dacă ai introdus codul exact. Nu afișăm detalii
                  despre coduri invalide, inactive sau inaccesibile public.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

export function RecipientMissionTrackingView({
  token,
}: RecipientMissionTrackingViewProps) {
  const order = useRecipientTrackingOrder(token);
  const [scheduledNowMs, setScheduledNowMs] = useState(() => Date.now());
  const {
    currentMission,
    currentStatus,
    activeSegment,
    segmentProgress,
    isMissionRunning,
    createMissionFromOrder,
    startMission,
    syncPaidCreatedDeliveryOrderMission,
  } = useMissionRuntime();

  const missionMatchesIdentifier =
    currentMission && order
      ? doesPublicTrackingCodeMatchMission({
          code: token,
          mission: currentMission,
          order,
        }) ||
        doesRecipientTokenMatchMission({
          token,
          mission: currentMission,
          order,
        })
      : false;
  const orderId = order?.id ?? null;
  const isWaitingForScheduledStart = order
    ? order.paymentStatus === "paid" &&
      isScheduledDeliveryWaiting(order, scheduledNowMs)
    : false;
  const scheduledStartMs = order ? getScheduledDeliveryStartMs(order) : null;
  const scheduledDateLabel = order
    ? formatScheduledDeliveryDate(order.payload.scheduledAt)
    : null;
  const scheduledCountdownLabel =
    isWaitingForScheduledStart && scheduledStartMs !== null
      ? formatScheduledDeliveryCountdown(scheduledStartMs - scheduledNowMs)
      : null;

  useEffect(() => {
    if (!isWaitingForScheduledStart) {
      return;
    }

    const interval = window.setInterval(() => setScheduledNowMs(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [isWaitingForScheduledStart]);

  useEffect(() => {
    if (
      !order ||
      order.paymentStatus !== "paid" ||
      order.fulfillmentStatus === "canceled" ||
      isWaitingForScheduledStart
    ) {
      return;
    }

    const syncedSnapshot = syncPaidCreatedDeliveryOrderMission(order, {
      isLiveTrackingVisible: true,
    });

    if (
      currentMission?.sourceOrderId === order.id ||
      syncedSnapshot.currentMission?.sourceOrderId === order.id
    ) {
      return;
    }

    createMissionFromOrder(order);
  }, [
    createMissionFromOrder,
    currentMission?.sourceOrderId,
    isWaitingForScheduledStart,
    order,
    syncPaidCreatedDeliveryOrderMission,
  ]);

  useEffect(() => {
    if (
      !order ||
      order.paymentStatus !== "paid" ||
      order.fulfillmentStatus === "canceled" ||
      isWaitingForScheduledStart ||
      !currentMission ||
      currentMission.sourceOrderId !== order.id ||
      isMissionRunning ||
      currentStatus === "mission_closed"
    ) {
      return;
    }

    startMission();
  }, [
    currentMission,
    currentStatus,
    isMissionRunning,
    isWaitingForScheduledStart,
    order,
    startMission,
  ]);

  useEffect(() => {
    if (
      !orderId ||
      isWaitingForScheduledStart ||
      !currentStatus ||
      currentMission?.sourceOrderId !== orderId
    ) {
      return;
    }

    if (currentStatus === "mission_closed") {
      updateCreatedDeliveryOrderFulfillment({
        orderId,
        fulfillmentStatus: "completed_mission",
        missionId: currentMission.id,
        missionStatus: currentStatus,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    if (currentStatus === "mission_failed") {
      updateCreatedDeliveryOrderFulfillment({
        orderId,
        fulfillmentStatus: "failed_mission",
        missionId: currentMission.id,
        missionStatus: currentStatus,
      });
      return;
    }

    if (currentStatus === "fallback_required") {
      updateCreatedDeliveryOrderFulfillment({
        orderId,
        fulfillmentStatus: "fallback_required",
        missionId: currentMission.id,
        missionStatus: currentStatus,
      });
      return;
    }

    if (
      currentStatus === "returning_to_hub" ||
      currentStatus === "returned_to_hub" ||
      currentMission.failureReason === "no_suitable_pickup_meeting_point" ||
      currentMission.failureReason === "no_suitable_dropoff_meeting_point"
    ) {
      updateCreatedDeliveryOrderFulfillment({
        orderId,
        fulfillmentStatus: "failed_mission",
        missionId: currentMission.id,
        missionStatus: currentStatus,
      });
      return;
    }

    updateCreatedDeliveryOrderFulfillment({
      orderId,
      fulfillmentStatus: "active_mission",
      missionId: currentMission.id,
      missionStatus: currentStatus,
    });
  }, [currentMission, currentStatus, isWaitingForScheduledStart, orderId]);

  if (!order) {
    return <InvalidRecipientLink />;
  }

  if (isWaitingForScheduledStart) {
    return (
      <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-3xl gap-5">
          <SectionCard
            eyebrow="Livrare programată"
            title="Livrarea începe la ora programată"
            description="SkySend a confirmat comanda, dar tracking-ul live pornește când drona intră efectiv în misiune."
          >
            <div className="grid gap-4">
              <div className="rounded-[calc(var(--radius)+0.5rem)] border border-primary/30 bg-primary/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Clock3 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        Start programat
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {scheduledDateLabel ?? "Ora programată este salvată pe comandă."}
                      </p>
                    </div>
                  </div>
                  <StatusBadge label="În așteptare" tone="info" />
                </div>
                <p className="mt-5 font-heading text-4xl tracking-tight text-foreground sm:text-5xl">
                  {scheduledCountdownLabel ?? "0m 0s"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Livrarea începe automat la ora programată.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
                  <p className="font-medium text-foreground">Ridicare</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {order.payload.selectedPickupPoint.label}
                  </p>
                </div>
                <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
                  <p className="font-medium text-foreground">Livrare</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {order.payload.selectedDropoffPoint.label}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    );
  }

  return (
    <ActiveRecipientMissionView
      order={order}
      mission={missionMatchesIdentifier ? currentMission : null}
      currentStatus={missionMatchesIdentifier ? currentStatus : null}
      activeSegment={missionMatchesIdentifier ? activeSegment : null}
      segmentProgress={missionMatchesIdentifier ? segmentProgress : 0}
    />
  );
}

type ActiveRecipientMissionViewProps = {
  order: CreatedDeliveryOrder;
  mission: Mission | null;
  currentStatus: MissionStatus | null;
  activeSegment: MissionSegment | null;
  segmentProgress: number;
};

type PublicMissionActionPanelProps = {
  order: CreatedDeliveryOrder;
  mission: Mission | null;
  currentStatus: MissionStatus | null;
};

function getPublicActionCopy(status: MissionStatus | null) {
  switch (status) {
    case "awaiting_sender_position_confirmation":
    case "awaiting_recipient_position_confirmation":
      return {
        title: "Confirmă că vezi drona",
        description: "Confirmă doar dacă drona este vizibilă la punctul corect.",
        helper: "După confirmare, drona verifică punctul de întâlnire.",
      };
    case "pickup_safety_check":
    case "dropoff_safety_check":
      return {
        title: "Drona verifică punctul de întâlnire",
        description: "PIN-ul va fi afișat după ce compartimentul este coborât.",
        helper: "Nu introduce niciun PIN pe site.",
      };
    case "locker_descending_pickup":
    case "locker_descending_dropoff":
      return {
        title: "Compartimentul coboară",
        description: "Așteaptă până când compartimentul ajunge într-o poziție accesibilă.",
        helper: "PIN-ul va fi afișat după ce compartimentul este coborât.",
      };
    case "awaiting_pickup_pin":
    case "awaiting_parcel_load":
      return {
        title: "Colet gata pentru încărcare",
        description: "Încarcă coletul în compartiment, apoi confirmă.",
        helper: "Confirmă doar după ce coletul este în compartiment.",
      };
    case "awaiting_recipient_pin":
    case "awaiting_parcel_collection":
      return {
        title: "Colet gata pentru ridicare",
        description: "Ridică coletul din compartiment, apoi confirmă.",
        helper: "Confirmă doar după ce coletul este ridicat.",
      };
    case "mission_closed":
    case "proof_generated":
    case "delivery_completed":
      return {
        title: "Livrarea a fost deja finalizată",
        description: "Nu mai este necesară nicio acțiune.",
        helper: "Comanda rămâne disponibilă pentru urmărire publică.",
      };
    case "mission_failed":
    case "fallback_required":
      return {
        title: "Livrarea are nevoie de suport",
        description: "Această acțiune nu este disponibilă în etapa curentă a livrării.",
        helper: "SkySend va gestiona pasul următor.",
      };
    default:
      return {
        title: "Stare livrare",
        description: "Această pagină permite urmărirea și finalizarea livrării folosind codul comenzii.",
        helper: "PIN-ul va fi afișat după ce compartimentul este coborât.",
      };
  }
}

function getPublicActionIcon(status: MissionStatus | null) {
  switch (status) {
    case "awaiting_sender_position_confirmation":
    case "awaiting_recipient_position_confirmation":
      return <Crosshair className="size-4" />;
    case "awaiting_pickup_pin":
    case "awaiting_recipient_pin":
    case "awaiting_parcel_load":
    case "awaiting_parcel_collection":
      return <PackageCheck className="size-4" />;
    case "pickup_safety_check":
    case "dropoff_safety_check":
    case "locker_descending_pickup":
    case "locker_descending_dropoff":
      return <ShieldCheck className="size-4" />;
    default:
      return <Clock3 className="size-4" />;
  }
}

function PublicMissionActionPanel({
  order,
  mission,
  currentStatus,
}: PublicMissionActionPanelProps) {
  const {
    pendingAction,
    confirmPickupMeetingPoint,
    rejectPickupMeetingPointAndTryNext,
    verifyPickupPin,
    confirmParcelLoaded,
    confirmDropoffMeetingPoint,
    rejectDropoffMeetingPointAndTryNext,
    verifyRecipientPin,
    confirmParcelCollected,
  } = useMissionRuntime();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = getPublicActionCopy(currentStatus);
  const isCanceled = order.fulfillmentStatus === "canceled";
  const isCompleted =
    currentStatus === "delivery_completed" ||
    currentStatus === "proof_generated" ||
    currentStatus === "mission_closed";
  const isPickupLockerOpen = currentStatus === "awaiting_parcel_load";
  const isRecipientLockerOpen =
    currentStatus === "awaiting_parcel_collection";
  const pickupPin =
    isPickupLockerOpen
      ? mission?.pins.find((pin) => pin.purpose === "pickup_verification")
      : null;
  const recipientPin =
    isRecipientLockerOpen
      ? mission?.pins.find((pin) => pin.purpose === "dropoff_verification")
      : null;
  const visiblePin = pickupPin ?? recipientPin;
  const actionLabel =
    currentStatus === "awaiting_sender_position_confirmation" ||
    currentStatus === "awaiting_recipient_position_confirmation"
      ? "Confirmă că vezi drona"
      : currentStatus === "awaiting_parcel_load"
        ? "Colet încărcat"
        : currentStatus === "awaiting_parcel_collection"
          ? "Colet ridicat"
          : null;
  const canSubmit = Boolean(actionLabel && pendingAction && mission && !isCanceled);
  const isInternalPinStep =
    currentStatus === "awaiting_pickup_pin" ||
    currentStatus === "awaiting_recipient_pin";
  const isMeetingPointDecision =
    currentStatus === "awaiting_sender_position_confirmation" ||
    currentStatus === "awaiting_recipient_position_confirmation";
  const isPickupDecision =
    currentStatus === "awaiting_sender_position_confirmation";
  const currentMeetingPoint = isPickupDecision
    ? mission?.meetingPointAttempts.pickupMeetingPoints[
        mission.meetingPointAttempts.currentPickupMeetingPointIndex
      ]
    : currentStatus === "awaiting_recipient_position_confirmation"
      ? mission?.meetingPointAttempts.dropoffMeetingPoints[
          mission.meetingPointAttempts.currentDropoffMeetingPointIndex
        ]
      : null;

  useEffect(() => {
    if (currentStatus === "awaiting_pickup_pin") {
      verifyPickupPin();
      return;
    }

    if (currentStatus === "awaiting_recipient_pin") {
      verifyRecipientPin();
    }
  }, [currentStatus, verifyPickupPin, verifyRecipientPin]);

  function runAction() {
    if (isCanceled) {
      setError("Această comandă a fost anulată.");
      return;
    }

    if (isCompleted) {
      setError("Livrarea a fost deja finalizată.");
      return;
    }

    if (!canSubmit) {
      setError("Această acțiune nu este disponibilă în etapa curentă a livrării.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

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
        setError("Această acțiune nu este disponibilă în etapa curentă a livrării.");
        break;
    }

    window.setTimeout(() => setIsSubmitting(false), 500);
  }

  return (
    <SectionCard
      eyebrow="Acțiuni publice"
      title={copy.title}
      description={copy.description}
    >
      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
            {getPublicActionIcon(currentStatus)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">{copy.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {copy.helper}
            </p>
          </div>
        </div>

        {visiblePin ? (
          <div className="grid gap-3 rounded-[calc(var(--radius)+0.625rem)] border border-primary/45 bg-primary/12 p-5 shadow-[0_18px_55px_rgba(32,231,213,0.12)]">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase text-primary">
                  PIN pentru deblocarea compartimentului
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Folosește codul pe tastatura compartimentului, apoi confirmă direct
                  {isPickupLockerOpen ? " încărcarea coletului." : " ridicarea coletului."}
                </p>
              </div>
              <span className="inline-flex min-h-16 w-full min-w-0 items-center justify-center rounded-[calc(var(--radius)+0.25rem)] border border-primary/35 bg-background px-4 font-mono text-[2rem] font-semibold tracking-[0.16em] text-foreground shadow-[var(--elevation-soft)] sm:w-auto sm:min-w-36 sm:px-5 sm:text-3xl">
                {visiblePin.code}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4 text-sm leading-6 text-muted-foreground">
            PIN-ul va fi afișat după ce compartimentul este coborât.
          </div>
        )}

        {error ? (
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-destructive/30 bg-destructive/8 p-4 text-sm leading-6 text-destructive">
            {error}
          </div>
        ) : null}

        {isMeetingPointDecision ? (
          <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-primary/25 bg-primary/10 p-4">
            <div>
              <p className="font-medium text-foreground">
                {isPickupDecision
                  ? "Drona a ajuns la punctul de ridicare"
                  : "Drona a ajuns la punctul de livrare"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Confirmă că vezi drona și că punctul de întâlnire este potrivit
                pentru coborârea compartimentului.
              </p>
            </div>
            {currentMeetingPoint ? (
              <p className="rounded-[var(--radius)] border border-border/80 bg-background p-3 text-sm leading-6 text-muted-foreground">
                {currentMeetingPoint.label} ·{" "}
                {currentMeetingPoint.distanceFromSelectedAddressMeters} m față de
                adresa selectată
              </p>
            ) : null}
            <AppButton
              type="button"
              onClick={runAction}
              disabled={!canSubmit || isSubmitting}
              className="min-h-[3.25rem] w-full px-4 py-3"
            >
              <CheckCircle2 className="size-4" />
              Confirm că văd drona și locul este potrivit
            </AppButton>
            <AppButton
              type="button"
              variant="outline"
              onClick={
                isPickupDecision
                  ? rejectPickupMeetingPointAndTryNext
                  : rejectDropoffMeetingPointAndTryNext
              }
              disabled={!mission || isSubmitting}
              className="min-h-[3.25rem] w-full px-4 py-3"
            >
              <Crosshair className="size-4" />
              Locul nu este potrivit. Încearcă următorul punct
            </AppButton>
          </div>
        ) : actionLabel && !isInternalPinStep ? (
          <AppButton
            type="button"
            onClick={runAction}
            disabled={!canSubmit || isSubmitting}
            className="min-h-[3.25rem] w-full px-4 py-3 sm:w-fit"
          >
            {getPublicActionIcon(currentStatus)}
            {isSubmitting ? "Se confirmă" : actionLabel}
          </AppButton>
        ) : null}
      </div>
    </SectionCard>
  );
}

function ActiveRecipientMissionView({
  order,
  mission,
  currentStatus,
  activeSegment,
  segmentProgress,
}: ActiveRecipientMissionViewProps) {
  const isOrderCanceled = order.fulfillmentStatus === "canceled";
  const publicStatusLabel = isOrderCanceled
    ? "Comandă anulată"
    : getPublicRecipientStatusLabel(currentStatus);
  const etaSeconds = getRemainingDropoffSeconds({
    currentStatus,
    activeSegment,
    segmentProgress,
    missionSegments: mission?.segments ?? [],
    finalizedDeliveryDelaySeconds:
      (mission?.etaTiming?.pickupMeetingPointDelaySeconds ?? 0) +
      (mission?.etaTiming?.parcelLoadDelaySeconds ?? 0),
  });
  const etaLabel = isOrderCanceled
    ? "Anulată"
    : mission || currentStatus
      ? formatEta(etaSeconds)
      : `${order.payload.estimatedEta.minMinutes}-${order.payload.estimatedEta.maxMinutes} min`;
  const currentStepIndex = getProgressIndex(currentStatus);
  const progressPercent = deliveredStatuses.includes(
    currentStatus ?? "mission_created",
  )
    ? 100
    : Math.max(12, Math.round(((currentStepIndex + 1) / progressSteps.length) * 100));
  const trackingCode = order.publicTrackingCode
    ? normalizePublicTrackingCode(order.publicTrackingCode)
    : "Cod comandă";
  const description = currentStatus
    ? missionStatusDescriptions[currentStatus]
    : isOrderCanceled
      ? "Această livrare a fost anulată înainte de lansare."
      : "Livrarea este pregătită pentru urmărirea publică.";
  const isPickupFallback =
    mission?.failureReason === "no_suitable_pickup_meeting_point" ||
    order.fallbackOutcome === "no_suitable_pickup_meeting_point";
  const isDropoffFallback =
    mission?.failureReason === "no_suitable_dropoff_meeting_point" ||
    order.fallbackOutcome === "delivery_failed_return_required";
  const isFallbackFinal =
    isPickupFallback ||
    isDropoffFallback ||
    currentStatus === "returning_to_hub" ||
    currentStatus === "returned_to_hub";

  return (
    <>
      {!isFallbackFinal && !isOrderCanceled ? (
        <section className="relative isolate h-dvh min-h-dvh overflow-hidden bg-background lg:hidden">
          <LiveMissionMap
            presentation="frameless"
            showMapOverlay={false}
            className="absolute inset-0"
            mapClassName="map-surface--premium h-full min-h-full"
            fallbackPickup={{
              label: order.payload.selectedPickupPoint.label,
              point: order.payload.selectedPickupPoint.location,
            }}
            fallbackDropoff={{
              label: order.payload.selectedDropoffPoint.label,
              point: order.payload.selectedDropoffPoint.location,
            }}
          />

          <div className="pointer-events-none absolute inset-x-3 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-20 grid gap-2">
            <div className="pointer-events-auto rounded-[calc(var(--radius)+0.55rem)] border border-white/12 bg-background/84 p-3 shadow-[var(--elevation-soft)] backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge label="Urmărire publică" tone="info" />
                <StatusBadge
                  label={publicStatusLabel}
                  tone={
                    deliveredStatuses.includes(currentStatus ?? "mission_created")
                      ? "success"
                      : "neutral"
                  }
                />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                    ETA livrare
                  </p>
                  <p className="mt-1 truncate font-heading text-3xl tracking-tight text-foreground">
                    {etaLabel}
                  </p>
                </div>
                <p className="max-w-[9rem] truncate rounded-full border border-border/80 bg-secondary/70 px-3 py-1.5 font-mono text-xs font-semibold tracking-normal text-foreground">
                  {trackingCode}
                </p>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 max-h-[58svh] overflow-y-auto overscroll-contain px-3 pt-4 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] [scrollbar-gutter:stable]">
            <div className="pointer-events-auto rounded-t-[1.35rem] border border-border/80 bg-background/92 p-3.5 shadow-[var(--elevation-panel)] backdrop-blur-md min-[360px]:p-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border/90" aria-hidden="true" />
              <div className="grid gap-4">
                <PublicMissionActionPanel
                  order={order}
                  mission={mission}
                  currentStatus={currentStatus}
                />

                <details className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card/82 p-4">
                  <summary className="cursor-pointer list-none font-medium text-foreground">
                    Cronologie livrare
                  </summary>
                  <div className="mt-4 grid gap-3">
                    {progressSteps.map((step, index) => {
                      const isComplete = index < currentStepIndex;
                      const isActivee = index === currentStepIndex;
                      const isLivrată =
                        step.label === "Livrat" &&
                        deliveredStatuses.includes(currentStatus ?? "mission_created");

                      return (
                        <div
                          key={step.label}
                          className="flex items-start gap-3 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/35 p-3"
                        >
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
                            {isComplete || isLivrată ? (
                              <CheckCircle2 className="size-4 text-success" />
                            ) : (
                              <Clock3
                                className={
                                  isActivee
                                    ? "size-4 text-primary"
                                    : "size-4 text-muted-foreground"
                                }
                              />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{step.label}</p>
                              {isActivee ? <StatusBadge label="Acum" tone="info" /> : null}
                              {isComplete || isLivrată ? (
                                <StatusBadge label="Finalizat" tone="success" />
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {isActivee
                                ? "Aceasta este etapa publică activă."
                                : isComplete || isLivrată
                                  ? "Această etapă a fost finalizată."
                                  : "Această etapă urmează."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className={
          !isFallbackFinal && !isOrderCanceled
            ? "app-container hidden flex-col gap-5 py-6 md:gap-6 md:py-10 lg:flex"
            : "app-container flex flex-col gap-5 py-6 md:gap-6 md:py-10"
        }
      >
      <div className="grid gap-4 rounded-[calc(var(--radius)+0.75rem)] border border-border bg-card p-4 shadow-[var(--elevation-soft)] md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.34fr)] md:items-stretch md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Urmărire publică" tone="info" />
            <StatusBadge
              label={publicStatusLabel}
              tone={
                isOrderCanceled
                  ? "warning"
                  : deliveredStatuses.includes(currentStatus ?? "mission_created")
                    ? "success"
                    : "neutral"
              }
            />
          </div>
          <h1 className="mt-4 font-heading text-3xl tracking-tight text-foreground md:text-5xl">
            Urmărire live SkySend
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Progres public pentru codul de comandă primit. Datele private despre
            expeditor, destinatar, plată și cont sunt ascunse.
          </p>
          <p className="mt-4 w-fit max-w-full truncate rounded-full border border-border/80 bg-secondary/70 px-3 py-1.5 font-mono text-sm font-semibold tracking-normal text-foreground">
            {trackingCode}
          </p>
        </div>

        <div className="grid content-center gap-2 rounded-[calc(var(--radius)+0.375rem)] border border-primary/25 bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Clock3 className="size-4" />
            ETA livrare
          </div>
          <p className="font-heading text-4xl tracking-tight text-foreground md:text-5xl">
            {etaLabel}
          </p>
        </div>
      </div>

      {isDropoffFallback ? (
        <div className="grid gap-4">
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-primary/25 bg-primary/10 p-5">
            <p className="font-medium text-foreground">
              Drona se întoarce la centrul operațional cu coletul în compartiment.
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Coletul te așteaptă la centrul operațional SkySend și poate fi ridicat de acolo.
            </p>
          </div>
          <HubLockerRecoveryMap />
        </div>
      ) : !isFallbackFinal && !isOrderCanceled ? (
        <LiveMissionMap
          className="min-h-[26rem] sm:min-h-[34rem] xl:min-h-[44rem]"
          mapClassName="min-h-[24rem] sm:min-h-[30rem] md:min-h-[38rem] xl:min-h-[42rem]"
          fallbackPickup={{
            label: order.payload.selectedPickupPoint.label,
            point: order.payload.selectedPickupPoint.location,
          }}
          fallbackDropoff={{
            label: order.payload.selectedDropoffPoint.label,
            point: order.payload.selectedDropoffPoint.location,
          }}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="grid gap-5">
          <SectionCard
            eyebrow="Stare"
            title={publicStatusLabel}
            description={description}
          >
            <div className="grid gap-4">
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Plane className="size-4" />
                  Stare livrare
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {mission
                    ? "Starea se actualizează cât timp livrarea este activă."
                    : "Urmărirea se actualizează după confirmarea plății și lansare."}
                </p>
              </div>

              <div className="grid gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Ridicare</p>
                  <p className="mt-1 truncate font-medium text-foreground">
                    {order.payload.selectedPickupPoint.label}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Livrare</p>
                  <p className="mt-1 truncate font-medium text-foreground">
                    {order.payload.selectedDropoffPoint.label}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Configurație</p>
                  <p className="mt-1 font-medium text-foreground">
                    {getDeliveryConfigurationSummary(order.payload)}
                  </p>
                </div>
              </div>

              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Route className="size-4" />
                    Progres livrare
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {progressPercent}%
                  </span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <PublicMissionActionPanel
            order={order}
            mission={mission}
            currentStatus={currentStatus}
          />
        </div>

        <SectionCard
          eyebrow="Progres"
          title="Cronologie livrare"
          description="Sunt afișate doar etapele publice ale livrării."
        >
          <div className="grid gap-3">
            {progressSteps.map((step, index) => {
              const isComplete = index < currentStepIndex;
              const isActivee = index === currentStepIndex;
              const isLivrată =
                step.label === "Livrat" &&
                deliveredStatuses.includes(currentStatus ?? "mission_created");

              return (
                <div
                  key={step.label}
                  className="flex items-start gap-3 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/35 p-3"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground">
                    {isComplete || isLivrată ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <Clock3
                        className={
                          isActivee ? "size-4 text-primary" : "size-4 text-muted-foreground"
                        }
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{step.label}</p>
                      {isActivee ? <StatusBadge label="Acum" tone="info" /> : null}
                      {isComplete || isLivrată ? (
                        <StatusBadge label="Finalizat" tone="success" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {isActivee
                        ? "Aceasta este etapa publică activă."
                        : isComplete || isLivrată
                          ? "Această etapă a fost finalizată."
                          : "Această etapă urmează."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
      </section>
    </>
  );
}

