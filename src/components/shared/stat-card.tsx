import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: ReactNode;
};

export function StatCard({ label, value, hint, trend }: StatCardProps) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.375rem)] bg-card/95">
      <CardContent className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0 text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {trend ? <span className="shrink-0">{trend}</span> : null}
        </div>
        <strong className="min-w-0 font-heading text-2xl tracking-tight sm:text-3xl">
          {value}
        </strong>
        {hint ? (
          <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
