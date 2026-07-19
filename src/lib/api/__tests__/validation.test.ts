import { describe, it, expect } from "vitest";
import { z } from "zod";

import { validateRequest } from "@/lib/api/validation";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const PersonSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().nonnegative(),
});

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
});
