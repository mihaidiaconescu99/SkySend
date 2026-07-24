import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildContactMessageRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

const adminMock = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: adminMock.createAdminSupabaseClient,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

const { POST } = await import("@/app/api/contact-messages/route");

let store: FakeStore;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  adminMock.createAdminSupabaseClient.mockReturnValue(fake.client);
});

afterEach(() => {
  vi.clearAllMocks();
});

function postJson(body: unknown) {
  return POST(
    new Request("https://test.local/api/contact-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/contact-messages", () => {
  it("inserts the message into Supabase and returns the mapped row", async () => {
    const response = await postJson({
      email: "ana@example.com",
      subject: "Întrebare",
      category: "support",
      message: "Salut!",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.message).toMatchObject({
      subject: "Întrebare",
      category: "support",
      status: "new",
    });

    expect(store.contactMessageRows.size).toBe(1);
    const inserted = [...store.contactMessageRows.values()][0];
    expect(inserted.sender_email).toBe("ana@example.com");
    expect(inserted.category).toBe("support");
  });

  it("accepts legacy categories (suport, feedback, sales, altul)", async () => {
    const response = await postJson({
      email: "ana@example.com",
      subject: "Feedback",
      category: "suport",
      message: "Mesaj",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.message.category).toBe("suport");
  });

  it("returns 400 when the email is invalid", async () => {
    const response = await postJson({
      email: "not-an-email",
      subject: "Subiect",
      category: "support",
      message: "Mesaj",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
    expect(store.contactMessageRows.size).toBe(0);
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await postJson({
      email: "ana@example.com",
      subject: "",
      category: "support",
      message: "Mesaj",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
    expect(store.contactMessageRows.size).toBe(0);
  });

  it("returns 400 on malformed JSON", async () => {
    const response = await POST(
      new Request("https://test.local/api/contact-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects HTML/JavaScript and unexpected protected-looking fields", async () => {
    const response = await postJson({
      email: "ana@example.com",
      subject: "Subiect",
      category: "support",
      message: "<script>alert('x')</script>",
      status: "resolved",
    });

    expect(response.status).toBe(400);
    expect(store.contactMessageRows.size).toBe(0);
  });

  it("rejects a JSON payload above the contact form limit", async () => {
    const response = await postJson({
      email: "ana@example.com",
      subject: "Subiect",
      category: "support",
      message: "x".repeat(17 * 1024),
    });

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("payload_too_large");
  });

  it("normalizes a legitimate email before persistence", async () => {
    const response = await postJson({
      email: " ANA@EXAMPLE.COM ",
      subject: "Subiect valid",
      category: "support",
      message: "Mesaj valid",
    });

    expect(response.status).toBe(201);
    expect([...store.contactMessageRows.values()][0]?.sender_email).toBe("ana@example.com");
  });

  it("returns 502 when the DB insert fails", async () => {
    store.injectErrorOnNext("insert", {
      code: "P0001",
      message: "forced failure",
    });

    const response = await postJson({
      email: "ana@example.com",
      subject: "Subiect",
      category: "support",
      message: "Mesaj",
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("db_insert_failed");
    expect(JSON.stringify(body)).not.toContain("forced failure");
  });

  it("does not pretend the message was saved when the DB write fails", async () => {

    store.injectErrorOnNext("insert", {
      code: "P0001",
      message: "forced failure",
    });

    const response = await postJson({
      email: "ana@example.com",
      subject: "Subiect",
      category: "support",
      message: "Mesaj",
    });

    expect(response.ok).toBe(false);
    expect(response.status).not.toBe(200);
    expect(response.status).not.toBe(201);
  });

  it("preserves an existing contact_messages row from the seed", async () => {

    store.seedContactMessage(
      buildContactMessageRow({
        id: "99999999-9999-9999-9999-999999999999",
        sender_email: "seed@example.com",
        subject: "Pre-seeded",
        body: "Already in DB",
      }),
    );

    expect(store.contactMessageRows.size).toBe(1);
  });
});
