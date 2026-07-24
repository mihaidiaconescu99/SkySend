import { describe, expect, it } from "vitest";

import { safeHttpUrl, safeInternalPath } from "@/lib/url-safety";

describe("URL safety", () => {
  it("accepts normal internal application paths", () => {
    expect(safeInternalPath(" /client/orders/SKY-PT-12345-000?view=all "))
      .toBe("/client/orders/SKY-PT-12345-000?view=all");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//attacker.example/path",
    "https://attacker.example/path",
  ])("rejects unsafe internal action URL %s", (value) => {
    expect(safeInternalPath(value)).toBeNull();
  });

  it("accepts HTTP(S) evidence URLs and rejects executable schemes", () => {
    expect(safeHttpUrl("https://example.com/result?q=parcel"))
      .toBe("https://example.com/result?q=parcel");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
});
