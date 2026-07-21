"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCreatedDeliveryOrders } from "@/hooks/use-created-delivery-orders";
import { getMissionFromDB } from "@/lib/mission-persistence";
import {
  clearOrderPendingDBRehydration,
  markOrderPendingDBRehydration,
  missionRuntimeStore,
  rehydrateMissionFromDB,
  syncMissionFromRecord,
  syncPaidCreatedDeliveryOrderMission,
} from "@/lib/mission-runtime";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

function isOrderStillRunnable(order: CreatedDeliveryOrder) {
  return (
    order.paymentStatus === "paid" &&
    order.fulfillmentStatus !== "completed_mission" &&
    order.fulfillmentStatus !== "failed_mission" &&
    order.fulfillmentStatus !== "fallback_required" &&
    order.fulfillmentStatus !== "canceled"
  );
}

function isLiveTrackingPath(pathname: string | null) {
  return Boolean(pathname?.match(/^\/client\/orders\/[^/]+$/));
}

export function selectMissionRuntimeOrder(
  orders: readonly CreatedDeliveryOrder[],
  pathname: string | null,
) {
  const routeMatch = pathname?.match(/^\/client\/orders\/([^/]+)$/);
  const routeOrderId = routeMatch?.[1]
    ? decodeURIComponent(routeMatch[1])
    : null;

  if (routeOrderId) {
    return orders.find(
      (order) => order.id === routeOrderId && isOrderStillRunnable(order),
    );
  }

  return orders.find(isOrderStillRunnable);
}

export function MissionBackgroundRuntime() {
  const { orders } = useCreatedDeliveryOrders();
  const pathname = usePathname();

  useEffect(() => {
    const order = selectMissionRuntimeOrder(orders, pathname);

    if (!order) return;

    if (missionRuntimeStore.getSnapshot().currentMission?.sourceOrderId === order.id) {
      return;
    }

    markOrderPendingDBRehydration(order.id);
    let cancelled = false;

    void (async () => {
      try {
        const dbMission = await getMissionFromDB(order.id);

        if (cancelled) return;

        if (
          !dbMission ||
          dbMission.currentStatus === "mission_closed" ||
          dbMission.currentStatus === "mission_failed"
        ) {

          clearOrderPendingDBRehydration(order.id);
          return;
        }

        rehydrateMissionFromDB(dbMission, order);
      } catch (err) {
        if (cancelled) return;
        console.warn("[MissionBackgroundRuntime] DB rehydration error:", err);
        clearOrderPendingDBRehydration(order.id);
      }
    })();

    return () => {
      cancelled = true;
      clearOrderPendingDBRehydration(order.id);
    };
  }, [orders, pathname]);

  useEffect(() => {
    const order = selectMissionRuntimeOrder(orders, pathname);
    if (!order) return;
    let cancelled = false;

    const poll = async () => {
      await fetch(
        `/api/orders/by-tracking-identifier?identifier=${encodeURIComponent(order.id)}`,
        { headers: { Accept: "application/json" }, credentials: "include" },
      ).catch(() => null);

      if (cancelled) return;
      await getMissionFromDB(order.id).then((mission) => {
        if (cancelled || !mission) return;
        syncMissionFromRecord(mission, order);
      });
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [orders, pathname]);

  useEffect(() => {
    const syncActiveMission = () => {
      const order = selectMissionRuntimeOrder(orders, pathname);

      if (!order) {
        return;
      }

      syncPaidCreatedDeliveryOrderMission(order, {
        notify: true,
        isLiveTrackingVisible: isLiveTrackingPath(pathname),
      });
    };

    syncActiveMission();
    const interval = window.setInterval(syncActiveMission, 1000);

    return () => window.clearInterval(interval);
  }, [orders, pathname]);

  return null;
}
