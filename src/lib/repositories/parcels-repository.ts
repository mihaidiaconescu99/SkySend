

import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import {
  createInputToRow,
  rowToParcel,
  updateInputToRow,
} from "@/lib/repositories/mappers/parcel-mapper";
import {
  RepositoryError,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreateParcelInput,
  Parcel,
  UpdateParcelInput,
} from "@/types/parcel";

export class ParcelsRepository extends BaseRepository<"parcels"> {
  protected readonly tableName = "parcels" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(id: string): Promise<RepositoryResult<Parcel | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToParcel(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(input: CreateParcelInput): Promise<RepositoryResult<Parcel>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToParcel(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateParcelInput,
  ): Promise<RepositoryResult<Parcel>> {
    let payload: ReturnType<typeof updateInputToRow>;
    try {
      payload = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, payload);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToParcel(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async deleteById(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
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
