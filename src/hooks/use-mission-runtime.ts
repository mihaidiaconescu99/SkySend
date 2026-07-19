"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  missionRuntimeStore,
  type MissionRuntimeSnapshot,
} from "@/lib/mission-runtime";

export type UseMissionRuntimeResult = MissionRuntimeSnapshot & {
  snapshot: MissionRuntimeSnapshot;
  createMissionFromOrder: typeof missionRuntimeStore.createMissionFromOrder;
  startMission: typeof missionRuntimeStore.startMission;
  syncPaidCreatedDeliveryOrderMission:
    typeof missionRuntimeStore.syncPaidCreatedDeliveryOrderMission;
  confirmSenderPosition: typeof missionRuntimeStore.confirmSenderPosition;
  confirmPickupMeetingPoint: typeof missionRuntimeStore.confirmPickupMeetingPoint;
  rejectPickupMeetingPointAndTryNext: typeof missionRuntimeStore.rejectPickupMeetingPointAndTryNext;
  activeatePickupFallbackIfNoPointsLeft: typeof missionRuntimeStore.activeatePickupFallbackIfNoPointsLeft;
  verifyPickupPin: typeof missionRuntimeStore.verifyPickupPin;
  confirmParcelLoaded: typeof missionRuntimeStore.confirmParcelLoaded;
  confirmRecipientPosition: typeof missionRuntimeStore.confirmRecipientPosition;
  confirmDropoffMeetingPoint: typeof missionRuntimeStore.confirmDropoffMeetingPoint;
  rejectDropoffMeetingPointAndTryNext: typeof missionRuntimeStore.rejectDropoffMeetingPointAndTryNext;
  activeateDropoffFallbackIfNoPointsLeft: typeof missionRuntimeStore.activeateDropoffFallbackIfNoPointsLeft;
  verifyRecipientPin: typeof missionRuntimeStore.verifyRecipientPin;
  confirmParcelCollected: typeof missionRuntimeStore.confirmParcelCollected;
  resetMission: typeof missionRuntimeStore.resetMission;
};

export function useMissionRuntime(): UseMissionRuntimeResult {
  const snapshot = useSyncExternalStore(
    missionRuntimeStore.subscribe,
    missionRuntimeStore.getSnapshot,
    missionRuntimeStore.getSnapshot,
  );

  return useMemo(
    () => ({
      snapshot,
      currentMission: snapshot.currentMission,
      currentStatus: snapshot.currentStatus,
      activeSegment: snapshot.activeSegment,
      segmentProgress: snapshot.segmentProgress,
      dronePosition: snapshot.dronePosition,
      lockerState: snapshot.lockerState,
      droneTelemetry: snapshot.droneTelemetry,
      pendingAction: snapshot.pendingAction,
      eventLog: snapshot.eventLog,
      isMissionRunning: snapshot.isMissionRunning,
      isWaitingForUser: snapshot.isWaitingForUser,
      userActionTimer: snapshot.userActionTimer,
      isRehydrating: snapshot.isRehydrating,
      createMissionFromOrder: missionRuntimeStore.createMissionFromOrder,
      startMission: missionRuntimeStore.startMission,
      syncPaidCreatedDeliveryOrderMission:
        missionRuntimeStore.syncPaidCreatedDeliveryOrderMission,
      confirmSenderPosition: missionRuntimeStore.confirmSenderPosition,
      confirmPickupMeetingPoint: missionRuntimeStore.confirmPickupMeetingPoint,
      rejectPickupMeetingPointAndTryNext:
        missionRuntimeStore.rejectPickupMeetingPointAndTryNext,
      activeatePickupFallbackIfNoPointsLeft:
        missionRuntimeStore.activeatePickupFallbackIfNoPointsLeft,
      verifyPickupPin: missionRuntimeStore.verifyPickupPin,
      confirmParcelLoaded: missionRuntimeStore.confirmParcelLoaded,
      confirmRecipientPosition: missionRuntimeStore.confirmRecipientPosition,
      confirmDropoffMeetingPoint: missionRuntimeStore.confirmDropoffMeetingPoint,
      rejectDropoffMeetingPointAndTryNext:
        missionRuntimeStore.rejectDropoffMeetingPointAndTryNext,
      activeateDropoffFallbackIfNoPointsLeft:
        missionRuntimeStore.activeateDropoffFallbackIfNoPointsLeft,
      verifyRecipientPin: missionRuntimeStore.verifyRecipientPin,
      confirmParcelCollected: missionRuntimeStore.confirmParcelCollected,
      resetMission: missionRuntimeStore.resetMission,
    }),
    [snapshot],
  );
}

