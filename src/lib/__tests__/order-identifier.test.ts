import { describe, expect, it } from "vitest";

import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";

describe("getOrderIdentifierColumn", () => {
  it("queries public SkySend order identifiers through local_order_id", () => {
    expect(getOrderIdentifierColumn("SKY-PT-12345-678")).toBe("local_order_id");
  });

  it("queries database UUIDs through id", () => {
    expect(
      getOrderIdentifierColumn("8f07a59e-54a3-4f25-bfbb-1247fa23a122"),
    ).toBe("id");
  });
});
