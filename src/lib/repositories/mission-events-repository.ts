

import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToMissionEvent,
} from "@/lib/repositories/mappers/mission-event-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreateMissionEventInput,
  MissionEvent,
} from "@/types/mission-event";

const DEFAULT_LIST_LIMIT = 100;

type ListOrderBy = "occurred_at" | "created_at";

export class MissionEventsRepository extends BaseRepository<"mission_events"> {
  protected readonly tableName = "mission_events" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(
    id: string,
  ): Promise<RepositoryResult<MissionEvent | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToMissionEvent(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(
    input: CreateMissionEventInput,
  ): Promise<RepositoryResult<MissionEvent>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToMissionEvent(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async listByMissionId(
    missionId: string,
    options: {
      limit?: number;
      orderBy?: ListOrderBy;
      sinceTimestamp?: string;
    } = {},
  ): Promise<RepositoryResult<MissionEvent[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const orderColumn = options.orderBy ?? "occurred_at";
    try {
      let query = this.supabase
        .from("mission_events")
        .select("*")
        .eq("mission_id", missionId);

      if (options.sinceTimestamp) {
        query = query.gte("occurred_at", options.sinceTimestamp);
      }

      const { data, error } = await query
        .order(orderColumn, { ascending: true })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"mission_events">[];
      try {
        return { ok: true, data: rows.map(rowToMissionEvent) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async listByEventType(
    eventType: string,
    options: { limit?: number; orderBy?: ListOrderBy } = {},
  ): Promise<RepositoryResult<MissionEvent[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const orderColumn = options.orderBy ?? "occurred_at";
    try {
      const { data, error } = await this.supabase
        .from("mission_events")
        .select("*")
        .eq("event_type", eventType)
        .order(orderColumn, { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"mission_events">[];
      try {
        return { ok: true, data: rows.map(rowToMissionEvent) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async countByMissionId(
    missionId: string,
  ): Promise<RepositoryResult<number>> {
    try {
      const { data, error } = await this.supabase
        .from("mission_events")
        .select("id")
        .eq("mission_id", missionId);

      if (error) return { ok: false, error: mapPostgresError(error) };
      return { ok: true, data: (data ?? []).length };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
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
