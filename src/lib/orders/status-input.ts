import { z } from "zod";

import {
  opaqueIdentifierSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";

export const updateOrderStatusBodySchema = z
  .object({
    orderId: opaqueIdentifierSchema,
    fulfillmentStatus: z.enum([
      "active_mission",
      "completed_mission",
      "failed_mission",
      "fallback_required",
      "canceled",
    ]),
    fallbackReason: plainTextSchema(1, 1_000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.fallbackReason &&
      value.fulfillmentStatus !== "failed_mission" &&
      value.fulfillmentStatus !== "fallback_required"
    ) {
      context.addIssue({
        code: "custom",
        path: ["fallbackReason"],
        message: "invalid_state_data",
      });
    }
  });

const fulfillmentTransitions = {
  order_created: [
    "active_mission",
    "failed_mission",
    "fallback_required",
    "canceled",
  ],
  active_mission: [
    "completed_mission",
    "failed_mission",
    "fallback_required",
    "canceled",
  ],
  completed_mission: [],
  failed_mission: [],
  fallback_required: [],
  canceled: [],
} as const;

export function isAllowedFulfillmentTransition(
  current: string | null | undefined,
  next: string,
) {
  const normalizedCurrent = current ?? "order_created";
  if (next === normalizedCurrent) return true;
  const allowed = fulfillmentTransitions[
    normalizedCurrent as keyof typeof fulfillmentTransitions
  ] ?? [];
  return (allowed as readonly string[]).includes(next);
}
