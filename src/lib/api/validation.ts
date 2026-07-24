import { NextResponse } from "next/server";
import { z } from "zod";

export const DEFAULT_JSON_BODY_LIMIT_BYTES = 64 * 1024;

export type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

export type ValidationFailure = {
  ok: false;
  response: NextResponse;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

type ValidationOptions = {
  maxBytes?: number;
};

function validationFailure(
  code: "invalid_json" | "payload_too_large" | "unsupported_media_type" | "validation_failed",
  status: 400 | 413 | 415,
  details?: unknown,
): ValidationFailure {
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "ValidationError",
        code,
        ...(details === undefined ? {} : { details }),
      },
      { status },
    ),
  };
}

export async function validateRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  request: Request,
  options: ValidationOptions = {},
): Promise<ValidationResult<z.infer<TSchema>>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return validationFailure("unsupported_media_type", 415);
  }

  const maxBytes = options.maxBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return validationFailure("payload_too_large", 413);
    }
  }

  let bytes: ArrayBuffer;

  try {
    bytes = await request.arrayBuffer();
  } catch {
    return validationFailure("invalid_json", 400, {
      formErrors: ["Invalid JSON body."],
      fieldErrors: {},
    });
  }

  if (bytes.byteLength > maxBytes) {
    return validationFailure("payload_too_large", 413);
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return validationFailure("invalid_json", 400, {
      formErrors: ["Invalid JSON body."],
      fieldErrors: {},
    });
  }

  const parsed = schema.safeParse(rawBody);

  if (!parsed.success) {
    return validationFailure(
      "validation_failed",
      400,
      z.flattenError(parsed.error),
    );
  }

  return { ok: true, data: parsed.data };
}

export function publicErrorCode<const TAllowed extends readonly string[]>(
  error: unknown,
  allowed: TAllowed,
  fallback: string,
): TAllowed[number] | string {
  const message = error instanceof Error ? error.message : "";
  return (allowed as readonly string[]).includes(message) ? message : fallback;
}
