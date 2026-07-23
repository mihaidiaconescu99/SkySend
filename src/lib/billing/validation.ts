import { z } from "zod";

const optionalText = z.string().trim().max(160).nullable().optional();

const billingFieldsSchema = z.object({
  customerType: z.enum(["individual", "company"]),
  fullName: optionalText,
  companyLegalName: optionalText,
  taxIdentifier: optionalText,
  addressLine: z.string().trim().min(3).max(240),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().min(2).max(100),
  countryCode: z.string().trim().toUpperCase().length(2),
  postalCode: optionalText,
  invoiceEmail: z.string().trim().email().max(254),
  locale: z.enum(["ro", "en"]),
});

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
