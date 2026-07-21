import { describe, expect, it } from "vitest";
import { getActionCapabilities, isOrderTerminal } from "@/lib/tracking-access-server";
import type { Order } from "@/types/order";

describe("tracking access capabilities", () => {
  it("keeps role links limited to their mission phase", () => {
    expect(getActionCapabilities("pickup")).toEqual({
      canPickup: true,
      canDropoff: false,
      canManageSharing: false,
    });
    expect(getActionCapabilities("dropoff")).toEqual({
      canPickup: false,
      canDropoff: true,
      canManageSharing: false,
    });
  });

  it("gives the owner and full link both action phases", () => {
    expect(getActionCapabilities("owner").canManageSharing).toBe(true);
    expect(getActionCapabilities("full")).toMatchObject({ canPickup: true, canDropoff: true });
    expect(getActionCapabilities("view")).toMatchObject({ canPickup: false, canDropoff: false });
  });

  it("makes completed, failed and cancelled orders terminal", () => {
    for (const status of ["completed", "failed", "cancelled"] as const) {
      expect(isOrderTerminal({ status } as Order)).toBe(true);
    }
    expect(isOrderTerminal({ status: "in_progress" } as Order)).toBe(false);
  });
});
