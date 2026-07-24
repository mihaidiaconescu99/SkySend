import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/ai/assistant/route";

describe("POST /api/ai/assistant body limit", () => {
  it("preserves 413 for a body over the endpoint limit", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "x".repeat(9 * 1024) }),
      }),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("payload_too_large");
  });
});
