import { describe, expect, it, vi } from "vitest";

import {
  fetchWithTimeout,
  readLimitedJsonResponse,
  UpstreamBodyTooLargeError,
  UpstreamTimeoutError,
} from "@/lib/api/upstream";

describe("bounded upstream requests", () => {
  it("aborts a stalled upstream deterministically", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    ) as unknown as typeof fetch;

    const pending = fetchWithTimeout("https://upstream.test", {}, {
      timeoutMs: 50,
      fetchImpl,
    });
    const rejection = expect(pending).rejects.toBeInstanceOf(
      UpstreamTimeoutError,
    );
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    vi.useRealTimers();
  });

  it("rejects an oversized upstream body before parsing JSON", async () => {
    const response = new Response(JSON.stringify({ value: "x".repeat(100) }), {
      headers: { "content-type": "application/json" },
    });
    await expect(readLimitedJsonResponse(response, 16)).rejects.toBeInstanceOf(
      UpstreamBodyTooLargeError,
    );
  });
});
