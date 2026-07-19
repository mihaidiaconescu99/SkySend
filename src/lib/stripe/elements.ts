import type { StripeElementsOptions } from "@stripe/stripe-js";

export const skySendStripeElementsAppearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#0f766e",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorDanger: "#dc2626",
    colorTextSecondary: "#64748b",
    borderRadius: "12px",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #cbd5e1",
      boxShadow: "none",
    },
    ".Input:focus": {
      borderColor: "#0f766e",
      boxShadow: "0 0 0 3px rgba(20, 184, 166, 0.16)",
    },
    ".Tab": {
      border: "1px solid #cbd5e1",
      boxShadow: "none",
    },
    ".Tab--selected": {
      borderColor: "#0f766e",
      boxShadow: "0 0 0 3px rgba(20, 184, 166, 0.16)",
    },
  },
} satisfies NonNullable<StripeElementsOptions["appearance"]>;
