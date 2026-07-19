import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-8 w-fit max-w-full shrink-0 items-center justify-center rounded-full border px-3 py-1 text-center text-[0.7rem] font-semibold uppercase tracking-normal leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-ring/70 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        success:
          "border-success/25 bg-success/12 text-success",
        warning:
          "border-warning/25 bg-warning/12 text-warning",
        destructive:
          "border-destructive/25 bg-destructive/12 text-destructive",
        outline:
          "border-border bg-muted text-muted-foreground",
        ghost: "border-transparent bg-transparent text-muted-foreground",
        link: "h-auto rounded-none border-transparent px-0 text-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
