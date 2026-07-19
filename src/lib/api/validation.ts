import { NextResponse } from "next/server";
import { z } from "zod";

export type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

export type ValidationFailure = {
  ok: false;
  response: NextResponse;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export async function validateRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  request: Request,
): Promise<ValidationResult<z.infer<TSchema>>> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "ValidationError",
          details: {
            formErrors: ["Invalid JSON body."],
            fieldErrors: {},
          },
        },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(rawBody);

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "ValidationError",
          details: z.flattenError(parsed.error),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
