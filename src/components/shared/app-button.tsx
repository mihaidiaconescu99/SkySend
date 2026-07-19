import * as React from "react";
import {
  Button,
  type buttonVariants,
} from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

type AppButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants>;

export function AppButton(props: AppButtonProps) {
  return <Button {...props} />;
}
