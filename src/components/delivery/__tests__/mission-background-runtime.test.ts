import { describe, expect, it } from "vitest";
import { selectMissionRuntimeOrder } from "@/components/delivery/mission-background-runtime";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

function order(
  id: string,
  fulfillmentStatus: CreatedDeliveryOrder["fulfillmentStatus"] = "active_mission",
) {
  return {
    id,
    paymentStatus: "paid",
    fulfillmentStatus,
  } as CreatedDeliveryOrder;
}

describe("selectMissionRuntimeOrder", () => {
  it("selects the order opened in the tracking route when several orders are active", () => {
    const orders = [order("SKY-PT-OLD"), order("SKY-PT-CURRENT")];

    expect(
      selectMissionRuntimeOrder(
        orders,
        "/client/orders/SKY-PT-CURRENT",
      )?.id,
    ).toBe("SKY-PT-CURRENT");
  });

  it("does not fall back to another order while the routed order is unavailable", () => {
    const orders = [
      order("SKY-PT-ACTIVE"),
      order("SKY-PT-DONE", "completed_mission"),
    ];

    expect(
      selectMissionRuntimeOrder(orders, "/client/orders/SKY-PT-DONE")?.id,
    ).toBeUndefined();
  });
});
