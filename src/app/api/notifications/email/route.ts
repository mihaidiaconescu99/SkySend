import { NextResponse } from "next/server";
import { z } from "zod";
import {
  localOrderIdSchema,
  normalizedEmailSchema,
} from "@/lib/api/input-schemas";
import { bearerSecretMatches } from "@/lib/api/request-security";
import { validateRequest } from "@/lib/api/validation";
import {
  sendSkySendEmail,
  type SkySendEmailEvent,
} from "@/lib/email/resend";

const emailEvents: SkySendEmailEvent[] = [
  "order_confirmation",
  "payment_confirmation",
  "recipient_tracking_link",
  "delivery_completed",
  "order_cancelled",
];

const emailRequestSchema = z.object({
  event: z.enum(emailEvents as [SkySendEmailEvent, ...SkySendEmailEvent[]]),
  to: normalizedEmailSchema.nullable().optional(),
  orderId: localOrderIdSchema.nullable().optional(),
  trackingUrl: z
    .string()
    .trim()
    .url()
    .max(1_000)
    .refine((value) => new URL(value).protocol === "https:", {
      message: "https_required",
    })
    .nullable()
    .optional(),
}).strict();

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "internal_endpoint_not_configured" },
      { status: 503 },
    );
  }
  if (!bearerSecretMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const parsed = await validateRequest(emailRequestSchema, request, {
      maxBytes: 8 * 1024,
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const result = await sendSkySendEmail({
      event: body.event,
      to: body.to,
      orderId: body.orderId,
      trackingUrl: body.trackingUrl,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Email notification could not be sent." },
      { status: 500 },
    );
  }
}
