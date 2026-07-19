import {
  RepositoryError,
  type DBInsert,
  type DBRow,
} from "@/lib/repositories/types";
import {
  PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_TYPES,
  type CreatePaymentRecordInput,
  type PaymentRecord,
  type PaymentRecordStatus,
  type PaymentRecordType,
} from "@/types/payment-record";

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError(
      "validation_error",
      `Missing or invalid "${fieldName}".`,
      { details: { fieldName, value } },
    );
  }
  return value;
}

export function parsePaymentRecordType(value: unknown): PaymentRecordType {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid payment_record type: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(PAYMENT_RECORD_TYPES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid payment_record type: "${value}".`,
      { details: { value, allowed: PAYMENT_RECORD_TYPES } },
    );
  }
  return value as PaymentRecordType;
}

export function parsePaymentRecordStatus(
  value: unknown,
): PaymentRecordStatus {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid payment_record status: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!(PAYMENT_RECORD_STATUSES as readonly string[]).includes(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid payment_record status: "${value}".`,
      { details: { value, allowed: PAYMENT_RECORD_STATUSES } },
    );
  }
  return value as PaymentRecordStatus;
}

export function validateCurrency(value: unknown): string {
  if (typeof value !== "string") {
    throw new RepositoryError(
      "validation_error",
      `Invalid currency: expected string, got ${typeof value}.`,
      { details: { value } },
    );
  }
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new RepositoryError(
      "validation_error",
      `Invalid currency code: "${value}" (expected 3 uppercase letters).`,
      { details: { value } },
    );
  }
  return value;
}

function validateAmountMinor(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new RepositoryError(
      "validation_error",
      `amountMinor must be a non-negative integer; got ${value}.`,
      { details: { value } },
    );
  }
  return value;
}

export function rowToPaymentRecord(
  row: DBRow<"payment_records">,
): PaymentRecord {
  return {
    id: requireString(row.id, "id"),
    orderId: requireString(row.order_id, "order_id"),
    profileId: requireString(row.profile_id, "profile_id"),
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeChargeId: row.stripe_charge_id ?? null,
    stripeRefundId: row.stripe_refund_id ?? null,
    amountMinor: validateAmountMinor(row.amount_minor),
    currency: validateCurrency(row.currency),
    type: parsePaymentRecordType(row.type),
    status: parsePaymentRecordStatus(row.status),
    failureReason: row.failure_reason ?? null,
    createdAt: requireString(row.created_at, "created_at"),
  };
}

export function createInputToRow(
  input: CreatePaymentRecordInput,
): DBInsert<"payment_records"> {
  const row: DBInsert<"payment_records"> = {
    order_id: requireString(input.orderId, "orderId"),
    profile_id: requireString(input.profileId, "profileId"),
    amount_minor: validateAmountMinor(input.amountMinor),
    currency: validateCurrency(input.currency ?? "RON"),
    type: parsePaymentRecordType(input.type),
    status: parsePaymentRecordStatus(input.status),
  };

  if (input.stripePaymentIntentId !== undefined) {
    row.stripe_payment_intent_id = input.stripePaymentIntentId;
  }
  if (input.stripeChargeId !== undefined) {
    row.stripe_charge_id = input.stripeChargeId;
  }
  if (input.stripeRefundId !== undefined) {
    row.stripe_refund_id = input.stripeRefundId;
  }
  if (input.failureReason !== undefined) {
    row.failure_reason = input.failureReason;
  }

  return row;
}
