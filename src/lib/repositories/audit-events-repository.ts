

import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToAuditEvent,
} from "@/lib/repositories/mappers/audit-event-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type { AuditEvent, CreateAuditEventInput } from "@/types/audit-event";

const DEFAULT_LIST_LIMIT = 100;

export class AuditEventsRepository extends BaseRepository<"audit_events"> {
  protected readonly tableName = "audit_events" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async create(
    input: CreateAuditEventInput,
  ): Promise<RepositoryResult<AuditEvent>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToAuditEvent(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async listByActor(
    profileId: string,
    options: { limit?: number } = {},
  ): Promise<RepositoryResult<AuditEvent[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    try {
      const { data, error } = await this.supabase
        .from("audit_events")
        .select("*")
        .eq("actor_profile_id", profileId)
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"audit_events">[];
      try {
        return { ok: true, data: rows.map(rowToAuditEvent) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async listByEntity(
    entityType: string,
    entityId: string,
    options: { limit?: number } = {},
  ): Promise<RepositoryResult<AuditEvent[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    try {
      const { data, error } = await this.supabase
        .from("audit_events")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"audit_events">[];
      try {
        return { ok: true, data: rows.map(rowToAuditEvent) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async listRecent(limit = DEFAULT_LIST_LIMIT): Promise<RepositoryResult<AuditEvent[]>> {
    try {
      const { data, error } = await this.supabase
        .from("audit_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"audit_events">[];
      try {
        return { ok: true, data: rows.map(rowToAuditEvent) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }
}

export async function recordAuditEvent(
  supabase: SupabaseClient<Database>,
  input: CreateAuditEventInput,
): Promise<RepositoryResult<AuditEvent>> {
  return new AuditEventsRepository(supabase).create(input);
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
