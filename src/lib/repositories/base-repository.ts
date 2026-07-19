import type { SupabaseClient } from "@supabase/supabase-js";

import { mapPostgresError } from "@/lib/repositories/errors";
import {
  RepositoryError,
  type DBInsert,
  type DBRow,
  type DBTableName,
  type DBUpdate,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";

export abstract class BaseRepository<TTable extends DBTableName> {
  protected readonly supabase: SupabaseClient<Database>;
  protected abstract readonly tableName: TTable;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  protected async findById(
    id: string,
  ): Promise<RepositoryResult<DBRow<TTable> | null>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName as DBTableName)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        return { ok: false, error: mapPostgresError(error) };
      }
      return { ok: true, data: (data as DBRow<TTable> | null) ?? null };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  protected async findOne(
    filter: Partial<DBRow<TTable>>,
  ): Promise<RepositoryResult<DBRow<TTable> | null>> {
    try {
      let query = this.supabase
        .from(this.tableName as DBTableName)
        .select("*");

      for (const [column, value] of Object.entries(filter)) {
        if (value === undefined) continue;

        query = query.eq(column, value as never);
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        return { ok: false, error: mapPostgresError(error) };
      }
      return { ok: true, data: (data as DBRow<TTable> | null) ?? null };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  protected async insert(
    data: DBInsert<TTable>,
  ): Promise<RepositoryResult<DBRow<TTable>>> {
    try {
      const { data: inserted, error } = await this.supabase
        .from(this.tableName as DBTableName)
        .insert(data as never)
        .select("*")
        .single();

      if (error) {
        return { ok: false, error: mapPostgresError(error) };
      }
      if (!inserted) {
        return {
          ok: false,
          error: new RepositoryError(
            "database_error",
            `Insert into "${this.tableName}" returned no row.`,
          ),
        };
      }
      return { ok: true, data: inserted as DBRow<TTable> };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  protected async updateRow(
    id: string,
    data: DBUpdate<TTable>,
  ): Promise<RepositoryResult<DBRow<TTable>>> {
    try {
      const { data: updated, error } = await this.supabase
        .from(this.tableName as DBTableName)
        .update(data as never)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) {
        return { ok: false, error: mapPostgresError(error) };
      }
      if (!updated) {
        return {
          ok: false,
          error: new RepositoryError(
            "not_found",
            `No row with id="${id}" in "${this.tableName}".`,
          ),
        };
      }
      return { ok: true, data: updated as DBRow<TTable> };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  protected async delete(
    id: string,
  ): Promise<RepositoryResult<void>> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName as DBTableName)
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) {
        return { ok: false, error: mapPostgresError(error) };
      }
      if (!data) {
        return {
          ok: false,
          error: new RepositoryError(
            "not_found",
            `No row with id="${id}" in "${this.tableName}".`,
          ),
        };
      }
      return { ok: true, data: undefined };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }
}
