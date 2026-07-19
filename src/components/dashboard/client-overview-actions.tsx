import Link from "next/link";
import { PackagePlus, Radar, Rows3 } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";

type ClientOverviewActionsProps = {
  latestOrderLabel?: string | null;
  latestOrderHref?: string | null;
};

export function ClientOverviewActions({
  latestOrderLabel,
  latestOrderHref,
}: ClientOverviewActionsProps) {
  return (
    <div className="grid gap-3">
      <AppButton asChild size="lg">
        <Link href="/client/create-delivery">
          <PackagePlus className="size-4" />
          Creează livrare
        </Link>
      </AppButton>

      <div className="grid gap-3 sm:grid-cols-2">
        <AppButton asChild variant="outline" size="lg">
          <Link href={latestOrderHref ?? "/client/orders"}>
            <Radar className="size-4" />
            Urmărește misiunea
          </Link>
        </AppButton>

        <AppButton asChild variant="ghost" size="lg">
          <Link href="/client/orders">
            <Rows3 className="size-4" />
            Vezi comenzile
          </Link>
        </AppButton>
      </div>

      <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 px-4 py-4 text-sm leading-7 text-muted-foreground">
        {latestOrderLabel ? (
          <>
            Ultima comandă live:{" "}
            <span className="font-medium text-foreground">{latestOrderLabel}</span>
            . Creează o livrare nouă sau deschide ultima comandă pentru
            tracking și verificarea statusului.
          </>
        ) : (
          <>
            Creează o livrare nouă sau deschide lista de comenzi pentru
            tracking și activitate recentă în Pitești.
          </>
        )}
      </div>
    </div>
  );
}
