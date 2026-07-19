import { StatusBadge } from "@/components/shared/status-badge";
import { serviceAreaConfig } from "@/constants/service-area";
import { getServiceAreaMapOverlay } from "@/lib/map";
import { LazyMapContainer } from "@/components/maps/lazy-map-container";

const serviceAreaOverlay = getServiceAreaMapOverlay();
const serviceAreaOverlays = [serviceAreaOverlay] as const;

export function ServiceAreaMap() {
  return (
    <LazyMapContainer
      ariaLabel="Hartă de acoperire SkySend"
      center={serviceAreaConfig.center}
      zoom={12.8}
      markers={[
        {
          id: "pitesti-core",
          point: serviceAreaConfig.center,
          label: "Centru activ Pitești",
          kind: "warehouse",
          tone: "warehouse",
          variant: "hub",
          emphasized: true,
        },
      ]}
      overlays={serviceAreaOverlays}
      overlayContent={
        <div className="map-overlay-card max-w-xs">
          <p className="type-caption">Acoperire activă</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label="Doar Pitești" tone="success" />
            <StatusBadge
              label={`Rază ${serviceAreaConfig.coverageRadiusKm} km`}
              tone="info"
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Acoperirea curentă de lansare este centrată pe municipiul Pitești.
          </p>
        </div>
      }
    />
  );
}
