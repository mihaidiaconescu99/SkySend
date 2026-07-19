import { beforeEach, describe, expect, it } from "vitest";

import { AddressesRepository } from "@/lib/repositories/addresses-repository";
import {
  buildAddressRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let addresses: AddressesRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  addresses = new AddressesRepository(fake.client);
});

describe("AddressesRepository.getById", () => {
  it("returns the mapped Address when the row exists", async () => {
    store.seedAddress(
      buildAddressRow({
        id: "a-1",
        formatted_address: "Strada 1, Pitești",
        latitude: 44.85,
        longitude: 24.87,
        is_saved: true,
      }),
    );

    const result = await addresses.getById("a-1");

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.id).toBe("a-1");
      expect(result.data.formattedAddress).toBe("Strada 1, Pitești");
      expect(result.data.latitude).toBe(44.85);
      expect(result.data.isSaved).toBe(true);
    }
  });

  it("returns data: null when no row matches", async () => {
    const result = await addresses.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("AddressesRepository.create", () => {
  it("creates an Address with mapper defaults applied", async () => {
    const result = await addresses.create({
      formattedAddress: "Strada Nouă 5",
      latitude: 44.85,
      longitude: 24.87,
      profileId: "p-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.formattedAddress).toBe("Strada Nouă 5");
      expect(result.data.isSaved).toBe(false);
      expect(result.data.usageCount).toBe(1);
      expect(result.data.profileId).toBe("p-1");
    }
  });

  it("preserves an anonymous profileId: null", async () => {
    const result = await addresses.create({
      formattedAddress: "Anon",
      latitude: 44.85,
      longitude: 24.87,
      profileId: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.profileId).toBeNull();
  });

  it("surfaces invalid coordinates as validation_error", async () => {
    const result = await addresses.create({
      formattedAddress: "Bad coords",
      latitude: 91,
      longitude: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("respects an explicit isSaved=true", async () => {
    const result = await addresses.create({
      formattedAddress: "Saved",
      latitude: 44.85,
      longitude: 24.87,
      isSaved: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.isSaved).toBe(true);
  });
});

describe("AddressesRepository.updateById", () => {
  it("applies a sparse update", async () => {
    store.seedAddress(buildAddressRow({ id: "a-1", label: null }));
    const result = await addresses.updateById("a-1", { label: "Birou" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.label).toBe("Birou");
  });

  it("returns not_found when the row does not exist", async () => {
    const result = await addresses.updateById("nope", { label: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("returns validation_error for an empty input", async () => {
    store.seedAddress(buildAddressRow({ id: "a-1" }));
    const result = await addresses.updateById("a-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("AddressesRepository.deleteById", () => {
  it("deletes an existing row", async () => {
    store.seedAddress(buildAddressRow({ id: "a-1" }));
    const result = await addresses.deleteById("a-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(store.addressRows.has("a-1")).toBe(false);
  });

  it("returns not_found when the id does not match", async () => {
    const result = await addresses.deleteById("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("AddressesRepository.listByProfileId", () => {
  beforeEach(() => {

    const baseIso = "2026-05-01T00:00:00Z";
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T00:00:00Z`;

    store.seedAddress(
      buildAddressRow({
        id: "s-1",
        profile_id: "p-1",
        is_saved: true,
        usage_count: 10,
        last_used_at: isoFor(5),
        created_at: baseIso,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "s-2",
        profile_id: "p-1",
        is_saved: true,
        usage_count: 3,
        last_used_at: isoFor(20),
        created_at: baseIso,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "s-3",
        profile_id: "p-1",
        is_saved: true,
        usage_count: 7,
        last_used_at: isoFor(10),
        created_at: baseIso,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "h-1",
        profile_id: "p-1",
        is_saved: false,
        usage_count: 1,
        last_used_at: isoFor(15),
        created_at: baseIso,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "h-2",
        profile_id: "p-1",
        is_saved: false,
        usage_count: 2,
        last_used_at: isoFor(25),
        created_at: baseIso,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "other",
        profile_id: "p-2",
        is_saved: true,
      }),
    );
  });

  it("returns all 5 addresses for the profile by default (saved + history)", async () => {
    const result = await addresses.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(5);
  });

  it("returns only the 3 saved entries when savedOnly=true", async () => {
    const result = await addresses.listByProfileId("p-1", {
      savedOnly: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data.every((a) => a.isSaved)).toBe(true);
    }
  });

  it("respects a limit and orders by last_used_at DESC by default", async () => {
    const result = await addresses.listByProfileId("p-1", { limit: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);

      expect(result.data[0].id).toBe("h-2");
      expect(result.data[1].id).toBe("s-2");
    }
  });

  it("orders by usage_count DESC when requested", async () => {
    const result = await addresses.listByProfileId("p-1", {
      orderBy: "usage_count",
      limit: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((a) => a.id)).toEqual(["s-1", "s-3", "s-2"]);
    }
  });

  it("returns an empty array for a profile with no addresses", async () => {
    const result = await addresses.listByProfileId("p-unknown");
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("does not leak addresses from other profiles into the result", async () => {
    const result = await addresses.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.find((a) => a.id === "other")).toBeUndefined();
      expect(result.data.every((a) => a.profileId === "p-1")).toBe(true);
    }
  });
});

describe("AddressesRepository.incrementUsage", () => {
  it("bumps usage_count by 1 and refreshes lastUsedAt", async () => {
    const beforeIso = "2026-04-01T00:00:00Z";
    store.seedAddress(
      buildAddressRow({
        id: "a-1",
        usage_count: 5,
        last_used_at: beforeIso,
      }),
    );

    const result = await addresses.incrementUsage("a-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.usageCount).toBe(6);
      expect(result.data.lastUsedAt).not.toBe(beforeIso);
    }
  });

  it("returns not_found when the address does not exist", async () => {
    const result = await addresses.incrementUsage("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("AddressesRepository.findByCoordinates", () => {
  it("returns the matching address when within the tolerance", async () => {
    store.seedAddress(
      buildAddressRow({
        id: "a-1",
        latitude: 44.85,
        longitude: 24.87,
      }),
    );

    const result = await addresses.findByCoordinates(44.85005, 24.87005);
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("a-1");
  });

  it("returns null when the stored address is beyond the tolerance", async () => {
    store.seedAddress(
      buildAddressRow({ id: "a-1", latitude: 44.85, longitude: 24.87 }),
    );

    const result = await addresses.findByCoordinates(45.0, 24.87);
    expect(result).toEqual({ ok: true, data: null });
  });

  it("filters by profileId when provided", async () => {
    store.seedAddress(
      buildAddressRow({
        id: "p1-near",
        profile_id: "p-1",
        latitude: 44.85,
        longitude: 24.87,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "p2-near",
        profile_id: "p-2",
        latitude: 44.85,
        longitude: 24.87,
      }),
    );

    const result = await addresses.findByCoordinates(
      44.85,
      24.87,
      "p-1",
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.profileId).toBe("p-1");
  });

  it("returns null when no addresses exist at all", async () => {
    const result = await addresses.findByCoordinates(44.85, 24.87);
    expect(result).toEqual({ ok: true, data: null });
  });

  it("skips rows the mapper rejects rather than failing the whole query", async () => {

    store.seedAddress(
      buildAddressRow({
        id: "corrupt",
        latitude: 91 as unknown as number,
        longitude: 0,
      }),
    );
    store.seedAddress(
      buildAddressRow({
        id: "good",
        latitude: 44.85,
        longitude: 24.87,
      }),
    );

    const result = await addresses.findByCoordinates(44.85, 24.87);
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("good");
  });

  it("returns the closest address when multiple are within tolerance", async () => {
    store.seedAddress(
      buildAddressRow({ id: "far", latitude: 44.8503, longitude: 24.87 }),
    );
    store.seedAddress(
      buildAddressRow({ id: "near", latitude: 44.85005, longitude: 24.87 }),
    );

    const result = await addresses.findByCoordinates(
      44.85,
      24.87,
      undefined,
      100,
    );
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("near");
  });
});

describe("AddressesRepository.toggleSaved", () => {
  it("flips a history entry into a saved place", async () => {
    store.seedAddress(buildAddressRow({ id: "a-1", is_saved: false }));
    const result = await addresses.toggleSaved("a-1", true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.isSaved).toBe(true);
  });

  it("flips a saved place back to a history entry", async () => {
    store.seedAddress(buildAddressRow({ id: "a-1", is_saved: true }));
    const result = await addresses.toggleSaved("a-1", false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.isSaved).toBe(false);
  });

  it("returns not_found when the address does not exist", async () => {
    const result = await addresses.toggleSaved("missing", true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("persists the change in the underlying store", async () => {
    store.seedAddress(buildAddressRow({ id: "a-1", is_saved: false }));
    await addresses.toggleSaved("a-1", true);
    expect(store.addressRows.get("a-1")?.is_saved).toBe(true);
  });
});
