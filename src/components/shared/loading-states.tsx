import type { ReactNode } from "react";
import { Bell, Map, Package2, Rows3, ShieldAlert } from "lucide-react";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";

type DashboardCardsLoadingStateProps = {
  count?: number;
};

export function DashboardCardsLoadingState({
  count = 3,
}: DashboardCardsLoadingStateProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <Card key={`dashboard-card-skeleton-${index}`}>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <LoadingSkeleton className="h-3.5 w-24" />
                <LoadingSkeleton className="h-9 w-20" />
              </div>
              <LoadingSkeleton className="size-9 rounded-2xl" />
            </div>
            <LoadingSkeleton className="h-3.5 w-full" />
            <LoadingSkeleton className="h-3.5 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type TableLoadingStateProps = {
  rows?: number;
  columns?: number;
  title?: string;
  description?: string;
};

export function TableLoadingState({
  rows = 5,
  columns = 4,
  title = "Se încarcă înregistrările",
  description = "Se aduc cele mai recente rânduri operaționale.",
}: TableLoadingStateProps) {
  return (
    <Card className="rounded-[var(--ui-radius-panel)]">
      <CardContent className="grid gap-5 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 items-center justify-center rounded-[1.15rem] border border-border/80 bg-secondary/60 text-foreground">
            <Rows3 className="size-5" />
          </span>
          <div className="space-y-2">
            <p className="font-heading text-xl tracking-tight">{title}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card">
          <div className="grid gap-3 border-b border-border/80 bg-secondary/35 px-4 py-4 md:grid-cols-4">
            {Array.from({ length: columns }, (_, index) => (
              <LoadingSkeleton
                key={`table-head-skeleton-${index}`}
                className="h-3.5 w-20"
              />
            ))}
          </div>
          <div className="grid gap-3 p-4">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <div
                key={`table-row-skeleton-${rowIndex}`}
                className="grid gap-3 rounded-[calc(var(--radius)+0.25rem)] border border-border/70 bg-secondary/20 px-3 py-3 md:grid-cols-4"
              >
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <LoadingSkeleton
                    key={`table-cell-skeleton-${rowIndex}-${columnIndex}`}
                    className={
                      columnIndex === 0 ? "h-4 w-32" : "h-4 w-full max-w-[8rem]"
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type MapLoadingStateProps = {
  title?: string;
  description?: string;
};

export function MapLoadingState({
  title = "Se încarcă harta",
  description = "Se pregătesc acoperirea, punctele de serviciu și contextul traseului.",
}: MapLoadingStateProps) {
  return (
    <Card className="rounded-[var(--ui-radius-panel)] overflow-hidden">
      <CardContent className="grid gap-5 p-0">
        <div className="relative min-h-[24rem] overflow-hidden bg-[linear-gradient(180deg,rgba(244,247,251,0.96)_0%,rgba(232,238,248,0.92)_100%)]">
          <LoadingSkeleton className="absolute left-[8%] top-[14%] h-16 w-44 rounded-[1.25rem] bg-card/70" />
          <LoadingSkeleton className="absolute right-[12%] top-[22%] size-4 rounded-full bg-primary/25" />
          <LoadingSkeleton className="absolute left-[24%] top-[38%] h-1.5 w-[42%] rotate-[8deg] rounded-full bg-brand-sky/45" />
          <LoadingSkeleton className="absolute left-[56%] top-[52%] size-4 rounded-full bg-success/30" />
          <LoadingSkeleton className="absolute left-[18%] bottom-[16%] size-4 rounded-full bg-warning/30" />
          <LoadingSkeleton className="absolute right-[16%] bottom-[12%] h-11 w-11 rounded-2xl bg-card/75" />

          <div className="absolute left-5 top-5 flex max-w-xs items-start gap-4 rounded-[1.35rem] border border-border/80 bg-card/90 px-4 py-4 shadow-[var(--elevation-soft)]">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary/70 text-foreground">
              <Map className="size-4" />
            </span>
            <div className="space-y-2">
              <p className="font-heading text-lg tracking-tight">{title}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentsLoadingState() {
  return (
    <TableLoadingState
      rows={4}
      columns={4}
      title="Se încarcă plățile"
      description="Se pregătesc facturile, metodele de plată și statusul recent al tranzacțiilor."
    />
  );
}

export function OrdersLoadingState() {
  return (
    <TableLoadingState
      rows={5}
      columns={5}
      title="Se încarcă comenzile"
      description="Se pregătesc livrările recente, statusul de dispatch și contextul coletului."
    />
  );
}

export function CompactPanelLoadingState({
  icon = <Package2 className="size-5" />,
  title = "Se încarcă panoul",
  description = "Se pregătește cel mai recent context al spațiului de lucru.",
}: {
  icon?: ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <Card className="rounded-[var(--ui-radius-panel)]">
      <CardContent className="grid gap-5 p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-12 items-center justify-center rounded-[1.15rem] border border-border/80 bg-secondary/60 text-foreground">
            {icon}
          </span>
          <div className="space-y-2">
            <p className="font-heading text-xl tracking-tight">{title}</p>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <LoadingSkeleton className="h-4 w-4/5" />
          <LoadingSkeleton className="h-4 w-full" />
          <LoadingSkeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificăriLoadingState() {
  return (
    <CompactPanelLoadingState
      icon={<Bell className="size-5" />}
      title="Se încarcă notificările"
      description="Se colectează alertele, actualizările de serviciu și evenimentele livrării."
    />
  );
}

export function FailedOrdersLoadingState() {
  return (
    <CompactPanelLoadingState
      icon={<ShieldAlert className="size-5" />}
      title="Se încarcă lista de excepții"
      description="Se pregătesc misiunile eșuate și contextul de recuperare."
    />
  );
}
