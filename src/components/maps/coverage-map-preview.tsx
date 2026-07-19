import { MapPinned, Route, Warehouse } from "lucide-react";
import { LazyMapContainer } from "@/components/maps/lazy-map-container";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  coveragePreviewMarkers,
  coveragePreviewStats,
} from "@/constants/coverage-map";
import { activeHub } from "@/constants/hub";
import { getServiceAreaMapOverlay } from "@/lib/map";
import { cn } from "@/lib/utils";

type CoverageMapPreviewProps = {
  className?: string;
};

const serviceAreaOverlay = getServiceAreaMapOverlay();
const serviceAreaOverlays = [serviceAreaOverlay] as const;

export function CoverageMapPreview({ className }: CoverageMapPreviewProps) {
  return (
    <div className={cn("grid min-w-0 gap-5", className)}>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-stretch">
        <LazyMapContainer
          className="min-h-[13rem] sm:min-h-[22rem] lg:min-h-[29rem]"
          ariaLabel="Hartă acoperire SkySend"
          center={activeHub.address.location}
          zoom={12.7}
          markers={coveragePreviewMarkers}
          overlays={serviceAreaOverlays}
          overlayContent={
            <div className="map-overlay-card max-w-full sm:max-w-xs">
              <p className="type-caption">Legenda harta</p>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="mt-1 size-3 shrink-0 rounded-full border border-primary bg-primary/20" />
                  <span>Cercul cyan arata raza de livrare SkySend.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-[#8f7bff]/70 bg-background text-foreground">
                    <Warehouse className="size-3" />
                  </span>
                  <span>Iconita de pe harta reprezinta hub-ul SkySend.</span>
                </div>
              </div>
            </div>
          }
        />

        <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Card size="sm" className="rounded-[var(--ui-radius-panel)]">
            <CardHeader className="gap-3">
              <MapPinned className="size-5 text-primary" />
              <CardTitle className="text-xl">Oraș curent: Pitești</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                SkySend este limitat intenționat la zona activă Pitești, ca
                traseul, compartimentul și urmărirea să rămână predictibile.
              </p>
            </CardContent>
          </Card>

          <Card size="sm" className="rounded-[var(--ui-radius-panel)]">
            <CardHeader className="gap-3">
              <Route className="size-5 text-primary" />
              <CardTitle className="text-xl">Regulă traseu</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Ridicarea și livrarea trebuie să fie în acoperire înainte ca
                livrarea să poată continua.
              </p>
            </CardContent>
          </Card>

          <Card
            size="sm"
            className="rounded-[var(--ui-radius-panel)] sm:col-span-2 lg:col-span-1"
          >
            <CardHeader className="gap-3">
              <Warehouse className="size-5 text-primary" />
              <CardTitle className="text-xl">Centru SkySend</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {activeHub.address.formattedAddress}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        {coveragePreviewStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
          />
        ))}
      </div>

    </div>
  );
}
