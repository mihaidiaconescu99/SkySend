import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import {
  createInputToRow,
  rowToProfile,
  updateInputToRow,
} from "@/lib/repositories/mappers/profile-mapper";
import {
  RepositoryError,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreateProfileInput,
  Profile,
  UpdateProfileInput,
} from "@/types/profile";

export class ProfilesRepository extends BaseRepository<"profiles"> {
  protected readonly tableName = "profiles" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(id: string): Promise<RepositoryResult<Profile | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToProfile(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async getByClerkUserId(
    clerkUserId: string,
  ): Promise<RepositoryResult<Profile | null>> {
    if (!clerkUserId || clerkUserId.trim() === "") {
      return { ok: true, data: null };
    }
    const row = await this.findOne({ clerk_user_id: clerkUserId });
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToProfile(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(input: CreateProfileInput): Promise<RepositoryResult<Profile>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToProfile(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateProfileInput,
  ): Promise<RepositoryResult<Profile>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToProfile(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async deleteById(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
  }

  async findOrCreateByClerkUserId(
    clerkUserId: string,
    fallbackInput: CreateProfileInput,
  ): Promise<RepositoryResult<Profile>> {
    const existing = await this.getByClerkUserId(clerkUserId);
    if (!existing.ok) return existing;
    if (existing.data) return { ok: true, data: existing.data };

    const created = await this.create(fallbackInput);
    if (created.ok) return created;

    const postgresCode = created.error.details?.postgresCode;
    if (postgresCode === "23505") {
      const refetched = await this.getByClerkUserId(clerkUserId);
      if (!refetched.ok) return refetched;
      if (refetched.data) return { ok: true, data: refetched.data };
    }

    return created;
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
