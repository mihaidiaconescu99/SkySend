import { z } from "zod";
import {
  normalizedEmailSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";

const optionalText = plainTextSchema(1, 160).nullable().optional();

const billingFieldsSchema = z.object({
  customerType: z.enum(["individual", "company"]),
  fullName: optionalText,
  companyLegalName: optionalText,
  taxIdentifier: optionalText,
  addressLine: plainTextSchema(3, 240),
  city: plainTextSchema(2, 100),
  region: plainTextSchema(2, 100),
  countryCode: z.string().trim().toUpperCase().length(2),
  postalCode: optionalText,
  invoiceEmail: normalizedEmailSchema,
  locale: z.enum(["ro", "en"]),
}).strict();

function validateBillingIdentity(
  value: z.infer<typeof billingFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (value.customerType === "individual" && !value.fullName?.trim()) {
    context.addIssue({ code: "custom", path: ["fullName"], message: "full_name_required" });
  }
  if (value.customerType === "company") {
    if (!value.companyLegalName?.trim()) {
      context.addIssue({ code: "custom", path: ["companyLegalName"], message: "company_name_required" });
    }
    if (!value.taxIdentifier?.trim()) {
      context.addIssue({ code: "custom", path: ["taxIdentifier"], message: "tax_identifier_required" });
    }
  }
  if (value.countryCode === "RO" && !/^\d{6}$/u.test(value.postalCode ?? "")) {
    context.addIssue({ code: "custom", path: ["postalCode"], message: "romanian_postal_code_required" });
  }
}

export const savedBillingProfileSchema = billingFieldsSchema
  .superRefine(validateBillingIdentity);

export const billingSnapshotSchema = billingFieldsSchema.extend({
  privacyAccepted: z.literal(true),
}).superRefine(validateBillingIdentity);
