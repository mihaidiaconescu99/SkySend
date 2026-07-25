"use client";

import { useEffect, useRef, useState } from "react";
import { PremiumTrackingWorkspace } from "@/components/delivery/premium-tracking-workspace";
import { useMissionRuntime } from "@/hooks/use-mission-runtime";
import {
  getPaidOrderMissionDispatchStartMs,
  missionDispatchDelaySeconds,
} from "@/lib/mission-runtime";
import {
  getScheduledDeliveryStartMs,
  isScheduledDeliveryWaiting,
} from "@/lib/scheduled-delivery";
import type {
  CreatedDeliveryOrder,
  CreatedDeliveryPaymentStatus,
} from "@/types/create-delivery";

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

function getDispatchCountdown(
  order: CreatedDeliveryOrder,
  paymentStatus: CreatedDeliveryPaymentStatus,
  nowMs = Date.now(),
) {
  if (paymentStatus !== "paid" || isScheduledDeliveryWaiting(order, nowMs)) {
    return 0;
  }

  const dispatchStartMs = getPaidOrderMissionDispatchStartMs(order);
  if (dispatchStartMs === null) return 0;

  return Math.max(0, Math.ceil((dispatchStartMs - nowMs) / 1000));
}

export function LiveMissionTrackingView({
  order,
  startOnMount = true,
  paymentStatus = "paid",
}: LiveMissionTrackingViewProps) {
  const {
    currentMission,
    currentStatus,
    isMissionRunning,
    createMissionFromOrder,
    startMission,
    syncPaidCreatedDeliveryOrderMission,
  } = useMissionRuntime();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dispatchCountdown, setDispatchCountdown] = useState(() =>
    getDispatchCountdown(order, paymentStatus),
  );
  const dispatchRefreshRequestedRef = useRef(false);
  const isPaymentPaid = paymentStatus === "paid";
  const isWaitingForScheduledStart = isScheduledDeliveryWaiting(order, nowMs);
  const scheduledStartMs = getScheduledDeliveryStartMs(order);

  useEffect(() => {
    dispatchRefreshRequestedRef.current = false;
  }, [order.id]);

  useEffect(() => {
    if (!isPaymentPaid || !startOnMount) return;

    const updateCountdown = () => {
      const timestamp = Date.now();
      setNowMs(timestamp);
      setDispatchCountdown(getDispatchCountdown(order, paymentStatus, timestamp));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(interval);
  }, [isPaymentPaid, order, paymentStatus, startOnMount]);

  useEffect(() => {
    if (
      !isPaymentPaid ||
      !startOnMount ||
      isWaitingForScheduledStart ||
      dispatchCountdown > 0 ||
      order.missionStatus !== "mission_created" ||
      dispatchRefreshRequestedRef.current
    ) {
      return;
    }

    dispatchRefreshRequestedRef.current = true;
    void fetch(
      `/api/client/orders/${encodeURIComponent(order.id)}/start-dispatch`,
      { method: "POST" },
    ).finally(() => {
      const snapshot = syncPaidCreatedDeliveryOrderMission(order, {
        isLiveTrackingVisible: true,
      });
      if (
        snapshot.currentMission?.sourceOrderId === order.id &&
        !snapshot.isMissionRunning
      ) {
        startMission();
      }
    });
  }, [
    dispatchCountdown,
    isPaymentPaid,
    isWaitingForScheduledStart,
    order.missionStatus,
    order,
    startMission,
    startOnMount,
    syncPaidCreatedDeliveryOrderMission,
  ]);

  useEffect(() => {
    if (
      !isPaymentPaid ||
      !startOnMount ||
      isWaitingForScheduledStart ||
      dispatchCountdown > 0
    ) {
      return;
    }

    const syncedSnapshot = syncPaidCreatedDeliveryOrderMission(order, {
      isLiveTrackingVisible: true,
    });
    if (syncedSnapshot.currentMission?.sourceOrderId === order.id) {
      if (!syncedSnapshot.isMissionRunning) startMission();
      return;
    }

    if (currentMission?.sourceOrderId === order.id) {
      if (
        !isMissionRunning &&
        currentStatus !== "mission_closed" &&
        scheduledStartMs !== null
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
    isMissionRunning,
    isPaymentPaid,
    isWaitingForScheduledStart,
    order,
    scheduledStartMs,
    startMission,
    startOnMount,
    syncPaidCreatedDeliveryOrderMission,
  ]);

  return (
    <PremiumTrackingWorkspace
      order={order}
      paymentStatus={paymentStatus}
      dispatchCountdown={
        isPaymentPaid && startOnMount && !isWaitingForScheduledStart
          ? dispatchCountdown
          : 0
      }
    />
  );
}

export { missionDispatchDelaySeconds };
