import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex min-w-0 flex-col gap-5 overflow-hidden rounded-[var(--ui-radius-card)] border border-border bg-card text-sm text-card-foreground shadow-[var(--elevation-card)] data-[size=sm]:gap-4",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid min-w-0 auto-rows-min items-start gap-1.5 px-5 pt-5 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pt-4 has-data-[slot=card-action]:grid-cols-[minmax(0,1fr)_auto] sm:px-6 sm:pt-6 group-data-[size=sm]/card:sm:px-5 group-data-[size=sm]/card:sm:pt-5",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "min-w-0 font-heading text-lg leading-tight font-medium group-data-[size=sm]/card:text-base",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("min-w-0 px-5 pb-5 group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:pb-4 sm:px-6 sm:pb-6 group-data-[size=sm]/card:sm:px-5 group-data-[size=sm]/card:sm:pb-5", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center border-t border-border bg-secondary/45 px-6 py-4 group-data-[size=sm]/card:px-5 group-data-[size=sm]/card:py-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
