import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import {
  createInputToRow,
  rowToMission,
  updateInputToRow,
} from "@/lib/repositories/mappers/mission-mapper";
import {
  RepositoryError,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreateMissionInput,
  DroneTelemetrySnapshot,
  MissionRecord,
  MissionStatus,
  UpdateMissionInput,
} from "@/types/mission-record";

export class MissionsRepository extends BaseRepository<"missions"> {
  protected readonly tableName = "missions" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(id: string): Promise<RepositoryResult<MissionRecord | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToMission(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async getByOrderId(
    orderId: string,
  ): Promise<RepositoryResult<MissionRecord | null>> {
    if (!orderId || orderId.trim() === "") {
      return { ok: true, data: null };
    }
    const row = await this.findOne({ order_id: orderId } as never);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToMission(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(
    input: CreateMissionInput,
  ): Promise<RepositoryResult<MissionRecord>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToMission(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateMissionInput,
  ): Promise<RepositoryResult<MissionRecord>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToMission(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateStatus(
    id: string,
    status: MissionStatus,
  ): Promise<RepositoryResult<MissionRecord>> {
    return this.updateById(id, { currentStatus: status });
  }

  async updateIfVersion(
    id: string,
    expectedVersion: number,
    input: UpdateMissionInput,
  ): Promise<RepositoryResult<MissionRecord>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow({
        ...input,
        stateVersion: expectedVersion + 1,
      });
      const { data, error } = await this.supabase
        .from("missions")
        .update(patch)
        .eq("id", id)
        .eq("state_version", expectedVersion)
        .select("*")
        .maybeSingle();

      if (error) return toMapperFailure(error);
      if (!data) {
        return {
          ok: false,
          error: new RepositoryError(
            "validation_error",
            "Mission state changed before this action was committed.",
          ),
        };
      }
      return { ok: true, data: rowToMission(data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async listExpiredActionTimers(now = new Date().toISOString()) {
    const { data, error } = await this.supabase
      .from("missions")
      .select("*")
      .is("failed_at", null)
      .not("step_expires_at", "is", null)
      .lte("step_expires_at", now)
      .limit(200);

    if (error) return toMapperFailure(error);
    try {
      return { ok: true as const, data: (data ?? []).map(rowToMission) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateTelemetry(
    id: string,
    telemetry: DroneTelemetrySnapshot,
  ): Promise<RepositoryResult<MissionRecord>> {
    return this.updateById(id, { droneTelemetrySnapshot: telemetry });
  }

  async recordPinAttempt(
    id: string,
    kind: "pickup" | "dropoff",
    success: boolean,
  ): Promise<RepositoryResult<MissionRecord>> {
    const current = await this.getById(id);
    if (!current.ok) return current;
    if (!current.data) {
      return {
        ok: false,
        error: new RepositoryError(
          "not_found",
          `No mission with id="${id}".`,
        ),
      };
    }

    const verifiedAt = success ? new Date().toISOString() : null;
    if (kind === "pickup") {
      return this.updateById(id, {
        pickupPinAttempts: current.data.pickupPinAttempts + 1,
        ...(success ? { pickupPinVerifiedAt: verifiedAt } : {}),
      });
    }
    return this.updateById(id, {
      dropoffPinAttempts: current.data.dropoffPinAttempts + 1,
      ...(success ? { dropoffPinVerifiedAt: verifiedAt } : {}),
    });
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
