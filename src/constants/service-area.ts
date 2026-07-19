import type { ServiceAreaConfig } from "@/types/service-area";

export const serviceAreaConfig: ServiceAreaConfig = {
  cityName: "Pitești",
  county: "Argeș",
  country: "România",
  center: {
    latitude: 44.8565,
    longitude: 24.8692,
  },
  coverageRadiusKm: 6,
  activeMode: "radius",
  fallbackMode: "radius",
  area: {
    mode: "radius",
    center: {
      latitude: 44.8565,
      longitude: 24.8692,
    },
    radiusKm: 6,
  },
  futurePolygonArea: null,
  statusMessages: {
    available: "Adresa este în zona activă SkySend pentru Pitești.",
    outside:
      "Serviciul este momentan disponibil doar în zona activă Pitești. Vom reveni când extindem acoperirea.",
    unsupported:
      "Serviciul este activ momentan doar în municipiul Pitești, județul Argeș.",
    review:
      "Adresa pare aproape de limita zonei active din Pitești. O verificare suplimentară poate fi făcută înainte de lansare.",
  },
};
