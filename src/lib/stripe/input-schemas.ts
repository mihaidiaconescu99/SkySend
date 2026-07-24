import { z } from "zod";

import {
  localOrderIdSchema,
  plainTextSchema,
  uuidSchema,
} from "@/lib/api/input-schemas";

export const stripePaymentIntentIdSchema = z
  .string()
  .trim()
  .min(4)
  .max(255)
  .regex(/^pi_[A-Za-z0-9_]+$/u);

export const stripePaymentMethodIdSchema = z
  .string()
  .trim()
  .min(4)
  .max(255)
  .regex(/^pm_[A-Za-z0-9_]+$/u);

export const orderLookupIdSchema = z.union([
  localOrderIdSchema,
  uuidSchema,
]);

export const paymentIntentRequestSchema = z
  .object({
    checkoutSessionId: uuidSchema,
    savePaymentMethod: z.boolean().default(false),
  })
  .strict();

export const paySavedMethodRequestSchema = z
  .object({
    checkoutSessionId: uuidSchema,
    paymentIntentId: stripePaymentIntentIdSchema,
    paymentMethodId: stripePaymentMethodIdSchema,
  })
  .strict();

export const paymentMethodPatchSchema = z
  .object({
    paymentMethodId: stripePaymentMethodIdSchema,
    action: z.enum(["set_default", "clear_default"]),
  })
  .strict();

export const paymentMethodDeleteSchema = z
  .object({
    paymentMethodId: stripePaymentMethodIdSchema,
  })
  .strict();

export const refundBodySchema = z
  .object({
    orderId: orderLookupIdSchema,
    amountMinor: z.number().finite().int().positive().max(100_000_000).optional(),
    reason: plainTextSchema(3, 300),
  })
  .strict();
