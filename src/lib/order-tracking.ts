import type { CreateDeliverySubmitStatus } from "@/types/create-delivery";
import type { OrderStatus } from "@/types/domain";

export type TrackingStepState = "done" | "current" | "upcoming" | "failed";

export type TrackingStep = {
  key: string;
  label: string;
  description: string;
  date: string | null;
  state: TrackingStepState;
};

const trackingStepLabels = [
  {
    key: "received",
    label: "Comandă primită",
    description: "SkySend a înregistrat cererea de livrare și traseul.",
  },
  {
    key: "reviewing",
    label: "În verificare",
    description: "Acoperirea, punctele de întâlnire și coletul sunt verificate.",
  },
  {
    key: "drone_assigned",
    label: "Dronă alocată",
    description: "Livrarea are o dronă recomandată pentru lansare.",
  },
  {
    key: "pickup_pending",
    label: "Ridicare în așteptare",
    description: "Misiunea așteaptă confirmarea punctului de ridicare.",
  },
  {
    key: "in_transit",
    label: "În tranzit",
    description: "Coletul se deplasează câtre punctul de livrare selectat.",
  },
  {
    key: "awaiting_recipient",
    label: "Așteaptă destinatarul",
    description: "Drona este la destinație și așteaptă predarea finală.",
  },
  {
    key: "delivered",
    label: "Livrată",
    description: "Livrarea este completă și dovada poate fi verificată.",
  },
  {
    key: "failed_fallback",
    label: "Oprită / recuperare",
    description: "Livrarea are nevoie de suport sau de o rută de recuperare.",
  },
] as const;

const orderStatusCurrentStep: Record<OrderStatus, string> = {
  draft: "received",
  scheduled: "drone_assigned",
  queued: "pickup_pending",
  in_flight: "in_transit",
  delivered: "delivered",
  failed: "failed_fallback",
  cancelled: "failed_fallback",
  returned: "failed_fallback",
};

const createdOrderStatusCurrentStep: Record<CreateDeliverySubmitStatus, string> = {
  pending_review: "reviewing",
  pending_scheduled_start: "drone_assigned",
  scheduled: "drone_assigned",
};

function addMinutes(value: string, minutes: number) {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function buildTrackingSteps({
  currentStepKey,
  createdAt,
  scheduledFor,
  completedAt,
  isFailure,
}: {
  currentStepKey: string;
  createdAt: string;
  scheduledFor?: string | null;
  completedAt?: string | null;
  isFailure?: boolean;
}): TrackingStep[] {
  const activeIndex = trackingStepLabels.findIndex(
    (step) => step.key === currentStepKey,
  );
  const effectiveActiveIndex = Math.max(0, activeIndex);

  return trackingStepLabels.map((step, index) => {
    const isTerminalFailure = step.key === "failed_fallback" && isFailure;
    const isTerminalSuccess = step.key === "delivered" && currentStepKey === "delivered";
    const isCurrent = index === effectiveActiveIndex;
    const isDone =
      index < effectiveActiveIndex ||
      isTerminalSuccess ||
      (isTerminalFailure && currentStepKey === "failed_fallback");

    return {
      ...step,
      date:
        step.key === "received"
          ? createdAt
          : step.key === "reviewing" && index <= effectiveActiveIndex
            ? addMinutes(createdAt, 2)
            : step.key === "drone_assigned" && index <= effectiveActiveIndex
              ? scheduledFor ?? addMinutes(createdAt, 6)
              : step.key === "pickup_pending" && index <= effectiveActiveIndex
                ? scheduledFor ?? addMinutes(createdAt, 10)
                : step.key === "in_transit" && index <= effectiveActiveIndex
                  ? scheduledFor ? addMinutes(scheduledFor, 8) : addMinutes(createdAt, 18)
                  : (step.key === "delivered" || step.key === "failed_fallback") &&
                      (isTerminalSuccess || isTerminalFailure)
                    ? completedAt ?? addMinutes(createdAt, 28)
                    : null,
      state: isTerminalFailure
        ? "failed"
        : isDone
          ? "done"
          : isCurrent
            ? "current"
            : "upcoming",
    };
  });
}

export function getTrackingStepsForOrder({
  status,
  createdAt,
  scheduledFor,
  completedAt,
}: {
  status: OrderStatus;
  createdAt: string;
  scheduledFor?: string | null;
  completedAt?: string | null;
}) {
  return buildTrackingSteps({
    currentStepKey: orderStatusCurrentStep[status],
    createdAt,
    scheduledFor,
    completedAt,
    isFailure:
      status === "failed" ||
      status === "cancelled" ||
      status === "returned",
  });
}

export function getTrackingStepsForCreatedOrder({
  status,
  createdAt,
}: {
  status: CreateDeliverySubmitStatus;
  createdAt: string;
}) {
  return buildTrackingSteps({
    currentStepKey: createdOrderStatusCurrentStep[status],
    createdAt,
    scheduledFor: addMinutes(createdAt, 8),
  });
}
