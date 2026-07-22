import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";

const toneMap: Record<StatusTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-primary",
};

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center text-sm font-medium", toneMap[tone], className)}
    >
      {label}
    </span>
  );
}
