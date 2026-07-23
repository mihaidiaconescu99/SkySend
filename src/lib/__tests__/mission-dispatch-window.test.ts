import { describe, expect, it } from "vitest";
import {
  getPaidOrderMissionDispatchStartMs,
  missionDispatchDelaySeconds,
} from "@/lib/mission-runtime";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

function order(input: {
  paidAt: string;
  scheduledAt?: string | null;
  dispatchStartsAt?: string | null;
}) {
  return {
    paidAt: input.paidAt,
    dispatchStartsAt: input.dispatchStartsAt ?? null,
    payload: {
      createdAt: input.paidAt,
      urgency: input.scheduledAt ? "scheduled" : "standard",
      scheduledAt: input.scheduledAt ?? null,
    },
  } as CreatedDeliveryOrder;
}

describe("paid-order dispatch window", () => {
  it("uses a ten-second server-aligned delay", () => {
    expect(missionDispatchDelaySeconds).toBe(10);
    expect(getPaidOrderMissionDispatchStartMs(order({ paidAt: "2026-07-23T10:00:00.000Z" })))
      .toBe(Date.parse("2026-07-23T10:00:10.000Z"));
  });

  it("anchors scheduled delivery countdown at the scheduled time", () => {
    expect(getPaidOrderMissionDispatchStartMs(order({
      paidAt: "2026-07-23T10:00:00.000Z",
      scheduledAt: "2026-07-23T12:00:00.000Z",
    }))).toBe(Date.parse("2026-07-23T12:00:10.000Z"));
  });

  it("prefers the persisted server timestamp", () => {
    expect(getPaidOrderMissionDispatchStartMs(order({
      paidAt: "2026-07-23T10:00:00.000Z",
      dispatchStartsAt: "2026-07-23T15:30:04.000Z",
    }))).toBe(Date.parse("2026-07-23T15:30:04.000Z"));
  });
});
