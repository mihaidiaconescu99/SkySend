import { activeHub } from "@/constants/hub";
import type { MapMarkerDefinition } from "@/types/map";

export const coveragePreviewMarkers = [
  {
    id: activeHub.id,
    point: activeHub.address.location,
    label: activeHub.name,
    description: activeHub.address.formattedAddress,
    kind: "warehouse",
    tone: "warehouse",
    variant: "hub",
    emphasized: true,
  },
] as const satisfies readonly MapMarkerDefinition[];

export const coveragePreviewStats = [
  {
    label: "Zonă live",
    value: "Pitești",
    hint: "Zona publică activă pentru livrări SkySend.",
  },
  {
    label: "Centru activ",
    value: "1",
    hint: "Doar centrul operațional real SkySend este afișat pe hartă.",
  },
  {
    label: "Mod acoperire",
    value: "Rază",
    hint: "Verificare de acoperire în jurul centrului activ.",
  },
] as const;
