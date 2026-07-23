import { describe, expect, it } from "vitest";
import { billingSnapshotSchema, savedBillingProfileSchema } from "@/lib/billing/validation";

const individual = {
  customerType: "individual" as const,
  fullName: "Ana Popescu",
  companyLegalName: null,
  taxIdentifier: null,
  addressLine: "Strada Victoriei 10",
  city: "Pitești",
  region: "Argeș",
  countryCode: "ro",
  postalCode: "110001",
  invoiceEmail: "ana@example.com",
  locale: "ro" as const,
};

describe("billing validation", () => {
  it("normalizes the country code for a saved individual profile", () => {
    expect(savedBillingProfileSchema.parse(individual).countryCode).toBe("RO");
  });

  it("requires per-invoice consent for checkout billing", () => {
    expect(billingSnapshotSchema.safeParse(individual).success).toBe(false);
    expect(billingSnapshotSchema.safeParse({ ...individual, privacyAccepted: true }).success).toBe(true);
  });

  it("requires a six-digit Romanian postal code", () => {
    expect(savedBillingProfileSchema.safeParse({ ...individual, postalCode: "1100" }).success).toBe(false);
  });

  it("requires company identity fields for legal entities", () => {
    expect(savedBillingProfileSchema.safeParse({
      ...individual,
      customerType: "company",
      fullName: null,
      companyLegalName: "",
      taxIdentifier: "",
    }).success).toBe(false);
  });
});
