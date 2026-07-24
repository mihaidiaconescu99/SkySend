import { z } from "zod";

const htmlTagPattern = /<\s*\/?\s*[a-z][^>]*>/iu;
const javascriptSchemePattern = /javascript\s*:/iu;
const unsafeControlCharacterPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const unsafeObjectKeys = new Set(["__proto__", "prototype", "constructor"]);

export function isPlainUserText(value: string) {
  return (
    !htmlTagPattern.test(value) &&
    !javascriptSchemePattern.test(value) &&
    !unsafeControlCharacterPattern.test(value)
  );
}

export function plainTextSchema(minLength: number, maxLength: number) {
  return z
    .string()
    .trim()
    .min(minLength)
    .max(maxLength)
    .refine(isPlainUserText, { message: "unsafe_text" });
}

export const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

export const uuidSchema = z.string().trim().toLowerCase().uuid();

export const opaqueIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);

export const isoDateTimeSchema = z
  .string()
  .trim()
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "invalid_datetime",
  });

export const geoPointSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

export const localOrderIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^SKY-PT-\d{5}-\d{3}$/u);

export const publicTrackingCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^SKY-PIT-\d{5}-[A-HJ-NP-Z2-9]{3}$/u);

export const recipientTrackingTokenSchema = z
  .string()
  .trim()
  .regex(/^rpt_[A-Za-z0-9_-]{32}$/u);

export const trackingIdentifierSchema = z
  .string()
  .trim()
  .min(6)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/u);

export const internalActionUrlSchema = z
  .string()
  .trim()
  .max(500)
  .regex(/^\/(?!\/)[A-Za-z0-9/_?&=.%+#-]*$/u);

export const uploadFileNameSchema = plainTextSchema(1, 255)
  .refine((value) => value !== "." && value !== "..", {
    message: "invalid_file_name",
  })
  .refine((value) => !/[\\/]/u.test(value), {
    message: "invalid_file_name",
  });

type JsonLimits = {
  maxDepth?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
};

function findUnsafeJsonValue(
  value: unknown,
  limits: Required<JsonLimits>,
  depth = 0,
): string | null {
  if (depth > limits.maxDepth) return "json_too_deep";
  if (value === null || typeof value === "boolean") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? null : "invalid_number";
  }
  if (typeof value === "string") {
    if (value.length > limits.maxStringLength) return "string_too_long";
    return isPlainUserText(value) ? null : "unsafe_text";
  }
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) return "array_too_long";
    for (const item of value) {
      const issue = findUnsafeJsonValue(item, limits, depth + 1);
      if (issue) return issue;
    }
    return null;
  }
  if (typeof value !== "object") return "invalid_json_value";
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > limits.maxObjectKeys) return "too_many_properties";
  for (const [key, item] of entries) {
    if (unsafeObjectKeys.has(key)) return "unsafe_property";
    if (key.length > 100) return "property_name_too_long";
    const issue = findUnsafeJsonValue(item, limits, depth + 1);
    if (issue) return issue;
  }
  return null;
}

export function boundedJsonValueSchema(limits: JsonLimits = {}) {
  const resolved: Required<JsonLimits> = {
    maxDepth: limits.maxDepth ?? 8,
    maxArrayLength: limits.maxArrayLength ?? 100,
    maxObjectKeys: limits.maxObjectKeys ?? 100,
    maxStringLength: limits.maxStringLength ?? 5_000,
  };

  return z.unknown().superRefine((value, context) => {
    const issue = findUnsafeJsonValue(value, resolved);
    if (issue) {
      context.addIssue({ code: "custom", message: issue });
    }
  });
}
