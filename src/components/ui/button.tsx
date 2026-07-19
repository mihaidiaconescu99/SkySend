import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-11 max-w-full shrink-0 items-center justify-center gap-2 whitespace-normal text-center rounded-[calc(var(--radius)+0.35rem)] border border-transparent text-sm font-semibold leading-tight transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 focus-visible:border-primary/70 focus-visible:ring-4 focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary text-primary-foreground shadow-none hover:border-primary/50 hover:bg-primary/90",
        outline:
          "border-border bg-card text-foreground hover:border-primary/45 hover:bg-secondary/75",
        secondary:
          "border-border/80 bg-secondary text-secondary-foreground hover:border-primary/35 hover:bg-secondary/85",
        ghost:
          "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "h-auto rounded-none p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-5 py-2.5",
        xs: "min-h-11 px-3.5 py-2 text-xs",
        sm: "min-h-11 px-4 py-2 text-sm",
        lg: "min-h-[3.25rem] px-6 py-3 text-sm sm:px-7",
        icon: "size-11 rounded-2xl",
        "icon-xs": "size-11 rounded-xl",
        "icon-sm": "size-11 rounded-xl",
        "icon-lg": "size-12 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
