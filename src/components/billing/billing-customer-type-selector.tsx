"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { BillingCustomerType } from "@/types/billing";

type BillingCustomerTypeSelectorProps = {
  value: BillingCustomerType;
  onValueChange: (value: BillingCustomerType) => void;
  layoutId: string;
  className?: string;
};

const customerTypes: Array<{ value: BillingCustomerType; label: string }> = [
  { value: "individual", label: "Persoană fizică" },
  { value: "company", label: "Persoană juridică" },
];

export function BillingCustomerTypeSelector({
  value,
  onValueChange,
  layoutId,
  className,
}: BillingCustomerTypeSelectorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative grid grid-cols-2 gap-1 rounded-xl bg-secondary/45 p-1",
        className,
      )}
      role="group"
      aria-label="Tip client"
    >
      {customerTypes.map((customerType) => {
        const isSelected = value === customerType.value;

        return (
          <button
            key={customerType.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onValueChange(customerType.value)}
            className={cn(
              "relative z-10 min-h-11 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-4 focus-visible:ring-ring",
              isSelected
                ? "text-cyan-800 dark:text-cyan-100"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isSelected ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-lg border border-cyan-300/20 bg-cyan-400/12 shadow-[0_1px_5px_rgb(34_211_238_/_0.08)]"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 500, damping: 40 }
                }
              />
            ) : null}
            {customerType.label}
          </button>
        );
      })}
    </div>
  );
}
