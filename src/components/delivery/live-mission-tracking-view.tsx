"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  CreditCard,
  FileCheck2,
  MapPinned,
  Package2,
  Plane,
  Route,
  XCircle,
} from "lucide-react";
import {
  HubLockerRecoveryMap,
  LiveMissionMap,
} from "@/components/mission/live-mission-map";
import { MissionActionPanel } from "@/components/mission/mission-action-panel";
import { MissionTimeline } from "@/components/mission/mission-timeline";
import { MissionBrief } from "@/components/mission/mission-brief";
import { MobileMissionDrawer } from "@/components/mission/mobile-mission-drawer";
import {
  isProofOfDeliveryReady,
  ProofOfDelivery,
} from "@/components/mission/proof-of-delivery";
import { RecipientTrackingLinkCard } from "@/components/recipient/recipient-tracking-link-card";
import { RepeatDeliveryButton } from "@/components/delivery/repeat-delivery-button";
import { PremiumTrackingWorkspace } from "@/components/delivery/premium-tracking-workspace";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { AppButton } from "@/components/shared/app-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import { updateCreatedDeliveryOrderFulfillment } from "@/lib/create-delivery-submit";
import {
  getPaidOrderMissionDispatchStartMs,
  missionDispatchDelaySeconds,
} from "@/lib/mission-runtime";
import {
  formatScheduledDeliveryCountdown,
  formatScheduledDeliveryDate,
  getScheduledDeliveryStartMs,
  isScheduledDeliveryWaiting,
} from "@/lib/scheduled-delivery";
import {
  notifyDeliveryCompleted,
  notifyMissionStatus,
  notifyOrderCancelled,
} from "@/lib/notification-events";
import type {
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
} from "@/types/create-delivery";
import type { MissionStatus } from "@/types/mission";

type LiveMissionTrackingViewProps = {
  order: CreatedDeliveryOrder;
  statusLabel: string;
  urgencyLabel: string;
  priceLabel: string;
  etaLabel: string;
  paymentLabel: string;
  parcelSummary: string;
  droneSummary: string;
  outcomeSummary?: string | null;
  startOnMount?: boolean;
  paymentStatus?: CreatedDeliveryPaymentStatus;
  checkoutHref?: string;
};

const paymentStatusLabels: Record<CreatedDeliveryPaymentStatus, string> = {
  unpaid: "Neplătită",
  processing: "În procesare",
  paid: "Plătită",
  failed: "Eșuată",
  refunded: "Rambursată",
  refund_pending: "Rambursare în curs",
};

function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function getPaymentTone(status: CreatedDeliveryPaymentStatus) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "failed":
    case "refunded":
    case "refund_pending":
      return "destructive" as const;
    case "processing":
      return "info" as const;
    default:
      return "warning" as const;
  }
}

function getPaymentGateCopy(status: CreatedDeliveryPaymentStatus) {
  switch (status) {
    case "processing":
      return {
        title: "Plata este în procesare",
        description:
          "SkySend așteaptă confirmarea plății cu cardul înainte de dispatch.",
        action: "Finalizează plata",
      };
    case "failed":
      return {
        title: "Plată eșuată",
        description:
          "Dispatch-ul nu a pornit. Reîncearcă plata pentru a debloca livrarea.",
        action: "Reîncearcă plata",
      };
    case "refunded":
      return {
        title: "Plată rambursată",
        description:
          "Dispatch-ul este blocat deoarece plata a fost rambursată.",
        action: "Verifică plata",
      };
    case "refund_pending":
      return {
        title: "Rambursare în curs",
        description:
          "Livrarea a fost oprită și rambursarea este marcată În așteptare.",
        action: "Verifică plata",
      };
    default:
      return {
        title: "Plată necesară înainte de dispatch",
        description:
          "Finalizează plata cu cardul înainte ca SkySend să pornească livrarea live.",
        action: "Finalizează plata",
      };
  }
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

const deliveredStatuses: MissionStatus[] = [
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];

function getSegmentRemainingSeconds({
  durationSeconds,
  progress,
}: {
  durationSeconds?: number | null;
  progress: number;
}) {
  return Math.max(0, Math.round((durationSeconds ?? 0) * (1 - progress)));
}

function getFallbackReasonLabel(
  order: CreatedDeliveryOrder,
  mission?: { events?: { title: string; description?: string }[] } | null,
) {
  if (order.fallbackReason) {
    return order.fallbackReason;
  }

  const event = [...(mission?.events ?? [])]
    .reverse()
    .find(
      (item) =>
        item.title.includes("deoarece") ||
        item.description?.includes("10 minute"),
    );

  return event?.title ?? null;
}

function formatClockSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function formatArrivalClock(secondsFromNow: number) {
  const safeSeconds = Math.max(0, Math.round(secondsFromNow));
  const arrivalDate = new Date(Date.now() + safeSeconds * 1000);
  const hours = arrivalDate.getHours();
  const minutes = arrivalDate.getMinutes();
  const seconds = arrivalDate.getSeconds();

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatEtaClock(baseSeconds: number, delaySeconds: number) {
  const baseLabel = formatArrivalClock(baseSeconds);

  return delaySeconds > 0
    ? `${baseLabel} (+${formatClockSeconds(delaySeconds)})`
    : baseLabel;
}

function getSegmentDurationSeconds(
  segment?: { plannedDurationSeconds?: number | null } | null,
) {
  return Math.max(0, Math.round(segment?.plannedDurationSeconds ?? 0));
}

function LiveActionTimerCard({
  remainingSeconds,
  timer,
}: {
  remainingSeconds: number;
  timer: NonNullable<ReturnType<typeof useMissionRuntime>["userActionTimer"]>;
}) {
  return (
    <div className="rounded-[var(--ui-radius-panel)] border border-primary/30 bg-primary/10 p-4 shadow-[var(--elevation-soft)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Clock3 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">{timer.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {timer.actionLabel}
            </p>
          </div>
        </div>
        <StatusBadge label="10 minute" tone="warning" />
      </div>

      <div className="mt-4 rounded-[calc(var(--radius)+0.375rem)] border border-border/70 bg-background/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Timp ramas
        </p>
        <p className="mt-2 font-heading text-4xl tracking-tight text-foreground sm:text-5xl">
          {formatClockSeconds(remainingSeconds)}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {timer.helperText} {timer.expiryText}
        </p>
      </div>
    </div>
  );
}

export function LiveMissionTrackingView({
  order,
  priceLabel,
  etaLabel,
  paymentLabel,
  parcelSummary,
  droneSummary,
  outcomeSummary,
  startOnMount = true,
  paymentStatus = "paid",
  checkoutHref,
}: LiveMissionTrackingViewProps) {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const [shouldShowMissionBrief, setShouldShowMissionBrief] = useState(
    () => searchParams.get("brief") === "1",
  );
  const [isOrderCanceled, setIsOrderCanceled] = useState(
    () => order.fulfillmentStatus === "canceled",
  );
  const [isCancellingBeforeDispatch, setIsCancellingBeforeDispatch] = useState(false);
  const [scheduledNowMs, setScheduledNowMs] = useState(() => Date.now());
  const [userActionNowMs, setUserActionNowMs] = useState(() => Date.now());
  const isWaitingForScheduledStart = isScheduledDeliveryWaiting(
    order,
    scheduledNowMs,
  );
  const scheduledStartMs = getScheduledDeliveryStartMs(order);
  const scheduledDateLabel = formatScheduledDeliveryDate(
    order.payload.scheduledAt,
  );
  const scheduledCountdownLabel =
    isWaitingForScheduledStart && scheduledStartMs !== null
      ? formatScheduledDeliveryCountdown(scheduledStartMs - scheduledNowMs)
      : null;
  const [dispatchCountdown, setDispatchCountdown] = useState(() =>
    paymentStatus === "paid" &&
    startOnMount &&
    !isScheduledDeliveryWaiting(order) &&
    order.fulfillmentStatus !== "completed_mission" &&
    order.fulfillmentStatus !== "failed_mission" &&
    order.fulfillmentStatus !== "fallback_required" &&
    order.fulfillmentStatus !== "canceled"
      ? Math.max(
          0,
          Math.ceil(
            ((getPaidOrderMissionDispatchStartMs(order) ??
              Date.now() + missionDispatchDelaySeconds * 1000) -
              Date.now()) /
              1000,
          ),
        )
      : 0,
  );
  const notifiedMissionStatusesRef = useRef(new Set<MissionStatus>());
  const hasNotifiedDeliveryCompletedRef = useRef(false);
  const {
    currentMission,
    currentStatus,
    activeSegment,
    segmentProgress,
    isMissionRunning,
    isRehydrating,
    userActionTimer,
    createMissionFromOrder,
    startMission,
    syncPaidCreatedDeliveryOrderMission,
    resetMission,
  } = useMissionRuntime();
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {

    const tShow = window.setTimeout(() => setShowSkeleton(isRehydrating), 0);
    if (!isRehydrating) {
      return () => window.clearTimeout(tShow);
    }
    const tHide = window.setTimeout(() => setShowSkeleton(false), 3000);
    return () => {
      window.clearTimeout(tShow);
      window.clearTimeout(tHide);
    };
  }, [isRehydrating]);
  const recipientMissionId =
    currentMission?.sourceOrderId === order.id ? currentMission.id : null;
  const isPaymentPaid = paymentStatus === "paid";
  const isCancelWindowOpen =
    isPaymentPaid &&
    startOnMount &&
    !isOrderCanceled &&
    !isWaitingForScheduledStart &&
    dispatchCountdown > 0 &&
    !isMissionRunning &&
    currentStatus !== "drone_dispatched";
  const effectiveCheckoutHref = checkoutHref ?? "/client/create-delivery?checkout=moved";
  const pricingSnapshot = order.payload.pricingSnapshot;
  const pickupSegment = currentMission?.segments.find(
    (segment) => segment.type === "warehouse_to_pickup",
  );
  const dropoffSegment = currentMission?.segments.find(
    (segment) => segment.type === "pickup_to_dropoff",
  );
  const userActionStartedMs = userActionTimer
    ? Date.parse(userActionTimer.startedAt)
    : null;
  const userActionExpiresMs = userActionTimer
    ? Date.parse(userActionTimer.expiresAt)
    : null;
  const userActionElapsedSeconds =
    userActionStartedMs !== null && !Number.isNaN(userActionStartedMs)
      ? Math.max(0, Math.floor((userActionNowMs - userActionStartedMs) / 1000))
      : 0;
  const userActionRemainingSeconds =
    userActionExpiresMs !== null && !Number.isNaN(userActionExpiresMs)
      ? Math.max(0, Math.ceil((userActionExpiresMs - userActionNowMs) / 1000))
      : 0;
  const isDeliveryEtaDelayTimer =
    userActionTimer?.kind === "pickup_meeting_point" ||
    userActionTimer?.kind === "parcel_load";
  const currentDeliveryEtaDelaySeconds = isDeliveryEtaDelayTimer
    ? userActionElapsedSeconds
    : 0;
  const finalizedDeliveryDelaySeconds =
    (currentMission?.etaTiming?.pickupMeetingPointDelaySeconds ?? 0) +
    (currentMission?.etaTiming?.parcelLoadDelaySeconds ?? 0);
  const isDeliveryCompleted = Boolean(
    currentStatus && deliveredStatuses.includes(currentStatus),
  );
  const isPickupReached = Boolean(
    currentStatus && pickupReachedStatuses.includes(currentStatus),
  );
  const isDropoffReached = Boolean(
    currentStatus && dropoffReachedStatuses.includes(currentStatus),
  );
  const pickupSegmentRemainingSeconds =
    activeSegment?.type === "warehouse_to_pickup"
      ? getSegmentRemainingSeconds({
          durationSeconds: activeSegment.plannedDurationSeconds,
          progress: segmentProgress,
        })
      : currentStatus && pickupReachedStatuses.includes(currentStatus)
        ? 0
        : getSegmentDurationSeconds(pickupSegment);
  const dropoffSegmentRemainingSeconds =
    activeSegment?.type === "pickup_to_dropoff"
      ? getSegmentRemainingSeconds({
          durationSeconds: activeSegment.plannedDurationSeconds,
          progress: segmentProgress,
        })
      : currentStatus && dropoffReachedStatuses.includes(currentStatus)
        ? 0
        : getSegmentDurationSeconds(dropoffSegment);
  const deliveryBaseRemainingSeconds = isDropoffReached
    ? 0
    : activeSegment?.type === "pickup_to_dropoff"
      ? dropoffSegmentRemainingSeconds
      : activeSegment?.type === "warehouse_to_pickup"
        ? pickupSegmentRemainingSeconds +
          getSegmentDurationSeconds(dropoffSegment) +
          finalizedDeliveryDelaySeconds
        : isPickupReached
          ? dropoffSegmentRemainingSeconds + finalizedDeliveryDelaySeconds
          : getSegmentDurationSeconds(pickupSegment) +
            getSegmentDurationSeconds(dropoffSegment) +
            finalizedDeliveryDelaySeconds;
  const pickupEta = currentStatus
    ? isPickupReached
        ? {
            label: "Colet ridicat",
            detail: "Drona a ajuns la punctul de ridicare",
            tone: "success" as const,
          }
        : {
            label: formatArrivalClock(pickupSegmentRemainingSeconds),
            detail:
              activeSegment?.type === "warehouse_to_pickup"
                ? "Drona se îndreaptă spre ridicare"
                : "Așteaptă dispatch",
            tone: "info" as const,
          }
    : {
        label: formatArrivalClock(getSegmentDurationSeconds(pickupSegment)),
        detail: "Pregătește traseul",
        tone: "neutral" as const,
      };
  const deliveryEta = currentStatus
    ? isDeliveryCompleted
      ? {
          label: "Livrată",
          detail: order.payload.selectedDropoffPoint.label,
          tone: "success" as const,
        }
      : isDropoffReached
        ? {
            label: "Ajunsa la livrare",
            detail: "Drona a ajuns la punctul de livrare",
            tone: "success" as const,
          }
      : {
          label: formatEtaClock(
            deliveryBaseRemainingSeconds,
            currentDeliveryEtaDelaySeconds,
          ),
          detail: isDeliveryEtaDelayTimer
            ? "Întârziere operațională la ridicare"
            : activeSegment?.type === "pickup_to_dropoff"
              ? "Drona zboară spre destinatar"
              : "Include zborul spre ridicare și livrare",
          tone: isDeliveryEtaDelayTimer
            ? ("warning" as const)
            : ("info" as const),
        }
    : {
        label: formatEtaClock(
          getSegmentDurationSeconds(pickupSegment) +
            getSegmentDurationSeconds(dropoffSegment) +
            finalizedDeliveryDelaySeconds,
          currentDeliveryEtaDelaySeconds,
        ),
        detail: "Pregătește traseul",
        tone: "neutral" as const,
      };
  const shouldShowProof =
    currentMission?.sourceOrderId === order.id &&
    isProofOfDeliveryReady(currentStatus);

  const handleCancelOrder = async () => {
    if (isCancellingBeforeDispatch) return;
    setIsCancellingBeforeDispatch(true);
    try {
      const response = await fetch(`/api/client/orders/${encodeURIComponent(order.id)}/cancel-before-dispatch`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "cancel_failed");
      setIsOrderCanceled(true);
      setDispatchCountdown(0);
      resetMission();
      notifyOrderCancelled(order, {
        userId: user?.id ?? null,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
      });
    } finally {
      setIsCancellingBeforeDispatch(false);
    }
  };

  useEffect(() => {
    if (!isWaitingForScheduledStart) {
      return;
    }

    const interval = window.setInterval(() => setScheduledNowMs(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [isWaitingForScheduledStart]);

  useEffect(() => {
    if (
      !isPaymentPaid ||
      isWaitingForScheduledStart ||
      isOrderCanceled ||
      dispatchCountdown > 0 ||
      isMissionRunning ||
      currentStatus === "drone_dispatched"
    ) return;
    const dispatchStartMs = getPaidOrderMissionDispatchStartMs(order);
    if (dispatchStartMs === null) return;
    const remaining = Math.max(0, Math.ceil((dispatchStartMs - Date.now()) / 1000));
    if (remaining <= 0) return;
    const timeout = window.setTimeout(() => setDispatchCountdown(remaining), 0);
    return () => window.clearTimeout(timeout);
  }, [
    currentStatus,
    dispatchCountdown,
    isMissionRunning,
    isOrderCanceled,
    isPaymentPaid,
    isWaitingForScheduledStart,
    order,
  ]);

  useEffect(() => {
    if (!userActionTimer) {
      return;
    }

    const interval = window.setInterval(() => setUserActionNowMs(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [userActionTimer]);

  useEffect(() => {
    if (!isPaymentPaid || isOrderCanceled || isWaitingForScheduledStart) {
      return;
    }

    if (dispatchCountdown > 0) {
      return;
    }

    const syncedSnapshot = syncPaidCreatedDeliveryOrderMission(order, {
      isLiveTrackingVisible: true,
    });

    if (syncedSnapshot.currentMission?.sourceOrderId === order.id) {
      return;
    }

    if (currentMission?.sourceOrderId === order.id) {
      if (
        startOnMount &&
        !shouldShowMissionBrief &&
        dispatchCountdown <= 0 &&
        !isMissionRunning &&
        currentStatus !== "mission_closed"
      ) {
        startMission();
      }

      return;
    }

    createMissionFromOrder(order);
  }, [
    createMissionFromOrder,
    currentMission?.sourceOrderId,
    currentStatus,
    dispatchCountdown,
    isPaymentPaid,
    isMissionRunning,
    isOrderCanceled,
    isWaitingForScheduledStart,
    order,
    shouldShowMissionBrief,
    startMission,
    startOnMount,
    syncPaidCreatedDeliveryOrderMission,
  ]);

  useEffect(() => {
    if (!currentStatus || currentMission?.sourceOrderId !== order.id) {
      return;
    }

    if (notifiedMissionStatusesRef.current.has(currentStatus)) {
      return;
    }

    if (
      currentStatus === "preflight_checks" ||
      currentStatus === "arrived_at_pickup" ||
      currentStatus === "parcel_secured" ||
      currentStatus === "en_route_to_dropoff" ||
      currentStatus === "arrived_at_dropoff"
    ) {
      notifyMissionStatus({
        order,
        status: currentStatus,
        droneLabel: droneSummary,
        context: {
          userId: user?.id ?? null,
          email: user?.primaryEmailAddress?.emailAddress ?? null,
        },
      });
      notifiedMissionStatusesRef.current.add(currentStatus);
    }
  }, [
    currentMission?.sourceOrderId,
    currentStatus,
    droneSummary,
    order,
    user?.id,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  useEffect(() => {
    if (
      hasNotifiedDeliveryCompletedRef.current ||
      currentMission?.sourceOrderId !== order.id ||
      !isProofOfDeliveryReady(currentStatus)
    ) {
      return;
    }

    notifyDeliveryCompleted(order, {
      userId: user?.id ?? null,
      email: user?.primaryEmailAddress?.emailAddress ?? null,
    });
    hasNotifiedDeliveryCompletedRef.current = true;
  }, [
    currentMission?.sourceOrderId,
    currentStatus,
    order,
    user?.id,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  useEffect(() => {
    if (
      !isPaymentPaid ||
      !startOnMount ||
      !shouldShowMissionBrief ||
      isOrderCanceled ||
      isWaitingForScheduledStart
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShouldShowMissionBrief(false);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [
    isOrderCanceled,
    isPaymentPaid,
    isWaitingForScheduledStart,
    shouldShowMissionBrief,
    startOnMount,
  ]);

  useEffect(() => {
    if (!isCancelWindowOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDispatchCountdown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [dispatchCountdown, isCancelWindowOpen]);

  useEffect(() => {
    if (
      !isPaymentPaid ||
      isOrderCanceled ||
      isWaitingForScheduledStart ||
      dispatchCountdown > 0 ||
      !currentMission ||
      currentMission.sourceOrderId !== order.id
    ) {
      return;
    }

    if (isProofOfDeliveryReady(currentStatus)) {
      updateCreatedDeliveryOrderFulfillment({
        orderId: order.id,
        fulfillmentStatus: "completed_mission",
        missionId: currentMission.id,
        missionStatus: currentStatus,
        completedAt:
          currentMission.closedAt ??
          currentMission.completedAt ??
          currentMission.updatedAt,
      });
      return;
    }

    if (currentStatus === "mission_failed") {
      updateCreatedDeliveryOrderFulfillment({
        orderId: order.id,
        fulfillmentStatus: "failed_mission",
        missionId: currentMission.id,
        missionStatus: currentStatus,
      });
      return;
    }

    if (currentStatus === "fallback_required") {
      updateCreatedDeliveryOrderFulfillment({
        orderId: order.id,
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
        orderId: order.id,
        fulfillmentStatus: "failed_mission",
        missionId: currentMission.id,
        missionStatus: currentStatus,
      });
      return;
    }

    updateCreatedDeliveryOrderFulfillment({
      orderId: order.id,
      fulfillmentStatus: "active_mission",
      missionId: currentMission.id,
      missionStatus: currentStatus,
    });
  }, [
    currentMission,
    currentStatus,
    dispatchCountdown,
    isOrderCanceled,
    isPaymentPaid,
    isWaitingForScheduledStart,
    order.id,
  ]);

  if (
    order.fulfillmentStatus === "failed_mission" ||
    order.fulfillmentStatus === "completed_mission"
  ) {
    return (
      <PremiumTrackingWorkspace
        order={order}
        paymentStatus={paymentStatus}
      />
    );
  }

  if (!isPaymentPaid) {
    const paymentCopy = getPaymentGateCopy(paymentStatus);

    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
        eyebrow="Urmărire comandă"
          title={order.id}
          description="Dispatch-ul misiunii este blocat până la confirmarea plății."
          actions={[
            {
              label: "Înapoi la comenzi",
              href: "/client/orders",
              variant: "ghost",
              icon: <ArrowLeft className="size-4" />,
            },
          ]}
        />

        <SectionCard
          eyebrow="Plată"
          title={paymentCopy.title}
          description={paymentCopy.description}
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div>
                <p className="font-medium text-foreground">Status plată</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {paymentLabel}. Dispatch-ul pornește automat după confirmarea
                  plății.
                </p>
              </div>
              <StatusBadge
                label={paymentStatusLabels[paymentStatus]}
                tone={getPaymentTone(paymentStatus)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
                <div className="flex items-center gap-3">
                  <Package2 className="size-4 text-foreground" />
                  <p className="font-medium text-foreground">Colet</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {parcelSummary}
                </p>
              </div>
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
                <div className="flex items-center gap-3">
                  <Route className="size-4 text-foreground" />
                  <p className="font-medium text-foreground">Traseu</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {order.payload.pickupAddress.formattedAddress}
                  <br />
                  {order.payload.dropoffAddress.formattedAddress}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <AppButton asChild size="lg" className="w-full sm:w-fit">
                <Link href={effectiveCheckoutHref}>
                  <CreditCard className="size-4" />
                  {paymentCopy.action}
                </Link>
              </AppButton>
              <RepeatDeliveryButton
                order={order}
                size="lg"
                className="w-full sm:w-fit"
              />
              <AppButton asChild variant="outline" size="lg" className="w-full sm:w-fit">
                <Link href="/client/orders">Înapoi la comenzi</Link>
              </AppButton>
            </div>
          </div>
        </SectionCard>
      </section>
    );
  }

  if (isOrderCanceled) {
    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
        eyebrow="Urmărire comandă"
          title={order.id}
          description="Dispatch-ul nu a pornit pentru această comandă."
          actions={[
            {
              label: "Înapoi la comenzi",
              href: "/client/orders",
              variant: "ghost",
              icon: <ArrowLeft className="size-4" />,
            },
          ]}
        />

        <SectionCard
          eyebrow="Comandă"
          title="Comandă anulată"
          description="Comanda a fost oprită înainte de dispatch-ul dronei."
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div>
                <p className="font-medium text-foreground">Dispatch nepornit</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Plata rămâne atașată comenzii. Nicio dronă nu a
                  plecat din hub.
                </p>
              </div>
              <StatusBadge label="Anulată" tone="warning" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AppButton asChild size="lg" className="w-full sm:w-fit">
                <Link href="/client/create-delivery">Creează livrare</Link>
              </AppButton>
              <RepeatDeliveryButton
                order={order}
                size="lg"
                className="w-full sm:w-fit"
              />
              <AppButton
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-fit"
              >
                <Link href="/client/orders">Înapoi la comenzi</Link>
              </AppButton>
            </div>
          </div>
        </SectionCard>
      </section>
    );
  }

  if (isWaitingForScheduledStart) {
    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
          eyebrow="Livrare programată"
          title={order.id}
          description="Comanda este confirmată, iar dispatch-ul live va începe automat la ora programată."
          actions={[
            {
              label: "Înapoi la comenzi",
              href: "/client/orders",
              variant: "ghost",
              icon: <ArrowLeft className="size-4" />,
            },
          ]}
        />

        <SectionCard
          eyebrow="În așteptare"
          title="Livrarea este programată"
          description="SkySend păstrează comanda activă, dar nu pornește simularea dronei înainte de ora aleasă."
        >
          <div className="grid gap-4">
            <div className="rounded-[calc(var(--radius)+0.5rem)] border border-primary/30 bg-primary/10 p-5 shadow-[var(--elevation-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <CalendarClock className="size-5" />
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
                <StatusBadge label="Programată" tone="info" />
              </div>

              <div className="mt-5 rounded-[calc(var(--radius)+0.375rem)] border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  Countdown până la dispatch
                </p>
                <p className="mt-2 font-heading text-4xl tracking-tight text-foreground sm:text-5xl">
                  {scheduledCountdownLabel ?? "0m 0s"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Livrarea începe automat la ora programată. Până atunci nu
                  afișăm ETA live și nu pornim runtime-ul misiunii.
                </p>
              </div>
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <AppButton
                type="button"
                variant="outline"
                size="lg"
                onClick={handleCancelOrder}
                className="w-full sm:w-fit"
              >
                <XCircle className="size-4" />
                Anulează comanda
              </AppButton>
              <RepeatDeliveryButton
                order={order}
                size="lg"
                className="w-full sm:w-fit"
              />
            </div>
          </div>
        </SectionCard>
      </section>
    );
  }

  if (isCancelWindowOpen) {
    return (
      <PremiumTrackingWorkspace
        order={order}
        paymentStatus={paymentStatus}
        dispatchCountdown={dispatchCountdown}
        onCancelBeforeDispatch={handleCancelOrder}
        isCancellingBeforeDispatch={isCancellingBeforeDispatch}
      />
    );
  }

  const isPickupFallback =
    currentMission?.failureReason === "no_suitable_pickup_meeting_point" ||
    order.fallbackOutcome === "no_suitable_pickup_meeting_point";
  const isDropoffFallback =
    currentMission?.failureReason === "no_suitable_dropoff_meeting_point" ||
    order.fallbackOutcome === "delivery_failed_return_required";
  const isFallbackFinal =
    isPickupFallback ||
    isDropoffFallback ||
    currentStatus === "returning_to_hub" ||
    currentStatus === "returned_to_hub";
  const fallbackReasonLabel = isFallbackFinal
    ? getFallbackReasonLabel(order, currentMission)
    : null;

  if (isFallbackFinal && currentMission?.sourceOrderId !== order.id) {
    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
          eyebrow="Livrare live"
          title={order.id}
          description="Fallback operațional activat pentru această comandă."
          actions={[
            {
              label: "Înapoi la comenzi",
              href: "/client/orders",
              variant: "ghost",
              icon: <ArrowLeft className="size-4" />,
            },
          ]}
        />

        <SectionCard
          eyebrow="Fallback"
          title={
            isPickupFallback
              ? "Nu am găsit un punct potrivit pentru ridicare"
              : "Livrarea nu a putut fi finalizată"
          }
          description={
            isPickupFallback
              ? "Drona nu a putut coborî lockerul în siguranță la punctele disponibile. Comanda a fost anulată, iar suma plătită va fi rambursată pe cardul folosit la plată."
              : "Drona nu a găsit un punct potrivit pentru coborârea lockerului la destinație. Coletul se întoarce în siguranță la hub-ul SkySend și va putea fi ridicat de acolo."
          }
        >
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
                <p className="text-sm text-muted-foreground">Status comandă</p>
                <p className="mt-2 font-heading text-2xl tracking-tight text-foreground">
                  {isPickupFallback ? "Comandă anulată" : "Colet returnat la hub"}
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {isPickupFallback
                    ? "Nu a fost găsit un punct potrivit pentru ridicare."
                    : "Nu a fost găsit un punct potrivit pentru livrare."}
                </p>
              </div>

              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
                <p className="text-sm text-muted-foreground">Plată</p>
                <p className="mt-2 font-heading text-2xl tracking-tight text-foreground">
                  Rambursare în curs
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Nu există confirmare locală de rambursare de la Stripe; comanda
                  este marcată cu rambursare în așteptare până la integrarea
                  rambursării reale.
                </p>
              </div>
            </div>

            {isDropoffFallback ? (
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-primary/25 bg-primary/10 p-5">
                <p className="font-medium text-foreground">
                  Drona se întoarce la hub cu coletul în locker. Te așteaptă
                  să îți ridici coletul înapoi de la hub-ul SkySend.
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Coletul poate fi ridicat de la hub-ul SkySend în termen de 10
                  zile. Suma plătită va fi rambursată pe cardul folosit la
                  plată, conform statusului plății.
                </p>
              </div>
            ) : null}

            {fallbackReasonLabel ? (
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-warning/30 bg-warning/10 p-5">
                <p className="font-medium text-foreground">
                  Motiv fallback
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {fallbackReasonLabel}
                </p>
              </div>
            ) : null}

            {isDropoffFallback ? <HubLockerRecoveryMap /> : null}
          </div>
        </SectionCard>
      </section>
    );
  }

  if (showSkeleton) {
    return (
      <section className="app-container flex flex-col gap-6">
        <LoadingSkeleton className="h-12 w-48" />
        <LoadingSkeleton className="h-64" />
        <LoadingSkeleton className="h-40" />
      </section>
    );
  }

  if (shouldShowMissionBrief && currentMission?.sourceOrderId === order.id) {
    return <MissionBrief mission={currentMission} etaLabel={etaLabel} />;
  }

  if (!currentMission || currentMission.sourceOrderId === order.id) {
    return (
      <PremiumTrackingWorkspace
        order={order}
        paymentStatus={paymentStatus}
      />
    );
  }

  return (
    <>
      <section className="relative isolate h-dvh min-h-dvh overflow-hidden bg-background compact-ui:block expanded-ui:hidden">
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
          <div className="flex min-w-0 items-center justify-between gap-2">
            <AppButton
              asChild
              variant="outline"
              size="icon"
              className="pointer-events-auto border-white/12 bg-background/80 shadow-[var(--elevation-soft)] backdrop-blur-md"
            >
              <Link href="/client/orders" aria-label="Înapoi la comenzi">
                <ArrowLeft className="size-4" />
              </Link>
            </AppButton>
            <div className="pointer-events-auto flex min-w-0 flex-wrap justify-end gap-2">
              <StatusBadge label="Livrare live" tone="success" />
              <StatusBadge label={`Plată ${paymentStatusLabels[paymentStatus]}`} tone={getPaymentTone(paymentStatus)} />
            </div>
          </div>

          <div className="pointer-events-auto grid grid-cols-2 gap-2">
            {[
              { label: "Ridicare", value: pickupEta.label, detail: pickupEta.detail, tone: pickupEta.tone },
              { label: "Livrare", value: deliveryEta.label, detail: deliveryEta.detail, tone: deliveryEta.tone },
            ].map((item) => {
              const isArrivalMessage = item.value.startsWith("Drona a ajuns");

              return (
                <div
                  key={item.label}
                  className="min-w-0 rounded-[calc(var(--radius)+0.45rem)] border border-white/12 bg-background/82 p-3 shadow-[var(--elevation-soft)] backdrop-blur-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                      ETA {item.label}
                    </p>
                    <StatusBadge
                      label={item.detail}
                      tone={item.tone}
                      dot={false}
                      className="max-w-[5.8rem] truncate px-2 py-1 text-[0.64rem]"
                    />
                  </div>
                  <p
                    className={
                      isArrivalMessage
                        ? "mt-2 font-heading text-lg leading-tight tracking-tight text-foreground"
                        : "mt-2 truncate font-heading text-2xl tracking-tight text-foreground"
                    }
                  >
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <MobileMissionDrawer
          hasActiveAction={Boolean(userActionTimer) || shouldShowProof}
          collapsedSummary={
            <div className="grid gap-1.5">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {shouldShowProof
                  ? "Livrare finalizată"
                  : userActionTimer
                    ? userActionTimer.title
                    : deliveryEta.detail}
              </p>
              <p className="truncate text-xs leading-5 text-muted-foreground">
                {userActionTimer
                  ? `${formatClockSeconds(userActionRemainingSeconds)} · trage în sus pentru detalii`
                  : "Trage în sus pentru detalii"}
              </p>
            </div>
          }
        >
          {shouldShowProof && currentMission ? (
            <ProofOfDelivery
              mission={currentMission}
              orderId={order.id}
              paymentStatus={paymentStatus}
              paymentLabel={paymentLabel}
              finalPriceLabel={priceLabel}
            />
          ) : (
            <div className="grid gap-4">
              {userActionTimer ? (
                <LiveActionTimerCard
                  timer={userActionTimer}
                  remainingSeconds={userActionRemainingSeconds}
                />
              ) : null}

              <MissionActionPanel
                orderId={order.id}
                parcel={order.payload.parcel}
                droneClass={order.payload.recommendedDroneClass}
              />

              <details className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card/82 p-4">
                <summary className="cursor-pointer list-none font-medium text-foreground">
                  Timeline livrare
                </summary>
                <div className="mt-4">
                  <MissionTimeline />
                </div>
              </details>

              <div className="flex flex-col gap-3">
                <RecipientTrackingLinkCard
                  missionId={recipientMissionId}
                  code={order.publicTrackingCode}
                  token={order.recipientTrackingToken}
                  compact
                />
                <RepeatDeliveryButton order={order} />
              </div>
            </div>
          )}
        </MobileMissionDrawer>
      </section>

      <section className="app-container hidden flex-col gap-6 pb-12 expanded-ui:flex">
      <PageHeader
        eyebrow="Livrare live"
        title={order.id}
        description="Urmărește livrarea SkySend din hub-ul Pitești prin ridicare, zbor, predare și dovada finală."
        actions={[
          {
            label: "Înapoi la comenzi",
            href: "/client/orders",
            variant: "ghost",
            icon: <ArrowLeft className="size-4" />,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {
            label: "ETA ridicare",
            value: pickupEta.label,
            detail: pickupEta.detail,
            icon: MapPinned,
            tone: pickupEta.tone,
          },
          {
            label: "ETA livrare",
            value: deliveryEta.label,
            detail: deliveryEta.detail,
            icon: Plane,
            tone: deliveryEta.tone,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isArrivalMessage =
            item.value.startsWith("Drona a ajuns") ||
            item.value === "Ajunsa la livrare";

          return (
            <Card
              key={item.label}
              className="rounded-[var(--ui-radius-panel)] border-border/80 bg-card shadow-[var(--elevation-panel)]"
            >
              <CardContent className="grid gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
                      <Icon className="size-5" />
                    </span>
                    <p className="font-medium text-foreground">{item.label}</p>
                  </div>
                  <StatusBadge label={item.detail} tone={item.tone} />
                </div>
                <p
                  className={
                    isArrivalMessage
                      ? "font-heading text-3xl leading-tight tracking-tight text-foreground sm:text-4xl"
                      : "font-heading whitespace-nowrap text-[clamp(2.35rem,4.2vw,3.75rem)] tracking-tight text-foreground"
                  }
                >
                  {item.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {userActionTimer ? (
        <LiveActionTimerCard
          timer={userActionTimer}
          remainingSeconds={userActionRemainingSeconds}
        />
      ) : null}

      {shouldShowProof && currentMission ? (
        <div className="grid gap-5">
          <ProofOfDelivery
            mission={currentMission}
            orderId={order.id}
            paymentStatus={paymentStatus}
            paymentLabel={paymentLabel}
            finalPriceLabel={priceLabel}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.55fr)] xl:items-start">
            <LiveMissionMap
              className="min-h-[26rem] sm:min-h-[34rem] xl:min-h-[44rem]"
              mapClassName="min-h-[24rem] sm:min-h-[30rem] md:min-h-[38rem] xl:min-h-[42rem]"
              showStatusFooter={false}
              fallbackPickup={{
                label: order.payload.selectedPickupPoint.label,
                point: order.payload.selectedPickupPoint.location,
              }}
              fallbackDropoff={{
                label: order.payload.selectedDropoffPoint.label,
                point: order.payload.selectedDropoffPoint.location,
              }}
            />

            <aside className="grid gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100dvh_-_3rem)] xl:overflow-y-auto xl:pr-1">
              <MissionActionPanel
                orderId={order.id}
                parcel={order.payload.parcel}
                droneClass={order.payload.recommendedDroneClass}
              />
            </aside>
          </div>

          <div className="grid gap-5">
            <MissionTimeline />
          </div>
        </>
      )}

      <details className="rounded-[var(--ui-radius-card)] border border-border/80 bg-card/80 p-5 shadow-[var(--elevation-card)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-foreground">
          Context livrare
          <StatusBadge label="Detalii comandă" tone="neutral" />
        </summary>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard
          eyebrow="Rezumat"
          title="Rezumat livrare"
          description="Contextul comenzii rămâne disponibil cât timp livrarea este activă."
          size="sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div className="flex items-center gap-3">
                <Package2 className="size-4 text-foreground" />
                <p className="font-medium text-foreground">Colet</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {parcelSummary}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div className="flex items-center gap-3">
                <Route className="size-4 text-foreground" />
                <p className="font-medium text-foreground">Traseu</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {order.payload.pickupAddress.formattedAddress}
                <br />
                {order.payload.dropoffAddress.formattedAddress}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <p className="font-medium text-foreground">Dronă</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {droneSummary}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <p className="font-medium text-foreground">Plată</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {paymentLabel}
              </p>
            </div>
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <p className="font-medium text-foreground">Preț</p>
              <div className="mt-3 grid gap-2">
                {pricingSnapshot.breakdown.slice(0, 4).map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(item.amount.amountMinor, item.amount.currency)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-border/80 pt-2 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium text-foreground">{priceLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <RecipientTrackingLinkCard
            missionId={recipientMissionId}
            code={order.publicTrackingCode}
            token={order.recipientTrackingToken}
            compact
          />
        </SectionCard>

        <SectionCard
          eyebrow="Dovadă"
          title="Dovadă de livrare"
          description="Dovada finală apare după ridicarea coletului și închiderea misiunii."
          size="sm"
        >
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
            <div className="flex items-center gap-3">
              <FileCheck2 className="size-4 text-foreground" />
              <p className="font-medium text-foreground">
                {currentStatus === "mission_closed" ? "Dovadă gata" : "Dovadă în așteptare"}
              </p>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {outcomeSummary ??
                "Dovada va fi disponibilă după ridicarea coletului și închiderea misiunii."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge label="Înregistrări PIN" tone="neutral" />
              <StatusBadge label="Status locker" tone="neutral" />
            </div>
          </div>
        </SectionCard>
        </div>
      </details>
      </section>
    </>
  );
}
