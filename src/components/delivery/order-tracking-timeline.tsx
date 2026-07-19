import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { TrackingStep } from "@/lib/order-tracking";

type OrderTrackingTimelineProps = {
  steps: readonly TrackingStep[];
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Așteaptă actualizare";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStepIcon(step: TrackingStep) {
  if (step.state === "failed") {
    return <CircleAlert className="size-4 text-destructive" />;
  }

  if (step.state === "done") {
    return <CheckCircle2 className="size-4 text-foreground" />;
  }

  return <Clock3 className="size-4 text-foreground" />;
}

function getStepTone(step: TrackingStep) {
  if (step.state === "failed") {
    return "destructive" as const;
  }

  if (step.state === "done") {
    return "success" as const;
  }

  if (step.state === "current") {
    return "info" as const;
  }

  return "neutral" as const;
}

export function OrderTrackingTimeline({ steps }: OrderTrackingTimelineProps) {
  return (
    <div className="grid gap-3">
      {steps.map((step, index) => (
        <div
          key={step.key}
          className="grid gap-4 rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-2xl border border-border/80 bg-background text-sm font-medium text-foreground">
              {getStepIcon(step)}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">
                {index + 1}. {step.label}
              </p>
              <StatusBadge
                label={
                  step.state === "done"
                    ? "Finalizat"
                    : step.state === "current"
                      ? "Curent"
                      : step.state === "failed"
                        ? "Excepție"
                        : "Urmează"
                }
                tone={getStepTone(step)}
              />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {step.description}
            </p>
          </div>
          <div className="text-sm text-muted-foreground sm:justify-self-end">
            {formatDateTime(step.date)}
          </div>
        </div>
      ))}
    </div>
  );
}
