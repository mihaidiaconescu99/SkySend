import { describe, it, expect } from "vitest";

import {
  automaticMissionStatuses,
  getAllowedMissionAction,
  getMissionPhaseForStatus,
  getMissionStepConfig,
  getNextMissionStatus,
  isMissionWaitingForUser,
  missionActionStatuses,
  missionStateMachine,
} from "@/lib/mission-state-machine";
import type { MissionStatus } from "@/types/mission";

describe("missionStateMachine — valid transitions", () => {
  it("should transition from mission_created to preflight_checks when advancing", () => {
    expect(getNextMissionStatus("mission_created")).toBe("preflight_checks");
  });

  it("should transition from preflight_checks to drone_dispatched when advancing", () => {
    expect(getNextMissionStatus("preflight_checks")).toBe("drone_dispatched");
  });

  it("should transition from en_route_to_pickup to arrived_at_pickup, and from pickup_safety_check to locker_descending_pickup", () => {
    expect(getNextMissionStatus("en_route_to_pickup")).toBe("arrived_at_pickup");
    expect(getNextMissionStatus("pickup_safety_check")).toBe(
      "locker_descending_pickup",
    );
  });
});

describe("missionStateMachine — invalid transitions", () => {
  it("should NOT allow mission_created to skip directly to delivery_completed", () => {
    const next = getNextMissionStatus("mission_created");

    expect(next).not.toBe("delivery_completed");
    expect(next).toBe("preflight_checks");
  });

  it("should not transition out of mission_closed — it is a terminal state with no next status", () => {
    const config = getMissionStepConfig("mission_closed");

    expect(config.nextStatus).toBeNull();
    expect(config.advanceMode).toBe("terminal");
  });
});

describe("missionStateMachine — advanceMode classification", () => {
  it("should classify awaiting_pickup_pin as requires_action with verify_pickup_pin allowed", () => {
    const config = getMissionStepConfig("awaiting_pickup_pin");

    expect(config.advanceMode).toBe("requires_action");
    expect(isMissionWaitingForUser("awaiting_pickup_pin")).toBe(true);
    expect(getAllowedMissionAction("awaiting_pickup_pin")).toBe(
      "verify_pickup_pin",
    );
  });

  it("should classify en_route_to_pickup as automatic with no allowed action", () => {
    const config = getMissionStepConfig("en_route_to_pickup");

    expect(config.advanceMode).toBe("automatic");
    expect(isMissionWaitingForUser("en_route_to_pickup")).toBe(false);
    expect(getAllowedMissionAction("en_route_to_pickup")).toBeNull();
  });
});

describe("missionStateMachine — terminal states", () => {
  it("should identify mission_closed and mission_failed as terminal states with null next", () => {
    const closed = getMissionStepConfig("mission_closed");
    const failed = getMissionStepConfig("mission_failed");

    expect(closed.advanceMode).toBe("terminal");
    expect(closed.nextStatus).toBeNull();
    expect(failed.advanceMode).toBe("terminal");
    expect(failed.nextStatus).toBeNull();
  });

  it("should transition from returned_to_hub to mission_failed on the exception path", () => {
    const config = getMissionStepConfig("returned_to_hub");

    expect(config.nextStatus).toBe("mission_failed");
    expect(config.phase).toBe("exception");
  });
});

describe("missionStateMachine — happy path traversal", () => {
  it("should reach mission_closed by following nextStatus from mission_created without revisiting any state", () => {
    const visited: MissionStatus[] = [];
    let current: MissionStatus | null = "mission_created";

    while (current !== null) {
      if (visited.includes(current)) {
        throw new Error(`Cycle detected at ${current}`);
      }
      visited.push(current);
      current = getNextMissionStatus(current);
    }

    expect(visited[0]).toBe("mission_created");
    expect(visited[visited.length - 1]).toBe("mission_closed");

    expect(visited).toHaveLength(24);
    expect(visited).toContain("locker_descending_pickup");
    expect(visited).toContain("payload_verification");
    expect(visited).toContain("en_route_to_dropoff");
    expect(visited).toContain("proof_generated");
  });

  it("should cover every defined state when combining the happy path and the exception branches", () => {
    const totalStates = Object.keys(missionStateMachine).length;
    const automaticCount = automaticMissionStatuses.length;
    const actionCount = missionActionStatuses.length;
    const terminalCount = Object.values(missionStateMachine).filter(
      (step) => step.advanceMode === "terminal",
    ).length;

    expect(automaticCount + actionCount + terminalCount).toBe(totalStates);
    expect(totalStates).toBeGreaterThanOrEqual(27);
  });
});

describe("missionStateMachine — fallback / exception branches", () => {
  it("should define fallback_required as a requires_action exception state with trigger_fallback action", () => {
    const config = getMissionStepConfig("fallback_required");

    expect(config.advanceMode).toBe("requires_action");
    expect(config.allowedAction).toBe("trigger_fallback");
    expect(config.phase).toBe("exception");

    expect(config.nextStatus).toBe("mission_failed");
  });

  it("should transition from returning_to_hub to returned_to_hub and place both on the exception phase", () => {
    const returning = getMissionStepConfig("returning_to_hub");
    const returned = getMissionStepConfig("returned_to_hub");

    expect(returning.nextStatus).toBe("returned_to_hub");
    expect(returning.phase).toBe("exception");
    expect(returned.nextStatus).toBe("mission_failed");
    expect(returned.phase).toBe("exception");
    expect(getMissionPhaseForStatus("returning_to_hub")).toBe("exception");
  });
});
