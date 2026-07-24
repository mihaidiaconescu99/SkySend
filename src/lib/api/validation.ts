import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/api/request-security";

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
  sameOrigin?: boolean;
};

type RawBodyOptions = ValidationOptions & {
  acceptedContentTypes?: readonly string[];
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
  if (options.sameOrigin !== false) {
    const originFailure = requireSameOrigin(request);
    if (originFailure) return { ok: false, response: originFailure };
  }
  const raw = await readLimitedTextRequest(request, options);
  if (!raw.ok) return raw;

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(raw.data) as unknown;
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

export async function readLimitedTextRequest(
  request: Request,
  options: RawBodyOptions = {},
): Promise<ValidationResult<string>> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const acceptedContentTypes = options.acceptedContentTypes ?? ["application/json"];
  if (!contentType || !acceptedContentTypes.includes(contentType)) {
    return validationFailure("unsupported_media_type", 415);
  }

  const maxBytes = options.maxBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/u.test(declaredLength.trim())) {
      return validationFailure("invalid_json", 400);
    }
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maxBytes) {
      return validationFailure("payload_too_large", 413);
    }
  }

  let bytes: Uint8Array;

  try {
    if (!request.body) {
      return validationFailure("invalid_json", 400, {
        formErrors: ["Invalid JSON body."],
        fieldErrors: {},
      });
    }
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return validationFailure("payload_too_large", 413);
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch {
    return validationFailure("invalid_json", 400, {
      formErrors: ["Invalid JSON body."],
      fieldErrors: {},
    });
  }

  if (bytes.byteLength > maxBytes) {
    return validationFailure("payload_too_large", 413);
  }

  try {
    return {
      ok: true,
      data: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    };
  } catch {
    return validationFailure("invalid_json", 400, {
      formErrors: ["Invalid JSON body."],
      fieldErrors: {},
    });
  }
}

export function publicErrorCode<const TAllowed extends readonly string[]>(
  error: unknown,
  allowed: TAllowed,
  fallback: string,
): TAllowed[number] | string {
  const message = error instanceof Error ? error.message : "";
  return (allowed as readonly string[]).includes(message) ? message : fallback;
}
