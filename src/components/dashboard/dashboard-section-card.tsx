import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardSectionCardProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
  accent: string;
};

export function DashboardSectionCard({
  id,
  eyebrow,
  title,
  description,
  items,
  accent,
}: DashboardSectionCardProps) {
  return (
    <Card id={id} className="scroll-mt-24 rounded-[var(--ui-radius-card)]">
      <CardHeader className="gap-3">
        <Badge variant="outline" className="w-fit">
          {eyebrow}
        </Badge>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        <div className="grid gap-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-secondary/50 px-4 py-4"
            >
              <span className="flex items-start gap-3 text-sm leading-7 text-muted-foreground">
                <span
                  className="mt-2 size-1.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span>{item}</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
