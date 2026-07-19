import { describe, it, expect } from "vitest";

import {
  createInputToRow,
  parseNotificationPreferences,
  parseProfileRole,
  rowToProfile,
  updateInputToRow,
} from "@/lib/repositories/mappers/profile-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildProfileRow(
  overrides: Partial<DBRow<"profiles">> = {},
): DBRow<"profiles"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    clerk_user_id: "user_clerk_xyz",
    email: "test@example.com",
    avatar_url: null,
    full_name: "Test User",
    role: "client",
    notification_preferences: { popup: true, email: true },
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToProfile", () => {
  it("maps every column for a fully populated row", () => {
    const row = buildProfileRow();
    const profile = rowToProfile(row);

    expect(profile).toEqual({
      id: row.id,
      clerkUserId: row.clerk_user_id,
      email: row.email,
      fullName: row.full_name,
      role: "client",
      notificationPreferences: { popup: true, email: true },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

  it("falls back to default notification preferences when the JSONB is malformed", () => {
    const row = buildProfileRow({

      notification_preferences: "not-an-object" as unknown as never,
    });

    expect(rowToProfile(row).notificationPreferences).toEqual({
      popup: true,
      email: true,
    });
  });

  it("falls back to defaults when notification_preferences is null", () => {
    const row = buildProfileRow({
      notification_preferences: null as unknown as never,
    });

    expect(rowToProfile(row).notificationPreferences).toEqual({
      popup: true,
      email: true,
    });
  });

  it("throws validation_error when role is an unrecognised string", () => {
    const row = buildProfileRow({ role: "superuser" });

    expect(() => rowToProfile(row)).toThrowError(RepositoryError);
    try {
      rowToProfile(row);
    } catch (error) {
      expect((error as RepositoryError).code).toBe("validation_error");
    }
  });

  it("keeps full_name as null when the column is null", () => {
    const row = buildProfileRow({ full_name: null });
    expect(rowToProfile(row).fullName).toBeNull();
  });

  it("preserves the ISO timestamp strings without reformatting", () => {
    const created = "2026-01-01T08:30:00.123Z";
    const updated = "2026-02-14T12:45:00.000Z";
    const profile = rowToProfile(
      buildProfileRow({ created_at: created, updated_at: updated }),
    );

    expect(profile.createdAt).toBe(created);
    expect(profile.updatedAt).toBe(updated);
  });

  it("preserves the row id verbatim", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    expect(rowToProfile(buildProfileRow({ id })).id).toBe(id);
  });

  it("throws validation_error when required string fields are missing", () => {
    expect(() =>
      rowToProfile(buildProfileRow({ email: "" })),
    ).toThrowError(RepositoryError);
    expect(() =>
      rowToProfile(buildProfileRow({ clerk_user_id: "" })),
    ).toThrowError(RepositoryError);
  });
});

describe("createInputToRow", () => {
  it("applies defaults when only the required fields are supplied", () => {
    const row = createInputToRow({
      clerkUserId: "user_abc",
      email: "ana@example.com",
    });

    expect(row).toEqual({
      clerk_user_id: "user_abc",
      email: "ana@example.com",
      full_name: null,
      role: "client",
      notification_preferences: { popup: true, email: true },
    });
  });

  it("respects an explicit role", () => {
    const row = createInputToRow({
      clerkUserId: "user_abc",
      email: "ops@skysend.com",
      role: "operator",
    });
    expect(row.role).toBe("operator");
  });

  it("preserves an explicit null fullName", () => {
    const row = createInputToRow({
      clerkUserId: "user_abc",
      email: "ana@example.com",
      fullName: null,
    });
    expect(row.full_name).toBeNull();
  });

  it("merges partial notification preferences with defaults", () => {
    const row = createInputToRow({
      clerkUserId: "user_abc",
      email: "ana@example.com",
      notificationPreferences: { email: false },
    });
    expect(row.notification_preferences).toEqual({ popup: true, email: false });
  });

  it("throws when clerkUserId is missing", () => {
    expect(() =>
      createInputToRow({
        clerkUserId: "",
        email: "ana@example.com",
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when email is missing", () => {
    expect(() =>
      createInputToRow({
        clerkUserId: "user_abc",
        email: "",
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when email is whitespace only (treated as empty)", () => {
    expect(() =>
      createInputToRow({
        clerkUserId: "user_abc",
        email: "   ",
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("updateInputToRow", () => {
  it("emits a sparse payload containing only the email key when only email is updated", () => {
    const payload = updateInputToRow({ email: "new@example.com" });
    expect(payload).toEqual({ email: "new@example.com" });
  });

  it("throws validation_error when no fields are provided", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
    try {
      updateInputToRow({});
    } catch (error) {
      expect((error as RepositoryError).code).toBe("validation_error");
    }
  });

  it("maps role changes", () => {
    expect(updateInputToRow({ role: "admin" })).toEqual({ role: "admin" });
  });

  it("preserves explicit null fullName (clears the field)", () => {
    expect(updateInputToRow({ fullName: null })).toEqual({ full_name: null });
  });

  it("merges partial notification preferences with defaults before writing", () => {
    const payload = updateInputToRow({
      notificationPreferences: { popup: false },
    });
    expect(payload.notification_preferences).toEqual({
      popup: false,
      email: true,
    });
  });
});

describe("parseNotificationPreferences", () => {
  it("returns the value as-is when it is fully shaped", () => {
    expect(parseNotificationPreferences({ popup: true, email: false })).toEqual(
      { popup: true, email: false },
    );
  });

  it("returns defaults for an empty object", () => {
    expect(parseNotificationPreferences({})).toEqual({
      popup: true,
      email: true,
    });
  });

  it("returns defaults for null", () => {
    expect(parseNotificationPreferences(null)).toEqual({
      popup: true,
      email: true,
    });
  });

  it("returns defaults for undefined", () => {
    expect(parseNotificationPreferences(undefined)).toEqual({
      popup: true,
      email: true,
    });
  });

  it("returns defaults for a string", () => {
    expect(parseNotificationPreferences("oops")).toEqual({
      popup: true,
      email: true,
    });
  });

  it("rejects non-boolean field values per-key and substitutes the default", () => {
    expect(parseNotificationPreferences({ popup: "yes" })).toEqual({
      popup: true,
      email: true,
    });
    expect(parseNotificationPreferences({ email: 1 })).toEqual({
      popup: true,
      email: true,
    });
  });

  it("ignores extra unknown keys", () => {
    expect(
      parseNotificationPreferences({
        popup: false,
        email: false,
        extra: "ignored",
      }),
    ).toEqual({ popup: false, email: false });
  });
});

describe("parseProfileRole", () => {
  it.each(["client", "admin", "operator"] as const)(
    "accepts the canonical role %s",
    (role) => {
      expect(parseProfileRole(role)).toBe(role);
    },
  );

  it("rejects an uppercase variant (matching is strict)", () => {
    expect(() => parseProfileRole("CLIENT")).toThrowError(RepositoryError);
  });

  it("rejects an unknown role", () => {
    expect(() => parseProfileRole("superuser")).toThrowError(RepositoryError);
  });

  it("rejects null", () => {
    expect(() => parseProfileRole(null)).toThrowError(RepositoryError);
  });

  it("rejects undefined", () => {
    expect(() => parseProfileRole(undefined)).toThrowError(RepositoryError);
  });
});
