import type { Database } from "@/types/database";

export type RepositoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: RepositoryError };

export type RepositoryErrorCode =
  | "not_found"
  | "permission_denied"
  | "validation_error"
  | "database_error"
  | "unknown";

export class RepositoryError extends Error {
  public readonly code: RepositoryErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly originalError?: unknown;

  constructor(
    code: RepositoryErrorCode,
    message: string,
    options: {
      details?: Record<string, unknown>;
      originalError?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.details = options.details;
    this.originalError = options.originalError;
  }
}

export type DBTableName = keyof Database["public"]["Tables"];

export type DBRow<TTable extends DBTableName> =
  Database["public"]["Tables"][TTable]["Row"];

export type DBInsert<TTable extends DBTableName> =
  Database["public"]["Tables"][TTable]["Insert"];

export type DBUpdate<TTable extends DBTableName> =
  Database["public"]["Tables"][TTable]["Update"];
