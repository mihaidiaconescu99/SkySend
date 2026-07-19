import { droneFleet } from "@/constants/drone-fleet";
import type { DroneClassModel } from "@/types/entities";

export const mockDroneClasses: DroneClassModel[] = droneFleet.map((config) => ({
  id: config.id,
  isActivee: true,
  config,
  createdAt: "2026-01-10T09:00:00.000Z",
  updatedAt: "2026-04-20T10:30:00.000Z",
}));
