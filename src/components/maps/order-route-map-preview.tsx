import { LazyMapContainer } from "@/components/maps/lazy-map-container";
import { StatusBadge } from "@/components/shared/status-badge";
import type { GeoPoint } from "@/types/service-area";

function getMapCenter(pickup: GeoPoint, dropoff: GeoPoint): GeoPoint {
  return {
    latitude: (pickup.latitude + dropoff.latitude) / 2,
    longitude: (pickup.longitude + dropoff.longitude) / 2,
  };
}

export function OrderRouteMapPreview({
  pickup,
  dropoff,
}: {
  pickup: GeoPoint;
  dropoff: GeoPoint;
}) {
  return (
    <LazyMapContainer
      className="min-h-[20rem]"
      ariaLabel="Hartă traseu comandă"
      center={getMapCenter(pickup, dropoff)}
      zoom={13.2}
      interactive={false}
      markers={[
        {
          id: "pickup",
          point: pickup,
          label: "Punct de ridicare",
          kind: "pickup",
          tone: "pickup",
          variant: "pickup",
          emphasized: true,
        },
        {
          id: "dropoff",
          point: dropoff,
          label: "Punct de livrare",
          kind: "dropoff",
          tone: "dropoff",
          variant: "dropoff",
          emphasized: true,
        },
      ]}
      overlayContent={
        <div className="map-overlay-card max-w-sm">
          <p className="type-caption">Hartă traseu</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label="Ridicare vizibilă" tone="info" />
            <StatusBadge label="Livrare vizibilă" tone="success" />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Traseul rămâne în zona activă Pitești și păstrează ambele puncte de
            livrare vizibile într-o hartă compactă.
          </p>
        </div>
      }
    />
  );
}
