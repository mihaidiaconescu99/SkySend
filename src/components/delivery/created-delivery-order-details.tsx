"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { LiveMissionTrackingView } from "@/components/delivery/live-mission-tracking-view";
import { PageHeader } from "@/components/shared/page-header";
import { droneClassLabels, deliveryUrgencyLabels } from "@/constants/domain";
import { deliveryPlatformLabels } from "@/constants/delivery-configurations";
import { parcelCategoryLabels, parcelPackagingLabels, parcelSizeLabels } from "@/lib/create-delivery-parcel";
import { readCreatedDeliveryOrder } from "@/lib/create-delivery-submit";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";
import type { DeliveryUrgency } from "@/types/domain";

type CreatedDeliveryOrderDetailsProps = {
  orderId: string;
};

function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function getCreatedOrderStatusLabel(order: CreatedDeliveryOrder) {
  return order.status === "pending_review" ? "În verificare" : "Programată";
}

function getUrgencyLabel(value: CreatedDeliveryOrder["payload"]["urgency"]) {
  if (value === "scheduled") {
    return "Programată";
  }

  return deliveryUrgencyLabels[value as DeliveryUrgency];
}

function getDeliveryConfigurationSummary(
  payload: CreatedDeliveryOrder["payload"],
) {
  const configuration = payload.selectedDeliveryConfiguration;

  if (!configuration) {
    return droneClassLabels[payload.recommendedDroneClass];
  }

  return `${deliveryPlatformLabels[configuration.platform]} / ${configuration.moduleName}`;
}

export function CreatedDeliveryOrderDetails({
  orderId,
}: CreatedDeliveryOrderDetailsProps) {
  const [createdOrder, setCreatedOrder] = useState<CreatedDeliveryOrder | null>(
    null,
  );
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCreatedOrder(readCreatedDeliveryOrder(orderId));
      setHasLoaded(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [orderId]);

  if (!hasLoaded) {
    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
          eyebrow="Detalii comandă"
          title={orderId}
          description="Se încarcă detaliile comenzii pregătite în această sesiune."
        />
      </section>
    );
  }

  if (!createdOrder) {
    return (
      <section className="app-container flex flex-col gap-6">
        <PageHeader
          eyebrow="Detalii comandă"
          title="Sesiunea comenzii a expirat"
          description="Această comandă a fost pregătită local în sesiunea browserului și nu mai este disponibilă."
          actions={[
            {
              label: "Creează livrare",
              href: "/client/create-delivery",
              variant: "default",
              icon: <ArrowLeft className="size-4" />,
            },
          ]}
        />
      </section>
    );
  }

  const { payload } = createdOrder;
  const etaLabel = `${payload.estimatedEta.minMinutes} - ${payload.estimatedEta.maxMinutes} min`;
  const priceLabel = formatCurrency(
    payload.pricingSnapshot.total.amountMinor,
    payload.pricingSnapshot.total.currency,
  );
  const parcelSummary = `${parcelCategoryLabels[payload.parcel.category]} / ${
    parcelSizeLabels[payload.parcel.approximateSize]
  } / ${parcelPackagingLabels[payload.parcel.packaging]}. Greutate estimată ${
    payload.parcel.estimatedWeightRange
  }. ${payload.parcel.contentDescription}`;
  const paymentStatus = createdOrder.paymentStatus ?? "unpaid";
  const isPaid = paymentStatus === "paid";
  const isCompletedMission = createdOrder.fulfillmentStatus === "completed_mission";
  const isMissionFinal =
    isCompletedMission ||
    createdOrder.fulfillmentStatus === "failed_mission" ||
    createdOrder.fulfillmentStatus === "fallback_required" ||
    createdOrder.fulfillmentStatus === "canceled";

  return (
    <LiveMissionTrackingView
      order={createdOrder}
      statusLabel={getCreatedOrderStatusLabel(createdOrder)}
      urgencyLabel={getUrgencyLabel(payload.urgency)}
      priceLabel={priceLabel}
      etaLabel={etaLabel}
      paymentLabel={isPaid ? "Plată cu cardul confirmată" : "Plată necesară"}
      paymentStatus={paymentStatus}
      checkoutHref="/client/create-delivery?checkout=moved"
      parcelSummary={parcelSummary}
      droneSummary={getDeliveryConfigurationSummary(payload)}
      outcomeSummary={
        isCompletedMission
          ? "Dovada livrării este disponibilă în înregistrarea misiunii finalizate."
          : "Dovada livrării va fi pregătită după ridicarea coletului de către destinatar și închiderea misiunii."
      }
      startOnMount={
        (createdOrder.status === "scheduled" ||
          createdOrder.status === "pending_scheduled_start") &&
        isPaid &&
        !isMissionFinal
      }
    />
  );
}
