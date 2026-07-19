import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToOrder,
  updateInputToRow,
} from "@/lib/repositories/mappers/order-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreateOrderInput,
  Order,
  OrderStatus,
  PaymentStatus,
  UpdateOrderInput,
} from "@/types/order";

const DEFAULT_LIST_LIMIT = 50;
const ACTIVE_STATUSES: readonly OrderStatus[] = [
  "pending",
  "in_progress",
] as const;

type ListOrderBy = "created_at" | "updated_at";

export class OrdersRepository extends BaseRepository<"orders"> {
  protected readonly tableName = "orders" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(id: string): Promise<RepositoryResult<Order | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToOrder(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async getByLocalOrderId(
    localOrderId: string,
  ): Promise<RepositoryResult<Order | null>> {
    return this.findByColumn("local_order_id", localOrderId);
  }

  async getByPublicTrackingCode(
    code: string,
  ): Promise<RepositoryResult<Order | null>> {
    return this.findByColumn("public_tracking_code", code);
  }

  async getByRecipientTrackingToken(
    token: string,
  ): Promise<RepositoryResult<Order | null>> {
    return this.findByColumn("recipient_tracking_token", token);
  }

  private async findByColumn(
    column: string,
    value: string,
  ): Promise<RepositoryResult<Order | null>> {
    if (!value || value.trim() === "") {
      return { ok: true, data: null };
    }

    const row = await this.findOne({
      [column]: value,
    } as never);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToOrder(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(input: CreateOrderInput): Promise<RepositoryResult<Order>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToOrder(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateById(
    id: string,
    input: UpdateOrderInput,
  ): Promise<RepositoryResult<Order>> {
    let patch: ReturnType<typeof updateInputToRow>;
    try {
      patch = updateInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const updated = await this.updateRow(id, patch);
    if (!updated.ok) return updated;
    try {
      return { ok: true, data: rowToOrder(updated.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<RepositoryResult<Order>> {
    return this.updateById(id, { status });
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    refundStatus?: string | null,
  ): Promise<RepositoryResult<Order>> {
    const patch: UpdateOrderInput = { paymentStatus: status };
    if (refundStatus !== undefined) {
      patch.refundStatus = refundStatus;
    }
    return this.updateById(id, patch);
  }

  async deleteById(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
  }

  async listByProfileId(
    profileId: string,
    options: {
      status?: OrderStatus | OrderStatus[];
      limit?: number;
      offset?: number;
      orderBy?: ListOrderBy;
      descending?: boolean;
    } = {},
  ): Promise<RepositoryResult<Order[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const offset = options.offset ?? 0;
    const orderColumn = options.orderBy ?? "created_at";
    const ascending = options.descending === false ? true : false;

    if (Array.isArray(options.status) && options.status.length === 0) {
      return { ok: true, data: [] };
    }

    try {
      let query = this.supabase
        .from("orders")
        .select("*")
        .eq("sender_profile_id", profileId);

      if (Array.isArray(options.status)) {
        query = query.in("status", options.status);
      } else if (options.status) {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query
        .order(orderColumn, { ascending })
        .range(offset, offset + limit - 1);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"orders">[];
      try {
        return { ok: true, data: rows.map(rowToOrder) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async countByProfileId(
    profileId: string,
    status?: OrderStatus,
  ): Promise<RepositoryResult<number>> {
    try {
      let query = this.supabase
        .from("orders")
        .select("id")
        .eq("sender_profile_id", profileId);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) return { ok: false, error: mapPostgresError(error) };
      return { ok: true, data: (data ?? []).length };
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async listActive(
    options: { limit?: number } = {},
  ): Promise<RepositoryResult<Order[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    try {
      const { data, error } = await this.supabase
        .from("orders")
        .select("*")
        .in("status", ACTIVE_STATUSES as unknown as string[])
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"orders">[];
      try {
        return { ok: true, data: rows.map(rowToOrder) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async listAll(
    options: {
      status?: OrderStatus | OrderStatus[];
      limit?: number;
      offset?: number;
      descending?: boolean;
    } = {},
  ): Promise<RepositoryResult<Order[]>> {
    const limit = options.limit ?? 200;
    const offset = options.offset ?? 0;
    const ascending = options.descending === false;

    if (Array.isArray(options.status) && options.status.length === 0) {
      return { ok: true, data: [] };
    }

    try {
      let query = this.supabase.from("orders").select("*");

      if (Array.isArray(options.status)) {
        query = query.in("status", options.status as unknown as string[]);
      } else if (options.status) {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query
        .order("created_at", { ascending })
        .range(offset, offset + limit - 1);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"orders">[];
      try {
        return { ok: true, data: rows.map(rowToOrder) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
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
