import { describe, expect, it } from "vitest";
import { sanitizeSupportSummaryText } from "@/lib/support/support-hub";

describe("support handoff summary sanitization", () => {
  it("removes contact, card and provider identifiers but keeps an order id", () => {
    const result = sanitizeSupportSummaryText(
      "Comanda SKY-AG-12345-001, user@example.com, +40722123456, card 4242 4242 4242 4242, pi_secret123",
    );
    expect(result).toContain("SKY-AG-12345-001");
    expect(result).not.toContain("user@example.com");
    expect(result).not.toContain("40722123456");
    expect(result).not.toContain("4242 4242 4242 4242");
    expect(result).not.toContain("pi_secret123");
  });
});

