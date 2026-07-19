"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/shared/app-button";
import { prepareRepeatDeliveryFromOrder } from "@/lib/repeat-delivery";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

type RepeatDeliveryButtonProps = {
  order: CreatedDeliveryOrder;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "lg";
  className?: string;
};

export function RepeatDeliveryButton({
  order,
  variant = "outline",
  size = "sm",
  className,
}: RepeatDeliveryButtonProps) {
  const router = useRouter();

  return (
    <AppButton
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        prepareRepeatDeliveryFromOrder(order);
        router.push("/client/create-delivery");
      }}
    >
      <RotateCcw className="size-4" />
      Repetă livrarea
    </AppButton>
  );
}
