import { describe, expect, it } from "vitest";

import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";
import { resolveAllowedColumn } from "@/lib/supabase/query-safety";

describe("Supabase query safety", () => {
  it("maps only allowlisted sort columns", () => {
    const allowed = ["created_at", "updated_at"] as const;

    expect(resolveAllowedColumn("updated_at", allowed, "created_at")).toBe(
      "updated_at",
    );
    expect(
      resolveAllowedColumn("' OR 1=1 --", allowed, "created_at"),
    ).toBe("created_at");
  });

  it("treats an injection payload as a value, never as an identifier", () => {
    expect(getOrderIdentifierColumn("' OR 1=1 --")).toBe("local_order_id");
    expect(
      getOrderIdentifierColumn("123e4567-e89b-12d3-a456-426614174000"),
    ).toBe("id");
  });
});
