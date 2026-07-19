import type { PostgrestError } from "@supabase/supabase-js";

import { RepositoryError, type RepositoryErrorCode } from "@/lib/repositories/types";

const POSTGRES_PERMISSION_CODES = new Set(["42501"]);
const POSTGRES_VALIDATION_CODES = new Set([
  "22P02",
  "23502",
  "23503",
  "23505",
  "23514",
  "23000",
]);
const POSTGREST_NOT_FOUND_CODES = new Set([
  "PGRST116",
  "PGRST106",
  "PGRST205",
]);

const POSTGREST_PERMISSION_CODES = new Set(["PGRST301", "PGRST302"]);

function isPostgrestError(value: unknown): value is PostgrestError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.message === "string" &&
    "code" in candidate &&
    "details" in candidate
  );
}

function classifyCode(code: string | null | undefined): RepositoryErrorCode {
  if (!code) return "database_error";
  if (POSTGREST_NOT_FOUND_CODES.has(code)) return "not_found";
  if (
    POSTGRES_PERMISSION_CODES.has(code) ||
    POSTGREST_PERMISSION_CODES.has(code)
  ) {
    return "permission_denied";
  }
  if (POSTGRES_VALIDATION_CODES.has(code)) return "validation_error";
  return "database_error";
}

export function mapPostgresError(error: unknown): RepositoryError {
  if (isPostgrestError(error)) {
    const code = classifyCode(error.code);
    return new RepositoryError(code, error.message, {
      details: {
        postgresCode: error.code,
        hint: error.hint,
        rawDetails: error.details,
      },
      originalError: error,
    });
  }

  if (error instanceof Error) {
    return new RepositoryError("unknown", error.message, {
      originalError: error,
    });
  }

  return new RepositoryError("unknown", "Unknown repository error.", {
    originalError: error,
  });
}

export function isNotFound(error: RepositoryError): boolean {
  return error.code === "not_found";
}
