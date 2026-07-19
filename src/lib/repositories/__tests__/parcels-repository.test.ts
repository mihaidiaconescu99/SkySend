import { beforeEach, describe, expect, it } from "vitest";

import { ParcelsRepository } from "@/lib/repositories/parcels-repository";
import {
  buildParcelRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: ParcelsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new ParcelsRepository(fake.client);
});

describe("ParcelsRepository.getById", () => {
  it("returns the mapped parcel when the row exists", async () => {
    store.seedParcel(
      buildParcelRow({
        id: "p-1",
        contents_description: "Carte de programare",
        thermal_protection: "passive",
      }),
    );

    const result = await repo.getById("p-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.contentsDescription).toBe("Carte de programare");
      expect(result.data.thermalProtection).toBe("passive_insulated");
    }
  });

  it("returns data: null on miss", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("propagates DB error", async () => {
    store.injectErrorOnNext("select", { code: "42501", message: "permission denied" });
    const result = await repo.getById("p-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("permission_denied");
  });
});

describe("ParcelsRepository.create", () => {
  it("creates a minimal parcel with DB defaults", async () => {
    const result = await repo.create({
      contentsDescription: "Documente notariale",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentsDescription).toBe("Documente notariale");
      expect(result.data.thermalProtection).toBe("none");
      expect(result.data.fragilityLevel).toBe("low");
      expect(result.data.securityModule).toBe("standard");
      expect(result.data.packagingType).toBeNull();
      expect(result.data.approximateSize).toBeNull();
      expect(result.data.declaredDimensionsCm).toBeNull();
      expect(result.data.declaredWeightKg).toBeNull();
      expect(result.data.estimatedWeightRange).toBeNull();
    }
  });

  it("preserves all optional fields when provided", async () => {
    const result = await repo.create({
      contentsDescription: "Vaccin farmaceutic",
      fragilityLevel: "high",
      packagingType: "insulated",
      securityModule: "secure_plus",
      thermalProtection: "active_thermal",
      approximateSize: "small",
      declaredWeightKg: 0.5,
      estimatedWeightRange: "0.3-0.7 kg",
      declaredDimensionsCm: { lengthCm: 15, widthCm: 10, heightCm: 8 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fragilityLevel).toBe("high");
      expect(result.data.packagingType).toBe("insulated");
      expect(result.data.securityModule).toBe("secure_plus");
      expect(result.data.thermalProtection).toBe("active_thermal");
      expect(result.data.approximateSize).toBe("small");
      expect(result.data.declaredWeightKg).toBe(0.5);
      expect(result.data.estimatedWeightRange).toBe("0.3-0.7 kg");
      expect(result.data.declaredDimensionsCm).toEqual({
        lengthCm: 15,
        widthCm: 10,
        heightCm: 8,
      });
    }
  });

  it("thermal passive_insulated round-trips correctly", async () => {
    const created = await repo.create({
      contentsDescription: "Carne",
      thermalProtection: "passive_insulated",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.data.thermalProtection).toBe("passive_insulated");

    const refetched = await repo.getById(created.data.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.thermalProtection).toBe("passive_insulated");
    }
  });

  it("thermal active_thermal round-trips correctly", async () => {
    const created = await repo.create({
      contentsDescription: "Probe medicale",
      thermalProtection: "active_thermal",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.thermalProtection).toBe("active_thermal");

    const refetched = await repo.getById(created.data.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.thermalProtection).toBe("active_thermal");
    }
  });

  it("dimensions round-trip deep-equal", async () => {
    const dims = { lengthCm: 25, widthCm: 15, heightCm: 10 };
    const created = await repo.create({
      contentsDescription: "Cutie cu instrumente",
      declaredDimensionsCm: dims,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const refetched = await repo.getById(created.data.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.declaredDimensionsCm).toEqual(dims);
    }
  });

  it("rejects empty contentsDescription", async () => {
    const result = await repo.create({ contentsDescription: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("propagates DB insert error", async () => {
    store.injectErrorOnNext("insert", { code: "08006", message: "connection failure" });
    const result = await repo.create({ contentsDescription: "Test" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("database_error");
  });
});

describe("ParcelsRepository.updateById", () => {
  it("updates contentsDescription", async () => {
    store.seedParcel(buildParcelRow({ id: "p-1" }));
    const result = await repo.updateById("p-1", {
      contentsDescription: "Continut actualizat",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentsDescription).toBe("Continut actualizat");
    }
  });

  it("translates thermalProtection on update", async () => {
    store.seedParcel(
      buildParcelRow({ id: "p-1", thermal_protection: "none" }),
    );
    const result = await repo.updateById("p-1", {
      thermalProtection: "active_thermal",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.thermalProtection).toBe("active_thermal");
    }
  });

  it("partial update does not overwrite untouched fields", async () => {
    store.seedParcel(
      buildParcelRow({
        id: "p-1",
        fragility_level: "high",
        packaging_type: "boxed",
      }),
    );
    const result = await repo.updateById("p-1", {
      contentsDescription: "Doar descrierea se schimbă",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fragilityLevel).toBe("high");
      expect(result.data.packagingType).toBe("boxed");
    }
  });

  it("returns not_found for a nonexistent id", async () => {
    const result = await repo.updateById("no-such-id", {
      contentsDescription: "Test",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("returns validation_error for an empty update payload", async () => {
    store.seedParcel(buildParcelRow({ id: "p-1" }));
    const result = await repo.updateById("p-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("propagates DB update error", async () => {
    store.seedParcel(buildParcelRow({ id: "p-1" }));
    store.injectErrorOnNext("update", { code: "42501", message: "permission denied" });
    const result = await repo.updateById("p-1", {
      contentsDescription: "Test",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("permission_denied");
  });
});

describe("ParcelsRepository.deleteById", () => {
  it("removes the row from the store", async () => {
    store.seedParcel(buildParcelRow({ id: "p-1" }));
    const result = await repo.deleteById("p-1");
    expect(result.ok).toBe(true);

    const after = await repo.getById("p-1");
    expect(after).toEqual({ ok: true, data: null });
  });

  it("returns not_found for a nonexistent id", async () => {
    const result = await repo.deleteById("ghost");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("propagates DB delete error", async () => {
    store.seedParcel(buildParcelRow({ id: "p-1" }));
    store.injectErrorOnNext("delete", {
      code: "08006",
      message: "connection failure",
    });
    const result = await repo.deleteById("p-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("database_error");
  });
});
