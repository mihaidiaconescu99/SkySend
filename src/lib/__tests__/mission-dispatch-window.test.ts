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
  it("uses a seven-second server-aligned delay", () => {
    expect(missionDispatchDelaySeconds).toBe(7);
    expect(getPaidOrderMissionDispatchStartMs(order({ paidAt: "2026-07-23T10:00:00.000Z" })))
      .toBe(Date.parse("2026-07-23T10:00:07.000Z"));
  });

  it("anchors scheduled delivery countdown at the scheduled time", () => {
    expect(getPaidOrderMissionDispatchStartMs(order({
      paidAt: "2026-07-23T10:00:00.000Z",
      scheduledAt: "2026-07-23T12:00:00.000Z",
    }))).toBe(Date.parse("2026-07-23T12:00:07.000Z"));
  });

  it("prefers the persisted server timestamp", () => {
    expect(getPaidOrderMissionDispatchStartMs(order({
      paidAt: "2026-07-23T10:00:00.000Z",
      dispatchStartsAt: "2026-07-23T15:30:04.000Z",
    }))).toBe(Date.parse("2026-07-23T15:30:04.000Z"));
  });
});
