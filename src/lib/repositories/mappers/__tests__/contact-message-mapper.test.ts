import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseContactMessageCategory,
  parseContactMessageStatus,
  rowToContactMessage,
  updateInputToRow,
  validateEmail,
} from "@/lib/repositories/mappers/contact-message-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildRow(
  overrides: Partial<DBRow<"contact_messages">> = {},
): DBRow<"contact_messages"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    sender_email: "ana@example.com",
    sender_name: "Ana Pop",
    subject: "Întrebare",
    body: "Salut!",
    category: "suport",
    status: "new",
    read_at: null,
    internal_note: null,
    last_message_at: "2026-05-23T10:00:00Z",
    replied_at: null,
    closed_at: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToContactMessage", () => {
  it("maps every column for a healthy row", () => {
    const row = buildRow();
    expect(rowToContactMessage(row)).toEqual({
      id: row.id,
      senderEmail: row.sender_email,
      senderName: "Ana Pop",
      subject: "Întrebare",
      body: "Salut!",
      category: "suport",
      status: "new",
      readAt: null,
      internalNote: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("maps a null category to null", () => {
    expect(
      rowToContactMessage(buildRow({ category: null })).category,
    ).toBeNull();
  });

  it("throws on an unknown status", () => {
    expect(() =>
      rowToContactMessage(buildRow({ status: "trashed" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on an unknown category", () => {
    expect(() =>
      rowToContactMessage(buildRow({ category: "not-a-category" })),
    ).toThrowError(RepositoryError);
  });
});

describe("createInputToRow", () => {
  it("returns a minimal row for valid input", () => {
    const row = createInputToRow({
      senderEmail: "ana@example.com",
      subject: "Test",
      body: "Salut",
    });
    expect(row).toEqual({
      sender_email: "ana@example.com",
      subject: "Test",
      body: "Salut",
    });
  });

  it("includes sender_name and category when provided", () => {
    const row = createInputToRow({
      senderEmail: "ana@example.com",
      senderName: "Ana",
      subject: "T",
      body: "B",
      category: "feedback",
    });
    expect(row.sender_name).toBe("Ana");
    expect(row.category).toBe("feedback");
  });

  it("throws when email is malformed", () => {
    expect(() =>
      createInputToRow({
        senderEmail: "no-at-sign",
        subject: "T",
        body: "B",
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when subject or body is empty", () => {
    expect(() =>
      createInputToRow({
        senderEmail: "a@b.co",
        subject: "",
        body: "B",
      }),
    ).toThrowError(RepositoryError);
    expect(() =>
      createInputToRow({
        senderEmail: "a@b.co",
        subject: "T",
        body: "",
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when category is unknown", () => {
    expect(() =>
      createInputToRow({
        senderEmail: "a@b.co",
        subject: "T",
        body: "B",
        category: "not-a-category" as never,
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("updateInputToRow", () => {
  it("emits status only when only status changes", () => {
    expect(updateInputToRow({ status: "read" })).toEqual({ status: "read" });
  });

  it("emits internal_note (including null clear)", () => {
    expect(updateInputToRow({ internalNote: null })).toEqual({
      internal_note: null,
    });
  });

  it("rejects empty input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });

  it("rejects an invalid status on update", () => {
    expect(() =>
      updateInputToRow({ status: "deleted" as never }),
    ).toThrowError(RepositoryError);
  });
});

describe("validateEmail", () => {
  it("accepts a normal email", () => {
    expect(validateEmail("ana@example.com")).toBe("ana@example.com");
  });

  it("rejects strings without an @", () => {
    expect(() => validateEmail("ana.example.com")).toThrowError(
      RepositoryError,
    );
  });

  it("rejects strings without a dot in the domain", () => {
    expect(() => validateEmail("ana@example")).toThrowError(RepositoryError);
  });

  it("rejects empty strings", () => {
    expect(() => validateEmail("")).toThrowError(RepositoryError);
  });
});

describe("parseContactMessageStatus / Category", () => {
  it.each(["new", "read", "archived"] as const)(
    "accepts status %s",
    (s) => {
      expect(parseContactMessageStatus(s)).toBe(s);
    },
  );

  it("rejects unknown status", () => {
    expect(() => parseContactMessageStatus("unknown")).toThrowError(
      RepositoryError,
    );
  });

  it("returns null for null/undefined category", () => {
    expect(parseContactMessageCategory(null)).toBeNull();
    expect(parseContactMessageCategory(undefined)).toBeNull();
  });

  it("rejects unknown category strings", () => {
    expect(() =>
      parseContactMessageCategory("not-a-category"),
    ).toThrowError(RepositoryError);
  });
});
