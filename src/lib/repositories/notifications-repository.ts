import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToNotification,
  updateInputToRow,
} from "@/lib/repositories/mappers/notification-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreateNotificationInput,
  Notification,
  NotificationType,
  UpdateNotificationInput,
} from "@/types/notification";

const DEFAULT_LIST_LIMIT = 50;

export class NotificationsRepository extends BaseRepository<"notifications"> {
  protected readonly tableName = "notifications" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(id: string): Promise<RepositoryResult<Notification | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToNotification(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(
    input: CreateNotificationInput,
  ): Promise<RepositoryResult<Notification>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToNotification(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateNotificationInput,
  ): Promise<RepositoryResult<Notification>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToNotification(updated.data) };
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
      unreadOnly?: boolean;
      type?: NotificationType;
      limit?: number;
    } = {},
  ): Promise<RepositoryResult<Notification[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    try {
      let query = this.supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", profileId);

      if (options.unreadOnly) {
        query = query.eq("read", false);
      }
      if (options.type) {
        query = query.eq("type", options.type);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"notifications">[];
      try {
        return { ok: true, data: rows.map(rowToNotification) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async markAsRead(id: string): Promise<RepositoryResult<Notification>> {
    return this.updateById(id, {
      read: true,
      readAt: new Date().toISOString(),
    });
  }

  async markAllReadForProfile(
    profileId: string,
  ): Promise<RepositoryResult<number>> {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("profile_id", profileId)
        .eq("read", false)
        .select("id");

      if (error) return { ok: false, error: mapPostgresError(error) };
      return { ok: true, data: (data ?? []).length };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async countUnread(profileId: string): Promise<RepositoryResult<number>> {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .select("id")
        .eq("profile_id", profileId)
        .eq("read", false);

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
