import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  rowToSettings,
  updateInputToRow,
} from "@/lib/repositories/mappers/operational-settings-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  OperationalSettings,
  UpdateOperationalSettingsInput,
} from "@/types/operational-settings";

export class OperationalSettingsRepository extends BaseRepository<"operational_settings"> {
  protected readonly tableName = "operational_settings" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getCurrent(): Promise<RepositoryResult<OperationalSettings>> {
    try {
      const { data, error } = await this.supabase
        .from("operational_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        return { ok: false, error: mapPostgresError(error) };
      }
      if (!data) {
        return {
          ok: false,
          error: new RepositoryError(
            "database_error",
            "operational_settings is missing its singleton row.",
          ),
        };
      }
      try {
        return {
          ok: true,
          data: rowToSettings(data as DBRow<"operational_settings">),
        };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async update(
    input: UpdateOperationalSettingsInput,
  ): Promise<RepositoryResult<OperationalSettings>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }

    const current = await this.getCurrent();
    if (!current.ok) return current;

    const updated = await this.updateRow(current.data.id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToSettings(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
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
