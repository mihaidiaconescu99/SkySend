

import type { SupabaseClient } from "@supabase/supabase-js";

import { BaseRepository } from "@/lib/repositories/base-repository";
import { mapPostgresError } from "@/lib/repositories/errors";
import {
  createInputToRow,
  rowToPaymentRecord,
} from "@/lib/repositories/mappers/payment-record-mapper";
import {
  RepositoryError,
  type DBRow,
  type RepositoryResult,
} from "@/lib/repositories/types";
import type { Database } from "@/types/database";
import type {
  CreatePaymentRecordInput,
  PaymentRecord,
} from "@/types/payment-record";

const DEFAULT_LIST_LIMIT = 100;

type ListOrderBy = "created_at" | "amount_minor";

export class PaymentRecordsRepository extends BaseRepository<"payment_records"> {
  protected readonly tableName = "payment_records" as const;

  constructor(supabase: SupabaseClient<Database>) {
    super(supabase);
  }

  async getById(
    id: string,
  ): Promise<RepositoryResult<PaymentRecord | null>> {
    const row = await this.findById(id);
    if (!row.ok) return row;
    if (row.data === null) return { ok: true, data: null };
    try {
      return { ok: true, data: rowToPaymentRecord(row.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async create(
    input: CreatePaymentRecordInput,
  ): Promise<RepositoryResult<PaymentRecord>> {
    let row: ReturnType<typeof createInputToRow>;
    try {
      row = createInputToRow(input);
    } catch (caught) {
      return toMapperFailure(caught);
    }
    const inserted = await this.insert(row);
    if (!inserted.ok) return inserted;
    try {
      return { ok: true, data: rowToPaymentRecord(inserted.data) };
    } catch (caught) {
      return toMapperFailure(caught);
    }
  }

  async listByOrderId(
    orderId: string,
  ): Promise<RepositoryResult<PaymentRecord[]>> {
    try {
      const { data, error } = await this.supabase
        .from("payment_records")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"payment_records">[];
      try {
        return { ok: true, data: rows.map(rowToPaymentRecord) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async listByProfileId(
    profileId: string,
    options: { limit?: number; orderBy?: ListOrderBy } = {},
  ): Promise<RepositoryResult<PaymentRecord[]>> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const orderColumn = options.orderBy ?? "created_at";
    try {
      const { data, error } = await this.supabase
        .from("payment_records")
        .select("*")
        .eq("profile_id", profileId)
        .order(orderColumn, { ascending: false })
        .limit(limit);

      if (error) return { ok: false, error: mapPostgresError(error) };

      const rows = (data ?? []) as DBRow<"payment_records">[];
      try {
        return { ok: true, data: rows.map(rowToPaymentRecord) };
      } catch (caught) {
        return toMapperFailure(caught);
      }
    } catch (caught) {
      return { ok: false, error: mapPostgresError(caught) };
    }
  }

  async sumAmountForOrder(
    orderId: string,
  ): Promise<RepositoryResult<number>> {
    const list = await this.listByOrderId(orderId);
    if (!list.ok) return list;
    let net = 0;
    for (const record of list.data) {
      if (record.status !== "succeeded") continue;
      if (record.type === "payment") {
        net += record.amountMinor;
      } else {

        net -= record.amountMinor;
      }
    }
    return { ok: true, data: net };
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
