import { Card, CardContent } from "@/components/ui/card";

type RoleOverviewCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function RoleOverviewCard({
  label,
  value,
  hint,
}: RoleOverviewCardProps) {
  return (
    <Card className="rounded-[calc(var(--radius)+0.375rem)]">
      <CardContent className="flex flex-col gap-3 p-6">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <strong className="font-heading text-3xl tracking-tight">{value}</strong>
        <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
