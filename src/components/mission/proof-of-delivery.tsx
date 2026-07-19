"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  LockKeyhole,
  MapPinned,
  PackageCheck,
  Plane,
} from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  lockerStateLabels,
  missionStatusLabels,
} from "@/constants/mission";
import type { CreatedDeliveryPaymentStatus } from "@/types/create-delivery";
import type { Mission, MissionStatus } from "@/types/mission";

type ProofOfDeliveryProps = {
  mission: Mission;
  orderId: string;
  paymentStatus: CreatedDeliveryPaymentStatus;
  paymentLabel: string;
  finalPriceLabel: string;
};

const finalProofStatuses: MissionStatus[] = [
  "delivery_completed",
  "proof_generated",
  "mission_closed",
];

const paymentStatusLabels: Record<CreatedDeliveryPaymentStatus, string> = {
  unpaid: "Neplătită",
  processing: "În procesare",
  paid: "Plătită",
  failed: "Eșuată",
  refunded: "Rambursată",
  refund_pending: "Rambursare în curs",
};

function formatTimestamp(value?: string | null) {
  const timestamp = value ?? new Date().toISOString();

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function hasPinVerified(mission: Mission, purpose: "pickup_verification" | "dropoff_verification") {
  return mission.pins.some(
    (pin) => pin.purpose === purpose && pin.status === "verified",
  );
}

function getProofTimestamp(mission: Mission) {
  return (
    mission.closedAt ??
    mission.completedAt ??
    mission.events.find((event) => event.status === "proof_generated")
      ?.timestamp ??
    mission.events.find((event) => event.status === "delivery_completed")
      ?.timestamp ??
    mission.updatedAt
  );
}

export function isProofOfDeliveryReady(status: MissionStatus | null) {
  return Boolean(status && finalProofStatuses.includes(status));
}

export function ProofOfDelivery({
  mission,
  orderId,
  paymentStatus,
  paymentLabel,
  finalPriceLabel,
}: ProofOfDeliveryProps) {
  const recipientPinVerified = hasPinVerified(mission, "dropoff_verification");
  const lockerOpened =
    mission.events.some((event) =>
      event.title.toLowerCase().includes("locker lowered"),
    ) || mission.locker.state === "emptied" || mission.locker.state === "locked";
  const parcelCollected =
    mission.status === "delivery_completed" ||
    mission.status === "proof_generated" ||
    mission.status === "mission_closed" ||
    mission.locker.state === "emptied" ||
    mission.locker.state === "locked";
  const deliveredAt = formatTimestamp(getProofTimestamp(mission));

  return (
    <SectionCard
      eyebrow="Dovadă"
      title="Dovadă de livrare"
      description="Înregistrare finală generată din evenimentele PIN, locker și telemetria misiunii."
    >
      <div className="grid gap-5">
        <div className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-secondary/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Livrare finalizată" tone="success" />
                <StatusBadge
                  label={missionStatusLabels[mission.status]}
                  tone="info"
                />
              </div>
              <p className="mt-4 font-heading text-3xl tracking-tight text-foreground">
                Colet livrat
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Livrată la {deliveredAt}
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-full border border-border bg-background">
              <FileCheck2 className="size-5 text-foreground" />
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <p className="text-sm text-muted-foreground">ID misiune</p>
            <p className="mt-2 truncate font-medium text-foreground">
              {mission.id}
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <p className="text-sm text-muted-foreground">ID comandă</p>
            <p className="mt-2 truncate font-medium text-foreground">
              {orderId}
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plane className="size-4" />
              ID dronă
            </div>
            <p className="mt-2 truncate font-medium text-foreground">
              {mission.droneId}
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <p className="text-sm text-muted-foreground">Status final</p>
            <p className="mt-2 font-medium text-foreground">
              {missionStatusLabels[mission.status]}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <MapPinned className="size-4" />
              Punct de ridicare
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mission.pickup.label}
            </p>
          </div>
          <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <MapPinned className="size-4" />
              Punct de livrare
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {mission.dropoff.label}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <LockKeyhole className="size-4" />
              PIN destinatar
            </div>
            <StatusBadge
              className="mt-3"
              label={recipientPinVerified ? "Verificat" : "Înregistrat"}
              tone={recipientPinVerified ? "success" : "neutral"}
            />
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ClipboardCheck className="size-4" />
              Locker deschis
            </div>
            <StatusBadge
              className="mt-3"
              label={lockerOpened ? "Confirmat" : lockerStateLabels[mission.locker.state]}
              tone={lockerOpened ? "success" : "neutral"}
            />
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-background p-4">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <PackageCheck className="size-4" />
              Colet ridicat
            </div>
            <StatusBadge
              className="mt-3"
              label={parcelCollected ? "Confirmat" : "În așteptare"}
              tone={parcelCollected ? "success" : "neutral"}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="size-4" />
              Plată
            </div>
            <p className="mt-2 font-medium text-foreground">
              {paymentStatusLabels[paymentStatus]}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {paymentLabel}
            </p>
          </div>
          <div className="rounded-[var(--radius)] border border-border/80 bg-secondary/45 p-4">
            <p className="text-sm text-muted-foreground">Preț final</p>
            <p className="mt-2 font-medium text-foreground">{finalPriceLabel}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <AppButton asChild size="lg" className="w-full sm:w-fit">
            <Link href="/client">Înapoi la dashboard</Link>
          </AppButton>
          <AppButton asChild variant="outline" size="lg" className="w-full sm:w-fit">
            <Link href={`/client/orders/${orderId}`}>Vezi detaliile comenzii</Link>
          </AppButton>
          <AppButton asChild variant="secondary" size="lg" className="w-full sm:w-fit">
            <Link href="/client/create-delivery">
              <CheckCircle2 className="size-4" />
              Creează altă livrare
            </Link>
          </AppButton>
        </div>
      </div>
    </SectionCard>
  );
}

