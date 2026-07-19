import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateDistanceKm } from "@/lib/geo/distance";
import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToAddress,
  updateInputToRow,
} from "@/lib/repositories/mappers/address-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  Address,
  CreateAddressInput,
  UpdateAddressInput,
} from "@/types/address";

const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_TOLERANCE_METERS = 30;

type ListOrderBy = "last_used_at" | "created_at" | "usage_count";

export class AddressesRepository extends BaseRepository<"addresses"> {
  protected readonly tableName = "addresses" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(id: string): Promise<RepositoryResult<Address | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToAddress(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(
    input: CreateAddressInput,
  ): Promise<RepositoryResult<Address>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToAddress(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateAddressInput,
  ): Promise<RepositoryResult<Address>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToAddress(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async deleteById(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
  }

  async listByProfileId(
    profileId: string,
    options: {
      savedOnly?: boolean;
      limit?: number;
      orderBy?: ListOrderBy;
    } = {},
  ): Promise<RepositoryResult<Address[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const orderColumn = options.orderBy ?? "last_used_at";

    try {
      let query = this.supabase
        .from("addresses")
        .select("*")
        .eq("profile_id", profileId);

      if (options.savedOnly) {
        query = query.eq("is_saved", true);
      }

      const { data, error } = await query
        .order(orderColumn, { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"addresses">[];
      try {
        return { ok: true, data: rows.map(rowToAddress) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async incrementUsage(id: string): Promise<RepositoryResult<Address>> {
    const existing = await this.getById(id);
    if (!existing.ok) return existing;
    if (!existing.data) {
      return {
        ok: false,
        error: new RepositoryError(
          "not_found",
          `No address with id="${id}".`,
        ),
      };
    }
    return this.updateById(id, {
      usageCount: existing.data.usageCount + 1,
      lastUsedAt: new Date().toISOString(),
    });
  }

  async findByCoordinates(
    latitude: number,
    longitude: number,
    profileId?: string,
    toleranceMeters: number = DEFAULT_TOLERANCE_METERS,
  ): Promise<RepositoryResult<Address | null>> {
    try {
      let query = this.supabase.from("addresses").select("*");
      if (profileId) {
        query = query.eq("profile_id", profileId);
      }
      const { data, error } = await query;
      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"addresses">[];
      let best: { address: Address; distanceKm: number } | null = null;
      const toleranceKm = toleranceMeters / 1000;

      for (const row of rows) {
        let address: Address;
        try {
          address = rowToAddress(row);
        } catch {

          continue;
        }
        const distanceKm = calculateDistanceKm(
          { latitude, longitude },
          { latitude: address.latitude, longitude: address.longitude },
        );
        if (distanceKm > toleranceKm) continue;
        if (!best || distanceKm < best.distanceKm) {
          best = { address, distanceKm };
        }
      }

      return { ok: true, data: best?.address ?? null };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async toggleSaved(
    id: string,
    isSaved: boolean,
  ): Promise<RepositoryResult<Address>> {
    return this.updateById(id, { isSaved });
  }
}

function toMapperFailure(caught: unknown): RepositoryResult<never> {
  if (caught instanceof RepositoryError) {
    return { ok: false, error: caught };
  }
  return {
    ok: false,
    error: new RepositoryError(
      "unknown",
      caught instanceof Error ? caught.message : "Unknown mapper failure.",
      { originalError: caught },
    ),
  };
}
