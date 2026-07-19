import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToContactMessage,
  updateInputToRow,
} from "@/lib/repositories/mappers/contact-message-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  ContactMessage,
  ContactMessageCategory,
  ContactMessageStatus,
  CreateContactMessageInput,
  UpdateContactMessageInput,
} from "@/types/contact-message";

const DEFAULT_LIST_LIMIT = 50;

type ListOrderBy = "created_at" | "status";

export class ContactMessagesRepository extends BaseRepository<"contact_messages"> {
  protected readonly tableName = "contact_messages" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(
    id: string,
  ): Promise<RepositoryResult<ContactMessage | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToContactMessage(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(
    input: CreateContactMessageInput,
  ): Promise<RepositoryResult<ContactMessage>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToContactMessage(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateContactMessageInput,
  ): Promise<RepositoryResult<ContactMessage>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToContactMessage(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async deleteById(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
  }

  async list(
    options: {
      status?: ContactMessageStatus;
      category?: ContactMessageCategory;
      limit?: number;
      orderBy?: ListOrderBy;
    } = {},
  ): Promise<RepositoryResult<ContactMessage[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const orderColumn = options.orderBy ?? "created_at";

    try {
      let query = this.supabase.from("contact_messages").select("*");
      if (options.status) query = query.eq("status", options.status);
      if (options.category) query = query.eq("category", options.category);

      const { data, error } = await query
        .order(orderColumn, { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"contact_messages">[];
      try {
        return { ok: true, data: rows.map(rowToContactMessage) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async countByStatus(
    status: ContactMessageStatus,
  ): Promise<RepositoryResult<number>> {
    try {
      const { data, error } = await this.supabase
        .from("contact_messages")
        .select("id")
        .eq("status", status);

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
