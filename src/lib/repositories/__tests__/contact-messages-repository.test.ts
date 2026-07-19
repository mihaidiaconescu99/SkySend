import { beforeEach, describe, expect, it } from "vitest";

import { ContactMessagesRepository } from "@/lib/repositories/contact-messages-repository";
import {
  buildContactMessageRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: ContactMessagesRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new ContactMessagesRepository(fake.client);
});

describe("ContactMessagesRepository.getById", () => {
  it("returns the mapped message when the row exists", async () => {
    store.seedContactMessage(
      buildContactMessageRow({
        id: "cm-1",
        subject: "Test",
        body: "Hello",
      }),
    );
    const result = await repo.getById("cm-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.subject).toBe("Test");
      expect(result.data.body).toBe("Hello");
      expect(result.data.status).toBe("new");
    }
  });

  it("returns data: null when no row matches", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("ContactMessagesRepository.create", () => {
  it("creates a message with status defaulting to 'new'", async () => {
    const result = await repo.create({
      senderEmail: "ana@example.com",
      subject: "Întrebare",
      body: "Salut!",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.senderEmail).toBe("ana@example.com");
      expect(result.data.status).toBe("new");
      expect(result.data.category).toBeNull();
    }
  });

  it("preserves senderName and category when provided", async () => {
    const result = await repo.create({
      senderEmail: "ops@example.com",
      senderName: "Ops",
      subject: "Bug",
      body: "Detalii…",
      category: "suport",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.senderName).toBe("Ops");
      expect(result.data.category).toBe("suport");
    }
  });

  it("rejects an invalid email", async () => {
    const result = await repo.create({
      senderEmail: "not-an-email",
      subject: "T",
      body: "B",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects an empty body", async () => {
    const result = await repo.create({
      senderEmail: "a@b.co",
      subject: "T",
      body: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects an unknown category", async () => {
    const result = await repo.create({
      senderEmail: "a@b.co",
      subject: "T",
      body: "B",
      category: "not-a-category" as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("ContactMessagesRepository.updateById", () => {
  it("flips status from new to read", async () => {
    store.seedContactMessage(
      buildContactMessageRow({ id: "cm-1", status: "new" }),
    );
    const result = await repo.updateById("cm-1", { status: "read" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("read");
  });

  it("attaches an internal note", async () => {
    store.seedContactMessage(buildContactMessageRow({ id: "cm-1" }));
    const result = await repo.updateById("cm-1", {
      internalNote: "Already handled via email.",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.internalNote).toBe("Already handled via email.");
    }
  });

  it("returns not_found for unknown id", async () => {
    const result = await repo.updateById("nope", { status: "read" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("rejects an empty update", async () => {
    store.seedContactMessage(buildContactMessageRow({ id: "cm-1" }));
    const result = await repo.updateById("cm-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects an invalid status", async () => {
    store.seedContactMessage(buildContactMessageRow({ id: "cm-1" }));
    const result = await repo.updateById("cm-1", {
      status: "trashed" as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("ContactMessagesRepository.deleteById", () => {
  it("deletes an existing message", async () => {
    store.seedContactMessage(buildContactMessageRow({ id: "cm-1" }));
    const result = await repo.deleteById("cm-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(store.contactMessageRows.has("cm-1")).toBe(false);
  });

  it("returns not_found for unknown id", async () => {
    const result = await repo.deleteById("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("ContactMessagesRepository.list", () => {
  beforeEach(() => {
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedContactMessage(
      buildContactMessageRow({
        id: "n1",
        status: "new",
        category: "suport",
        created_at: isoFor(5),
      }),
    );
    store.seedContactMessage(
      buildContactMessageRow({
        id: "n2",
        status: "new",
        category: "feedback",
        created_at: isoFor(10),
      }),
    );
    store.seedContactMessage(
      buildContactMessageRow({
        id: "r1",
        status: "read",
        category: "suport",
        created_at: isoFor(7),
      }),
    );
    store.seedContactMessage(
      buildContactMessageRow({
        id: "a1",
        status: "archived",
        category: null,
        created_at: isoFor(1),
      }),
    );
  });

  it("returns every row, newest first by default", async () => {
    const result = await repo.list();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(4);
      expect(result.data[0].id).toBe("n2");
    }
  });

  it("filters by status", async () => {
    const result = await repo.list({ status: "new" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((m) => m.status === "new")).toBe(true);
    }
  });

  it("filters by category", async () => {
    const result = await repo.list({ category: "suport" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((m) => m.category === "suport")).toBe(true);
    }
  });

  it("respects a limit", async () => {
    const result = await repo.list({ limit: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });

  it("returns an empty array when the table is empty", async () => {

    store.contactMessageRows.clear();
    const result = await repo.list();
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("ContactMessagesRepository.countByStatus", () => {
  it("returns the count of rows in the given status", async () => {
    store.seedContactMessage(
      buildContactMessageRow({ id: "n1", status: "new" }),
    );
    store.seedContactMessage(
      buildContactMessageRow({ id: "n2", status: "new" }),
    );
    store.seedContactMessage(
      buildContactMessageRow({ id: "r1", status: "read" }),
    );

    const result = await repo.countByStatus("new");
    expect(result).toEqual({ ok: true, data: 2 });
  });

  it("returns 0 when no rows match", async () => {
    const result = await repo.countByStatus("archived");
    expect(result).toEqual({ ok: true, data: 0 });
  });
});
