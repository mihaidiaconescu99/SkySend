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

export function MissionBackgroundRuntime() {
  const { orders } = useCreatedDeliveryOrders();
  const pathname = usePathname();

  useEffect(() => {
    const order = orders.find(isOrderStillRunnable);

    if (!order) return;

    if (missionRuntimeStore.getSnapshot().currentMission?.sourceOrderId === order.id) {
      return;
    }

    markOrderPendingDBRehydration(order.id);

    void (async () => {
      try {
        const dbMission = await getMissionFromDB(order.id);

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
        console.warn("[MissionBackgroundRuntime] DB rehydration error:", err);
        clearOrderPendingDBRehydration(order.id);
      }
    })();
  }, [orders]);

  useEffect(() => {
    const syncActiveMission = () => {
      const order = orders.find(isOrderStillRunnable);

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
