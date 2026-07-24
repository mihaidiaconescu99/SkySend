import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  normalizedEmailSchema,
  plainTextSchema,
  uuidSchema,
} from "@/lib/api/input-schemas";
import { validateRequest } from "@/lib/api/validation";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const PersonSchema = z.object({
  name: plainTextSchema(1, 80),
  age: z.number().int().nonnegative(),
  email: normalizedEmailSchema.optional(),
  profileId: uuidSchema.optional(),
}).strict();

describe("validateRequest", () => {
  it("returns ok=true and typed data when the body matches the schema", async () => {
    const request = makeRequest({ name: "Ana", age: 30 });

    const result = await validateRequest(PersonSchema, request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Ana", age: 30 });
    }
  });

  it("returns ok=false with a 400 NextResponse and structured details when the body fails the schema", async () => {
    const request = makeRequest({ name: "", age: -5 });

    const result = await validateRequest(PersonSchema, request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const payload = await result.response.json();
      expect(payload.error).toBe("ValidationError");
      expect(payload.details).toBeDefined();
      expect(payload.details.fieldErrors).toBeDefined();

      expect(payload.details.fieldErrors.name).toBeDefined();
      expect(payload.details.fieldErrors.age).toBeDefined();
    }
  });

  it("returns a structured 400 error when the request body is not valid JSON", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });

    const result = await validateRequest(PersonSchema, request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const payload = await result.response.json();
      expect(payload.error).toBe("ValidationError");
      expect(payload.code).toBe("invalid_json");
      expect(payload.details.formErrors).toContain("Invalid JSON body.");
    }
  });

  it("returns ok=false when required fields are missing", async () => {
    const request = makeRequest({ name: "Ana" });

    const result = await validateRequest(PersonSchema, request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const payload = await result.response.json();
      expect(payload.details.fieldErrors.age).toBeDefined();
    }
  });

  it("rejects an incorrect type and a negative numeric value", async () => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({ name: "Ana", age: "-1" }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((await result.response.json()).details.fieldErrors.age).toBeDefined();
    }
  });

  it("rejects strings above the declared field limit", async () => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({ name: "a".repeat(81), age: 30 }),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects invalid UUIDs and email addresses", async () => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({
        name: "Ana",
        age: 30,
        profileId: "not-a-uuid",
        email: "not-an-email",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const payload = await result.response.json();
      expect(payload.details.fieldErrors.profileId).toBeDefined();
      expect(payload.details.fieldErrors.email).toBeDefined();
    }
  });

  it("rejects unexpected properties", async () => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({ name: "Ana", age: 30, role: "admin" }),
    );

    expect(result.ok).toBe(false);
  });

  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
  ])("rejects HTML or JavaScript in plain text: %s", async (name) => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({ name, age: 30 }),
    );

    expect(result.ok).toBe(false);
  });

  it("returns 413 when the actual JSON payload exceeds the route limit", async () => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({ name: "Ana", age: 30, padding: "x".repeat(2_000) }),
      { maxBytes: 512 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      expect((await result.response.json()).code).toBe("payload_too_large");
    }
  });

  it("normalizes legitimate email input without changing valid data", async () => {
    const result = await validateRequest(
      PersonSchema,
      makeRequest({ name: "  Ana Pop  ", age: 30, email: " ANA@EXAMPLE.COM " }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        name: "Ana Pop",
        age: 30,
        email: "ana@example.com",
      });
    }
  });
});
