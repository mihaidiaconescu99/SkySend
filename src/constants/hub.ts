import type { MissionHub } from "@/types/mission";

export type OperationalHubStatus = "active" | "inactive";

export type OperationalHub = MissionHub & {
  status: OperationalHubStatus;
  description: string;
};

export const pitestiHub: OperationalHub = {
  id: "hub_pitesti_001",
  name: "Centrul operațional SkySend Pitești",
  status: "active",
  description:
    "Centru operațional principal SkySend pentru lansări live cu drona, pregătirea compartimentelor și recuperarea misiunilor în Pitești.",
  address: {
    formattedAddress: "Centrul operațional SkySend Pitești, Pitești, Argeș, România",
    city: "Pitești",
    county: "Argeș",
    country: "România",
    location: {
      latitude: 44.8565,
      longitude: 24.8692,
    },
  },
};

export const activeHub = pitestiHub;
