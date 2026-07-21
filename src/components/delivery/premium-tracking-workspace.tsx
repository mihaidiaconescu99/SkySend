"use client";

import Link from "next/link";
import { Check, ChevronUp, Copy, Headphones, MapPin, PackageCheck, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveMissionMap } from "@/components/mission/live-mission-map";
import { MissionActionPanel } from "@/components/mission/mission-action-panel";
import { AppButton } from "@/components/shared/app-button";
import { activeHub } from "@/constants/hub";
import { missionStatusLabels } from "@/constants/mission";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import {
  getMissionJourneyProgress,
  premiumFailureContent,
  type PremiumFailureCode,
} from "@/lib/mission-progress";
import type { CreatedDeliveryOrder, CreatedDeliveryPaymentStatus } from "@/types/create-delivery";
import type { MissionStatus } from "@/types/mission";
import { TrackingShareMenu } from "./tracking-share-menu";
import { cn } from "@/lib/utils";

type Props = {
  order: CreatedDeliveryOrder;
  paymentStatus: CreatedDeliveryPaymentStatus;
};

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "—";
  const minutes = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
  return `${minutes} min`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function TerminalView({
  order,
  outcome,
  failureCode,
  publicMode,
}: {
  order: CreatedDeliveryOrder;
  outcome: "success" | "failure";
  failureCode?: PremiumFailureCode | null;
  publicMode: boolean;
}) {
  const { currentMission: runtimeMission } = useMissionRuntime();
  const currentMission =
    runtimeMission?.sourceOrderId === order.id ? runtimeMission : null;
  const success = outcome === "success";
  const failure = failureCode
    ? premiumFailureContent[failureCode]
    : {
        title: "Livrarea nu a putut continua",
        description: "Misiunea a fost oprită. Detaliile disponibile sunt afișate mai jos.",
        refundEligible: false,
      };
  const parcelLoaded = Boolean(
    currentMission?.events.some((event) => event.status === "en_route_to_dropoff") ||
      currentMission?.meetingPointAttempts.acceptedDropoffMeetingPointId,
  );
  const pickupPoint = currentMission?.meetingPointAttempts.pickupMeetingPoints.find(
    (point) => point.id === currentMission.meetingPointAttempts.acceptedPickupMeetingPointId,
  );
  const dropoffPoint = currentMission?.meetingPointAttempts.dropoffMeetingPoints.find(
    (point) => point.id === currentMission.meetingPointAttempts.acceptedDropoffMeetingPointId,
  );
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${activeHub.address.location.latitude},${activeHub.address.location.longitude}`;
  const refundMessage =
    order.paymentStatus === "refund_pending" || order.refundStatus === "pending"
      ? "Rambursarea este în curs de procesare și este înregistrată pentru reconciliere."
      : order.refundStatus === "failed"
        ? "Rambursarea automată nu a fost finalizată și este înregistrată pentru reconciliere."
        : order.refundStatus === "completed"
          ? "Rambursarea integrală a fost trimisă către metoda de plată folosită."
          : "Rambursarea integrală a fost inițiată către metoda de plată folosită și poate dura până la 14 zile.";

  return (
    <section
      className={cn(
        "min-h-[calc(100dvh-5rem)] overflow-y-auto bg-background px-5 pb-10 pt-20 sm:px-8 expanded-ui:px-12 expanded-ui:pt-24",
        publicMode ? "fixed inset-0 z-[80] min-h-dvh" : undefined,
      )}
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase text-primary">{success ? "Livrare finalizată" : "Livrare eșuată"}</p>
        <h1 className="mt-4 max-w-4xl font-heading text-4xl leading-tight text-foreground sm:text-6xl">
          {success ? "Colet livrat" : failure?.title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
          {success ? "Livrarea a fost încheiată, iar detaliile cursei au fost salvate." : failure?.description}
        </p>

        {!success && failure?.refundEligible ? (
          <p className="mt-5 max-w-2xl border-l-2 border-primary pl-4 text-sm leading-6 text-foreground">
            {refundMessage}
          </p>
        ) : !success && failure ? (
          <p className="mt-5 max-w-2xl border-l-2 border-warning pl-4 text-sm leading-6 text-foreground">
            Această situație nu este eligibilă pentru rambursare.
          </p>
        ) : null}

        <dl className="mt-10 grid border-y border-border/80 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Ridicare", order.payload.pickupAddress.formattedAddress],
            ["Livrare", order.payload.dropoffAddress.formattedAddress],
            ["Durată", formatDuration(currentMission?.startedAt ?? order.paidAt, currentMission?.completedAt ?? currentMission?.updatedAt ?? order.completedAt)],
            ["Finalizată", formatDate(currentMission?.completedAt ?? currentMission?.updatedAt ?? order.completedAt)],
            ["Punct ridicare", pickupPoint?.label ?? order.payload.selectedPickupPoint.label ?? "—"],
            ["Punct livrare", dropoffPoint?.label ?? order.payload.selectedDropoffPoint.label ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-border/70 px-4 py-5 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-sm font-medium leading-6 text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {!success && parcelLoaded ? (
          <div className="mt-8 border border-border/80 p-5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Ridicare colet din hub</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {activeHub.address.formattedAddress}. Coletul poate fi ridicat în termen de 30 de zile.
                </p>
                <a href={mapsHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
                  Deschide indicațiile
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <AppButton asChild size="lg"><Link href="/client/orders"><Route className="size-4" />Înapoi la comenzi</Link></AppButton>
          {success ? (
            <AppButton asChild size="lg" variant="outline"><Link href="/client/create-delivery"><PackageCheck className="size-4" />Creează altă livrare</Link></AppButton>
          ) : (
            <AppButton asChild size="lg" variant="outline"><Link href="/client/support"><Headphones className="size-4" />Contactează suportul</Link></AppButton>
          )}
        </div>
      </div>
    </section>
  );
}

export function PremiumTrackingWorkspace({ order }: Props) {
  const {
    currentMission: runtimeMission,
    currentStatus: runtimeStatus,
    segmentProgress,
  } = useMissionRuntime();
  const currentMission =
    runtimeMission?.sourceOrderId === order.id ? runtimeMission : null;
  const persistedStatus =
    order.missionStatus && order.missionStatus in missionStatusLabels
      ? (order.missionStatus as MissionStatus)
      : null;
  const currentStatus = currentMission ? runtimeStatus : persistedStatus;
  const publicMode = (order.trackingAccessScope ?? "owner") !== "owner";
  const [copied, setCopied] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const progress = getMissionJourneyProgress(currentStatus, segmentProgress);
  const rawFailureCode =
    currentMission?.failureReason ??
    order.missionFailureCode ??
    order.fallbackReason ??
    (order.fallbackOutcome === "delivery_failed_return_required"
      ? "no_suitable_dropoff_meeting_point"
      : order.fallbackOutcome);
  const failureCode =
    rawFailureCode && rawFailureCode in premiumFailureContent
      ? (rawFailureCode as PremiumFailureCode)
      : null;
  const isSuccess =
    order.fulfillmentStatus === "completed_mission" ||
    currentStatus === "delivery_completed" ||
    currentStatus === "proof_generated" ||
    currentStatus === "mission_closed";
  const isFailure =
    order.fulfillmentStatus === "failed_mission" ||
    currentStatus === "mission_failed" ||
    Boolean(failureCode);

  useEffect(() => {
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  if (isSuccess) {
    return (
      <TerminalView
        order={order}
        outcome="success"
        publicMode={publicMode}
      />
    );
  }
  if (isFailure) {
    return (
      <TerminalView
        order={order}
        outcome="failure"
        failureCode={failureCode}
        publicMode={publicMode}
      />
    );
  }

  async function copyId() {
    await navigator.clipboard.writeText(order.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section
      className={cn(
        "relative h-dvh min-h-0 overflow-hidden bg-background",
        publicMode ? "fixed inset-0 z-[80]" : undefined,
      )}
      data-testid="premium-tracking-workspace"
    >
      <div className="absolute inset-0 grid min-h-0 expanded-ui:grid-cols-2">
        <div className="absolute inset-x-0 top-0 h-[55svh] min-h-0 expanded-ui:static expanded-ui:h-full">
          <LiveMissionMap
            presentation="frameless"
            showMapOverlay={false}
            className="h-full min-h-0"
            mapClassName="h-full min-h-0"
            fallbackPickup={{ label: order.payload.selectedPickupPoint.label, point: order.payload.selectedPickupPoint.location }}
            fallbackDropoff={{ label: order.payload.selectedDropoffPoint.label, point: order.payload.selectedDropoffPoint.location }}
          />
        </div>

        <div className={cn(
          "absolute inset-x-0 bottom-0 z-30 flex min-h-[46svh] flex-col border-t border-border bg-card shadow-[0_-18px_50px_-35px_rgba(0,0,0,.7)] transition-[max-height] duration-300 expanded-ui:static expanded-ui:max-h-none expanded-ui:min-h-0 expanded-ui:border-l expanded-ui:border-t-0 expanded-ui:shadow-none",
          mobileExpanded ? "max-h-[88svh]" : "max-h-[54svh]",
        )}>
          <button
            type="button"
            aria-label={mobileExpanded ? "Restrânge panoul" : "Extinde panoul"}
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded((value) => !value)}
            className="mx-auto mt-1 flex h-8 w-14 items-center justify-center text-muted-foreground expanded-ui:hidden"
          >
            <ChevronUp className={cn("size-4 transition-transform", mobileExpanded ? "rotate-180" : undefined)} />
          </button>
          <div className="shrink-0 px-5 pb-5 pt-5 sm:px-7 expanded-ui:pt-24">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <p className="min-w-0 truncate font-mono text-lg font-semibold text-foreground sm:text-xl">{order.id}</p>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" aria-label="Copiază ID-ul comenzii" onClick={copyId} className="inline-flex size-10 items-center justify-center border border-border/80 bg-background text-foreground hover:border-primary/50 hover:bg-secondary">
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </button>
                {(order.trackingAccessScope ?? "owner") === "owner" ? (
                  <TrackingShareMenu orderId={order.id} />
                ) : null}
              </div>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Progres cursă</span><span className="font-medium text-foreground">{progress}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden bg-secondary shadow-[inset_0_1px_2px_rgba(0,0,0,.18)]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="mission-progress-fill h-full bg-primary shadow-[0_0_14px_rgba(34,211,238,.48)] transition-[width] duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
          <MissionActionPanel
            orderId={order.id}
            parcel={order.payload.parcel}
            droneClass={order.payload.recommendedDroneClass}
            accessScope={order.trackingAccessScope ?? "owner"}
            trackingIdentifier={order.trackingIdentifier}
          />
        </div>
      </div>
    </section>
  );
}
