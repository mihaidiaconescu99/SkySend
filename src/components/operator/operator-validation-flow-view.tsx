"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  QrCode,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  OperatorValidationContext,
  OperatorValidationStatus,
} from "@/types/operator-validation";

type OperatorValidationFlowViewProps = {
  context: OperatorValidationContext;
};

type StageKey = "pickup" | "loaded" | "dropoff" | "completion";
type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";

const statusLabels: Record<OperatorValidationStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  failed: "Failed",
  requires_fallback: "Requires fallback",
};

function getStatusTone(status: OperatorValidationStatus): StatusTone {
  switch (status) {
    case "verified":
      return "success";
    case "failed":
      return "destructive";
    case "requires_fallback":
      return "warning";
    case "pending":
      return "neutral";
  }
}

function formatOrderId(orderId: string) {
  return orderId.split("_").at(-1)?.replace(/^0+/, "") || orderId;
}

function prettyToken(value: string) {
  return value.replace(/^order_/, "SKY-").replaceAll("_", "-").toUpperCase();
}

function StageActions({
  stage,
  onSetStatus,
}: {
  stage: StageKey;
  onSetStatus: (stage: StageKey, status: OperatorValidationStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <AppButton
        type="button"
        size="sm"
        onClick={() => onSetStatus(stage, "verified")}
      >
        <CheckCircle2 className="size-4" />
        Mark verified
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onSetStatus(stage, "requires_fallback")}
      >
        <RotateCcw className="size-4" />
        Requires fallback
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onSetStatus(stage, "failed")}
      >
        <AlertTriangle className="size-4" />
        Mark failed
      </AppButton>
    </div>
  );
}

export function OperatorValidationFlowView({
  context,
}: OperatorValidationFlowViewProps) {
  const [statuses, setStatuses] = useState<Record<StageKey, OperatorValidationStatus>>({
    pickup: "pending",
    loaded: "pending",
    dropoff: "pending",
    completion: "pending",
  });

  const testPin = useMemo(
    () => formatOrderId(context.orderId).padStart(4, "0").slice(-4),
    [context.orderId],
  );
  const testQrRef = `QR-${prettyToken(context.orderId)}`;

  function setStageStatus(stage: StageKey, status: OperatorValidationStatus) {
    setStatuses((current) => ({
      ...current,
      [stage]: status,
    }));
  }

  return (
    <section className="app-container flex flex-col gap-6">
      <Card className="rounded-[var(--ui-radius-panel)] shadow-[var(--elevation-panel)]">
        <CardContent className="grid gap-5 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">Comanda #{formatOrderId(context.orderId)}</Badge>
            <StatusBadge label={context.assignedDroneClassLabel} tone="info" />
            <StatusBadge label="Test validation" tone="neutral" />
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {Object.entries(statuses).map(([stage, status]) => (
              <div
                key={stage}
                className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4"
              >
                <p className="text-sm capitalize text-muted-foreground">
                  {stage}
                </p>
                <div className="mt-2">
                  <StatusBadge
                    label={statusLabels[status]}
                    tone={getStatusTone(status)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          eyebrow="Ridicare Validation"
          title="Verify pickup point and sender"
          description="The operator confirms the pickup context before the package is loaded. This is a test verification flow, not a hardware check."
        >
          <div className="grid gap-4">
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-foreground">Punct de ridicare</p>
                <StatusBadge
                  label={statusLabels[statuses.pickup]}
                  tone={getStatusTone(statuses.pickup)}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {context.pickupPoint.label}
                <br />
                Sender: {context.pickupPoint.contactName} /{" "}
                {context.pickupPoint.contactDetail}
                <br />
                {context.pickupPoint.notes ?? "No pickup note provided."}
              </p>
            </div>

            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-foreground" />
                <p className="font-medium text-foreground">
                  Sender verification
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Match sender name with dispatch record and confirm the handoff
                note verbally. No biometric or hardware verification is used.
              </p>
            </div>

            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="size-4 text-foreground" />
                <p className="font-medium text-foreground">Rezumat colet</p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {context.parcel.summary}
                <br />
                {context.parcel.estimatedWeightRange} / {context.parcel.size} /{" "}
                {context.parcel.packagingType} / fragile{" "}
                {context.parcel.fragileLevel}
              </p>
            </div>

            <StageActions stage="pickup" onSetStatus={setStageStatus} />
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Colet încărcat"
          title="Confirm package loaded"
          description="This step records that the package is ready for the assigned drone class."
        >
          <div className="grid gap-4">
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PackageCheck className="size-4 text-foreground" />
                  <p className="font-medium text-foreground">Load check</p>
                </div>
                <StatusBadge
                  label={statusLabels[statuses.loaded]}
                  tone={getStatusTone(statuses.loaded)}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Confirm package seal, weight range and fit for{" "}
                {context.assignedDroneClassLabel}. This remains an operator
                checkpoint until drone telemetry is connected.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                onClick={() => setStageStatus("loaded", "verified")}
              >
                <PackageCheck className="size-4" />
                Confirm package loaded
              </AppButton>
              <AppButton
                type="button"
                variant="outline"
                onClick={() => setStageStatus("loaded", "requires_fallback")}
              >
                Requires fallback
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                onClick={() => setStageStatus("loaded", "failed")}
              >
                Report load issue
              </AppButton>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          eyebrow="Livrare Validation"
          title="Verify recipient and release conditions"
          description="The recipient handoff uses a simple PIN/QR test reference so the flow is realistic without pretending to scan real hardware."
        >
          <div className="grid gap-4">
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-foreground">Livrare point</p>
                <StatusBadge
                  label={statusLabels[statuses.dropoff]}
                  tone={getStatusTone(statuses.dropoff)}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {context.dropoffPoint.label}
                <br />
                Recipient: {context.dropoffPoint.contactName} /{" "}
                {context.dropoffPoint.contactDetail}
                <br />
                {context.dropoffPoint.notes ?? "No drop-off note provided."}
              </p>
            </div>

            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-background p-5">
              <div className="flex items-center gap-3">
                <QrCode className="size-4 text-foreground" />
                <p className="font-medium text-foreground">
                  PIN/QR confirmation
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                PIN: {testPin}
                <br />
                QR reference: {testQrRef}
                <br />
                The operator compares this test reference with the delivery
                record before releasing the package.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                onClick={() => setStageStatus("dropoff", "verified")}
              >
                <CheckCircle2 className="size-4" />
                Release package
              </AppButton>
              <AppButton
                type="button"
                variant="outline"
                onClick={() => setStageStatus("dropoff", "requires_fallback")}
              >
                Requires fallback
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                onClick={() => setStageStatus("dropoff", "failed")}
              >
                Failed recipient check
              </AppButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Finalizare livrare"
          title="Complete delivery"
          description="Completion is only clear when pickup, load and drop-off are verified. This mirrors a real operational handoff chain."
        >
          <div className="grid gap-4">
            <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-foreground">Status livrare</p>
                <StatusBadge
                  label={statusLabels[statuses.completion]}
                  tone={getStatusTone(statuses.completion)}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Complete the delivery only after the package has been loaded,
                recipient confirmation has passed and the package is released.
                If any step fails, mark fallback or failure instead.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AppButton
                type="button"
                onClick={() => setStageStatus("completion", "verified")}
                disabled={
                  statuses.pickup !== "verified" ||
                  statuses.loaded !== "verified" ||
                  statuses.dropoff !== "verified"
                }
              >
                <CheckCircle2 className="size-4" />
                Complete delivery
              </AppButton>
              <AppButton
                type="button"
                variant="outline"
                onClick={() => setStageStatus("completion", "requires_fallback")}
              >
                Requires fallback
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                onClick={() => setStageStatus("completion", "failed")}
              >
                Mark failed
              </AppButton>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
