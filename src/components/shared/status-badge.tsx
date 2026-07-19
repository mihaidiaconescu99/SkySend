import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StatusTone = "neutral" | "success" | "warning" | "destructive" | "info";

const toneMap: Record<StatusTone, "outline" | "success" | "warning" | "destructive" | "secondary"> = {
  neutral: "outline",
  success: "success",
  warning: "warning",
  destructive: "destructive",
  info: "secondary",
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
  dot = true,
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant={toneMap[tone]} className={cn("gap-2", className)}>
      {dot ? (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current opacity-80"
        />
      ) : null}
      {label}
    </Badge>
  );
}
